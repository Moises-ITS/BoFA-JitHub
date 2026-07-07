# JITI Sandbox — Complete System Documentation (pre-teardown)

> Written 2026-07-07, immediately before removing `pages/sandbox/SandboxPage.tsx` from the
> frontend. This is the full record of how the current Jiti AI assistant works, for the
> ground-up rebuild. The **backend AI engine is NOT being deleted** — it lives in the EDEN
> FastAPI service (`EDEN/backend/app/routers/sandbox.py`, 883 lines) and remains intact,
> as does the Express chat-memory API. Only the frontend chat page is being removed.

---

## 1. What kind of AI system is this?

**It is a real LLM system — an agentic, tool-using Claude chat with context stuffing.**
It is *not* fine-tuned, *not* trained on anything, and *not* vector-database RAG.

| Question | Answer |
|---|---|
| Model | **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`), overridable via `CLAUDE_MODEL` env; official `anthropic` Python SDK (both sync + `AsyncAnthropic` clients), 30s timeout, `ANTHROPIC_API_KEY` env |
| Training / fine-tuning | None. Stock model. All NJIT knowledge is injected at request time |
| RAG? | Not vector-RAG. Retrieval is **structured**: (a) context stuffed into the system prompt, (b) an **agentic tool loop** where the model calls SQL-backed tools mid-conversation |
| "Trained on" (i.e., what data it can see) | The EDEN Postgres, populated by the Instagram scraper: `clubs` (name, bio, instagram_handle, follower_count), `events` since **Fall 2023** (name, category, date, location, free-food/virtual flags), `event_posts` (captions, `engagement_score`), `collaborations` (cross-club events). Plus, per request: the student's JitHub profile, their connection recommendations, and their persisted chat topics |
| Cost control | Hard quota: **3 AI responses per user per 24h**, enforced server-side (see §6) |

## 2. Architecture (three services)

```
SandboxPage.tsx (React, deleted)                    the chat UI
   │  1. fetches CONTEXT from both backends (see §4)
   │  2. POST /sandbox/chat/stream  (SSE)
   ▼
EDEN FastAPI  (EDEN/backend/app/routers/sandbox.py — KEPT)
   │  • verifies the user by calling BACK to Express /api/auth/me
   │    with the caller's Bearer token (cross-service auth delegation)
   │  • enforces the 3-per-24h quota (ai_chat_usage table)
   │  • builds system prompt, runs the Claude tool loop, streams SSE
   ▼
