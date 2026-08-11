# Jiti v2 — Cost Strategies and Implementation Notes

> Written 2026-08-10, alongside the implementation (backend `f887a77`, frontend `52bcb7c`).
> Companion to [`ai_implementation.md`](./ai_implementation.md) (the design critique that led
> here) and [`JITI-SANDBOX.md`](./JITI-SANDBOX.md) (the v1 system this replaces).
>
> **Architecture in one line:** Claude Haiku 4.5, prompt caching + context stuffing,
> **no vector RAG**, all quota/spend state in Redis, hard budget ceiling ≈ $20/month.

---

## 1. The budget problem, stated honestly

The target was **$20/month at 500 DAU × 5 prompts/day**. Those two numbers are incompatible:

```
500 DAU × 5 prompts/day × 30 days   = 75,000 prompts/month
$20 ÷ 75,000                        = $0.000267 per prompt
```

At Haiku 4.5's **$5/MTok output** price, $0.000267 buys **53 output tokens** — with zero
input. A 300-token answer alone costs $0.0015, already 5.6× the entire per-prompt budget.
75,000 prompts with any useful answer lands near **$131/month**.

**Resolution:** 5/day is a *ceiling*, not an average. Realistic load is ~15% adoption × ~2.5
prompts ≈ **190 prompts/day**. The design targets that, and a **global daily spend ledger**
— not an assumed usage rate — is what actually enforces the ceiling. If usage spikes, the
bot reports "at capacity" instead of overspending.

---

## 2. Strategies used

### 2.1 Prompt caching at **1-hour** TTL — the single biggest lever

Cache reads cost **$0.10/MTok** vs $1.00/MTok for uncached input: a **10× discount** on the
club index, which is the bulk of every request.

The TTL choice is not cosmetic. At ~190 prompts/day over ~14 waking hours, the mean gap
between requests is **4.4 minutes** — sitting right on top of the 5-minute default expiry:

| TTL | Write cost | Est. writes/day | Est. monthly |
|---|---|---|---|
| 5-minute (1.25×) | $0.0144 | ~61 (≈32% miss) | **~$39** ❌ |
| **1-hour (2×)** | $0.023 | ~5 | **~$18** ✅ |

The longer TTL costs ~60% more per write but amortizes over ~40× more requests. **On sparse
traffic the longer TTL wins decisively** — this is the difference between hitting and
doubling the budget.

> Deliberately *not* done: a cache keep-alive pinger. Pinging an idle feature burns real
> cache-write cost to maintain a cache nobody is reading.

### 2.2 Corpus compression — 74k → ~11.5k tokens

The raw CSV is ~74k tokens. Stuffing it whole costs $0.0074/prompt in cache reads alone
(≈$42/mo at expected load). `jitiCorpusService.ts` compresses it at boot:

- Drop rows whose `metadata_json.status` is not `Active`
- `name = short_name || title`, `summary` truncated to 130 chars, `category` capped at 40
- One line per club: `` `${name} | ${cat} | ${summary}` ``
- Drop `id`, `url`, `metadata_json`, `tags`, `last_updated` entirely

Result: **~11.5k tokens**, an ~85% reduction, retaining what makes answers good (name,
acronym, category, what the club does).

### 2.3 Cache-boundary discipline

Caching is a **prefix match** — one byte changing anywhere invalidates everything after it.
A `Date.now()` or a username in the cached block silently drops the hit rate to zero and
multiplies cost ~20× with no error.

| Above the breakpoint (cached, byte-stable) | Below (per-request) |
|---|---|
| Static instruction block | Conversation history (last 3 exchanges) |
| Compressed club index | The user's question |
| Hardcoded "current as of 2026-07-07" string | — |

The corpus header date is a **hardcoded literal**, not read from the file or the clock.
A test asserts two consecutive builds are byte-identical, and another asserts the cached
block never contains the question, `userId`, or `deviceId`.

### 2.4 Boot-time token floor — fail loud, not silent

**Haiku 4.5 will not cache a prefix under 4,096 tokens**, and gives no error when it
declines. A shrunken corpus would silently disable caching and 10× the bill.

So the server **counts tokens at boot** via the SDK and **throws** below 4,096, refusing to
start rather than run with broken economics. Warns above 20,000 (cost creep).

### 2.5 Two-phase reserve → reconcile → refund

Anthropic reports usage only *after* the call, but the ceiling must hold under concurrency.
So every request reserves a pessimistic **3¢** up front, then trues up against reality:

```
reserve 3¢  →  call Anthropic  →  reconcile with real usage  →  INCRBY (actual − 3¢)
                     ↓ fails
              refund 3¢ AND the user's quota slot
```

The delta is usually **negative** — a cache hit costs far less than the write-sized
reservation. That is the expected case, not a bug.

Actual cost is computed from the real `usage` object at input **$1** / cache-write **$2.00**
/ cache-read **$0.10** / output **$5** per MTok.

**Reconciliation is deliberately best-effort.** By the time it runs, Anthropic has already
executed and billed, and the answer is in hand. If Redis blips at that moment, letting the
error propagate would 500 the request — the student loses both their quota slot *and* the
answer we already paid for. So a reconcile failure is logged loudly and the answer is
returned anyway: a ledger off by one request's delta self-corrects at midnight when the key
expires; a discarded paid-for answer does not.

### 2.6 Global spend ledger with graceful degradation

`jiti:spend:global:{YYYY-MM-DD}` accumulates cents against a **65¢/day** ceiling
($20 ÷ 30). When exceeded, requests get `503 AT_CAPACITY` and **Anthropic is never called**.

Critically, hitting the global ceiling **also refunds the user's quota slot** — a student
must not lose one of their five prompts to a request that never ran.

### 2.7 Quota keyed on user, device for analytics only

The original ask was "track by device." Device-only keying is the *weaker* option: a student
gets 5 more prompts per browser and incognito resets it freely — a direct hole in a $20
ceiling. So:

- **Enforcement:** `jiti:quota:user:{userId}:{date}` — authoritative, login required
- **Analytics:** `SADD jiti:devices:user:{userId}:{date}` — never read for decisions
- **UI continuity:** the device ID lives in `localStorage`, which is shared across same-origin
  tabs, so the counter is consistent across tabs by construction

Both keys expire at **midnight America/New_York** (campus time), with DST correctness tested
across a November and a March boundary.

### 2.8 Output discipline

Output is **5× the price of input**, so it gets the tightest constraints:

- `max_tokens: 300` — a hard cap
- The prompt asks for answers under ~120 words
- **Thinking is disabled.** On Haiku 4.5 thinking uses `budget_tokens` and bills as output at
  $5/MTok — enabling it would blow the budget for no gain on lookup-style questions
- **`output_config.effort` is never sent** — it *errors* on Haiku 4.5

### 2.9 Redis-only state — no migration

`CLAUDE.md` says *"Do not migrate at all."* Daily counters are a natural fit for Redis keys
with `EXPIRE` anyway, so quota and spend need **no Postgres table**, no change to
`migrate.ts`, and nothing to clean up on rollback — the keys self-expire within 24h.

### 2.10 Distinguishable error codes

The pre-existing IP rate limiter already returns bare `429`s. If the UI branched on HTTP
status, an unrelated IP limit would render "you've used your 5 prompts."

Every Jiti error carries a `code`, and the frontend branches on **`data.code`, never status**:

| Code | Status | Meaning |
|---|---|---|
| `QUOTA_EXCEEDED` | 429 | This user spent their 5 today |
| `AT_CAPACITY` | 503 | Global daily budget exhausted |
| `UPSTREAM_FAILURE` | 502 | Anthropic unreachable — **quota refunded** |
| *(none)* | 429 | The IP limiter — generic error |

### 2.11 Multi-turn without cache cost

History sits **after** the cache breakpoint, so it never invalidates the cached prefix. The
last **3 exchanges** add ~300 tokens (<0.2¢) and make "tell me more about the first one"
work. Cleared on panel close and reload; nothing persisted server-side.

### 2.12 Prompt-injection stance

Club descriptions are third-party scraped/submitted text sitting inside the system prompt.
Mitigations:

- The instruction block states the index is **reference data, not instructions**
- **No tools exist in v1** — the entire tool-abuse surface of the v1 system is absent by design
- Output renders as **plain text**; no `dangerouslySetInnerHTML` anywhere
- No club text is used to build queries, paths, or URLs server-side

### 2.13 Kill switch and fail-closed UI

`JITI_ENABLED` (default `false`) gates router mounting, mirroring the existing `ENABLE_EDEN`
pattern. When off, `/api/jiti/*` 404s and **the frontend widget renders nothing at all** —
no launcher button — so a disabled backend can never show a broken chat bubble.