Express backend (react-webapp/backend — KEPT)
   • /api/auth/me           → identity for the FastAPI side
   • /api/chat-memory       → persisted per-user topic interests
   • /api/connections/*     → executed when the user clicks a "connect" pill
```

## 3. The agentic tool loop (`_async_tool_loop`, sandbox.py:762)

Up to **4 iterations** of `messages.create` with `tools=TOOLS`. If the model stops with
`tool_use`, the tool is executed against Postgres and results are appended as
`tool_result` blocks; loop continues. Three tools (sandbox.py:171–241):

1. **`search_events`** — filters: `club_name` (with heavy alias resolution, below),
   `categories[]` (OR, ILIKE), `keyword` (event name OR post caption), `past_only`,
   `limit` (≤20). Always excludes `%interest%` gauge posts. Dedupes by event, keeps the
   highest-engagement post per event, then sorts: upcoming-first by date, past by
   recency, ties by engagement. Also matches events via the `collaborations` table so
   co-hosted events surface for either club.
2. **`get_event_details`** — one event by id: location, free food, virtual, caption (200 chars).
3. **`get_club_info`** — up to 3 clubs: bio (300 chars), Instagram handle, follower count.

**Club-name resolution is the crown jewel** (sandbox.py:245–387) — do not lose this in
the rebuild: an ~80-entry `CLUB_ACRONYMS` dict (SHPE→"Hispanic Professional Engineers",
covering engineering/cultural/Greek/government orgs), token-by-token expansion of the
query, then fuzzy matching against the club directory (`app/club_directory.py`:
`find_matching_club`, `get_club_aliases`, `normalize_club_text`,
`resolve_canonical_club_name`) producing both exact `club_id` filters and ILIKE
alias-term filters.

## 4. Context stuffing (what goes into the system prompt)

The **frontend** assembled the context (`fetchContext()`, SandboxPage:277) and sent it in
the request body — only when the message looked context-relevant per an
`isContextRelevant()` regex, otherwise it sent an empty context:

- `GET {EDEN}/events/upcoming?limit=12` → 12 upcoming events (trimmed fields)
- `GET {EDEN}/events/top-risers?limit=10` → 10 trending events
- `GET {EXPRESS}/api/connections/recommendations` (Bearer) → 5 people (shared clubs/interests/skills, looking_for, score)
- The user's profile from AuthContext (name, major, year, interests, clubs, skills, looking_for, graduation_year)
- `chat_interests`: top-10 topics from `GET /api/chat-memory`

The **backend** then adds its own query (sandbox.py:723–750): **top-15 clubs ranked by
this-semester Instagram engagement** (`SUM(engagement_score)` since semester start,
plus follower counts).

⚠️ Rebuild note: the client supplies most of the context — the server trusts it. Moving
context assembly server-side removes 3 client round-trips per message AND the
client-can-lie-about-context trust issue.

## 5. The system prompt (`NJIT_BASE`, sandbox.py:565–626)

Hard-won behavioral engineering; keep almost all of it. Sections:
- **NJIT facts block**: campus buildings, majors, programs (Dorman Honors, co-op, CDS),
  research centers, recurring events (Career Fair Oct/Feb, Highlander Week), Newark context.
- **Data scope rules**: data starts Fall 2023; the limitation must NEVER be the whole
  answer (with explicit CORRECT/WRONG examples).
- **Event category glossary**: the 13 exact category values in the DB.
- **MANDATORY tool use**: must call `search_events` before answering anything about past
  events — "the database is the only source of truth."
- **Response rules** (each one exists because Haiku violated it): zero markdown; the
  `ACTIONS:[...]` protocol (last line, JSON array); every named event must get a
  view_event action; event IDs never in prose; ≤150 words, `•` bullets; never end with a
  question; never pre-announce counts ("I found 5…"); date/semester-week awareness
  (today, current week span, "next week" boundary — interpolated per request);
  no Instagram/engagement/ranking mechanics ever mentioned to the user.

## 6. Auth, quota, and streaming

- **Auth**: FastAPI has no Clerk integration — it forwards the `Authorization` header to
  Express `GET /api/auth/me` (5s timeout, run in a thread) and uses the returned `id`.
- **Quota**: `ai_chat_usage` table (created lazily on first use — sandbox.py:97), 3 rows
  per rolling 24h window per user; race-safe via `pg_advisory_xact_lock(hashtext(user_id))`;
  429 response includes `reset_at`. The frontend showed a friendly limit message.
- **Streaming**: SSE (`text/event-stream`), events: `{type:"text"}`, `{type:"done",
  actions}`, `{type:"error"}`. **Caveat: it's pseudo-streaming.** The full completion is
  buffered server-side first (to strip `**`/`__` markdown, delete "I found N…" count
  intros via regex, and split off the ACTIONS block), then emitted as ONE text event.
  The token-by-token UX the frontend implements never actually happens.

## 7. Action pills (LLM → UI affordances)

Model's last line: `ACTIONS:[{"type":"view_event","label":"Game Night","event_id":123},
{"type":"connect","label":"…","user_id":"…","user_name":"…"}]`. Backend JSON-parses it
(defaults to `[]` on garbage). Frontend rendered pills:
- **view_event** → opens the shared `EventDetailModal` (cached event or
  `GET {EDEN}/events/:id`), loads RSVP state via `POST {EDEN}/rsvp/batch-status`,
  supports RSVP toggle (`POST/DELETE {EDEN}/rsvp/...`).
- **connect** → `POST {EXPRESS}/api/connections/request {toUserId}`; disconnect via
  `DELETE /api/connections/by-user/:id`; optimistic ✓ Connected state.

## 8. Topic memory (the only true persistence)

- Frontend regex `TOPIC_MAP` (13 topics: hackathons, networking, career, research,
  free food, academics, clubs, social, tech/CS, arts, sports, culture, community service)
  matched each user message; hits were fire-and-forgotten to
  `POST /api/chat-memory/record`.
- Express upserts into `user_chat_memory (user_id, topic, weight, last_seen)` — weight
  increments per mention (`routes/chatMemory.ts`, table created in migration
  `009_user_chat_memory`).
- Top-10 by weight feed back into the next prompt as "Past chat interests".
- **Chat transcripts were NOT persisted server-side** — only in
  `localStorage["jiti_chat_<userId>"]`; the model got the last 6 turns.

## 9. Frontend UI inventory (what was deleted)

Single 591-line component with internal sub-components — dark-theme chat:
`TypingIndicator` (3 bouncing dots), `StarterPrompts` (4 canned openers + `/jiti.png`
avatar), `MessageBubble` (user right/red #C0392B, assistant left/dark, error state),
`ActionPill`, `InputBar` (Enter-to-send textarea), header ("Sandbox · Claude Haiku",
Clear button), auto-scroll, localStorage persistence per user, 5s-timeout context
fetches, SSE reader with line-buffered `data:` parsing. Static asset `/jiti.png`
(frontend/public) — left in place.

## 10. Rebuild recommendations (keep / fix / discard)

**Keep (significant, working engineering):**
- The three tool schemas + their SQL, especially the club alias/acronym resolution stack
- The NJIT_BASE prompt rules — every rule is a patch over an observed failure
- The quota mechanism (advisory-lock pattern is correct); consider making the limit configurable
- `user_chat_memory` + `/api/chat-memory` (still mounted and working)
- The action-pill UX concept — it's the best part of the product

**Fix in the rebuild:**
- **Real streaming**: stream tokens as they arrive; do markdown-stripping incrementally
  or prompt harder, and move ACTIONS to a structured mechanism instead of a magic last
  line — the modern approach is a final `tool_use` block (e.g. an `emit_actions` tool)
  which eliminates the string-splitting entirely
- **Server-side context assembly**: FastAPI should fetch upcoming/trending/recommendations
  itself (it owns most of that data) — kills 3 client round-trips and client-supplied-context trust
- **Topic extraction by the model** (a cheap tagging call or an output field) instead of
  the frontend regex — the regex misses everything it wasn't hardcoded for
- `_ensure_ai_chat_usage_table` runs CREATE TABLE on EVERY request — make it a real migration
- `print()` debugging → structured logging
- Server-side transcript persistence if conversations should survive devices

**Discard:**
- The `isContextRelevant()` regex gate (server-side assembly makes it moot)
- The buffered SSE plumbing
- Duplicate profile-building code paths in the page (profile was built twice)

## 11. Environment variables (EDEN FastAPI side)

- `ANTHROPIC_API_KEY` — required
- `CLAUDE_MODEL` — default `claude-haiku-4-5-20251001`
- `AUTH_API_URL` — Express origin for auth delegation (default `http://localhost:3001`)
- EDEN's own `DATABASE_URL` (SQLAlchemy, `app/database.py`)