---

## 3. Cost model

Assumed: ~190 prompts/day, ~11.5k-token cached block, 300-token answers.

| Line item | Per prompt | Per day | Per month |
|---|---|---|---|
| Cache read (11.5k @ $0.10/MTok) | $0.00115 | $0.21 | $6.30 |
| Cache writes (~5/day @ $0.023) | — | $0.12 | $3.45 |
| Output (300 tok @ $5/MTok) | $0.0015 | $0.29 | $8.55 |
| **Total** | **~$0.0027** | **~$0.62** | **≈ $18.30** |

Hard ceiling enforced at **65¢/day ≈ $19.50/month** by the spend ledger.

### The risk to watch

The estimate assumes a healthy cache **hit rate**. If traffic is sparser than modeled, more
requests pay the cache-*write* rate (2×) instead of the read rate (0.1×). Worst case — every
request a miss — is ~2.4¢/prompt, or **~$137/month at 190/day**.

**The ledger, not the estimate, is the guarantee.** On a low-hit-rate day expect
`AT_CAPACITY` earlier than 190 prompts. That is the design working, not failing.

`[jiti][cache]` logs `cacheRead`/`cacheWrite` per call — **that is the number to watch.**
A sustained cacheWrite-dominant ratio means the TTL assumption is wrong for real traffic.

---

## 4. Observability

| Tag | Logged | Why |
|---|---|---|
| `[jiti][corpus]` | Boot: rows in/excluded, token count, 4,096 pass/fail | Catches a broken cost model at startup |
| `[jiti][quota]` | Every decision: user, used, limit | Quota disputes |
| `[jiti][spend]` | Ledger before/reserve/ceiling, then actual/delta | **Primary cost alarm** |
| `[jiti][cache]` | cacheRead / cacheWrite per call | **Hit-rate — the top risk** |
| `[jiti][upstream]` | Latency ms, error class | Anthropic health |

---

## 5. Rollout and rollback

**Env vars** (all in `.env.example`):

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5
JITI_ENABLED=false
JITI_DAILY_USER_LIMIT=5
JITI_GLOBAL_DAILY_CENTS=65
JITI_MAX_OUTPUT_TOKENS=300
JITI_RESERVE_CENTS=3
```

**Rollout:** ship dark (`JITI_ENABLED=false`) → enable in staging, confirm the
`[jiti][corpus]` boot line clears 4,096 and one real request logs sane `[jiti][cache]` /
`[jiti][spend]` values → enable in production → watch `[jiti][spend]` for the first day and
confirm the ledger resets at NY midnight.

**Rollback:** set `JITI_ENABLED=false` and restart. Endpoints 404, the widget self-hides on
the next status call — **no frontend deploy needed**. Redis keys self-expire within 24h.
No Postgres rows exist. Nothing to reconcile.

---

## 6. Deliberately not built

| Not built | Why |
|---|---|
| **Vector RAG** | 74k-token corpus fits in a 200K window. Retrieval would add an embeddings pipeline, a vector store, and tuning knobs with no eval set — see `ai_implementation.md` |
| **Token-by-token streaming** | No SSE precedent in the Express backend; greenfield work. v2 candidate |
| **Cross-session memory** | Costs tokens on every request and needs storage (i.e. a migration) |
| **Tool calling** | v1's three SQL tools are real value, but each tool round-trip is another billed request. Revisit once the cost model is proven in production |
| **Cache keep-alive pinger** | Burns cache-write cost to keep an idle feature warm |
| **Gradual percentage rollout** | No feature-flag service exists; the env var is the only lever |

---

## 7. Open items

1. **The v1 engine still exists.** `EDEN/backend/app/routers/sandbox.py` (882 lines) is
   superseded by this but not deleted. It has no deployment path
   (`ai_implementation.md` §6). Decide whether to delete it or keep it as reference.
2. **Club acronyms.** v1 has a **74-entry** `CLUB_ACRONYMS` dict; the TypeScript port in
   `clubDirectory.ts` has **15**. Jiti v2 relies on the corpus's `short_name` field instead,
   but ~60 acronym mappings remain unported for other consumers.
3. **Corpus freshness.** One scrape, 2026-07-07, no refresh job. Every answer is as current
   as that date. Growing the corpus is the trigger to revisit §6's RAG decision.
4. **Cache hit rate is unverified in production.** §3's risk stands until `[jiti][cache]`
   has real data.
