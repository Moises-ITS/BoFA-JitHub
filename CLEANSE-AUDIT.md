# JitHub Cleanse Audit — Report-First Review

> Produced before any changes were made. Each finding has an ID — approve, reject, or
> question items by ID. Phases are ordered so each git commit is independently
> revertable (per agreed strategy: phased commits on `restructure`).
>
> Scope agreed: keep EDEN (clean it, don't delete), delete `design/`, get `tsc` green,
> defer deep splitting of giant files unless approved separately.

---

## Phase 0 — SECURITY (urgent, do before anything else)

### S1. Live Instagram session cookies committed to git — `EDEN/backend/ig_cookies.json` 🔴
The file contains 9 real cookies including `sessionid`, `csrftoken`, and `ds_user_id`.
An Instagram `sessionid` is a full account-takeover credential — anyone with repo read
access (or anyone who ever cloned it) can log in as that account.
**Action:** (a) rotate NOW — log the Instagram account out of all sessions / change its
password; (b) `git rm --cached` the file and add `ig_cookies.json` to `.gitignore`;
(c) optionally purge from git history with `git filter-repo` (disruptive — every clone
must re-clone; can be deferred since rotation kills the credential).

### S2. `node_modules/` tracked in git at repo root (36 files)
`.gitignore` already lists `node_modules/`, but these files were committed before the
ignore rule existed (ignore rules never untrack already-tracked files — classic gotcha).
**Action:** `git rm -r --cached node_modules` at root.

### S3. Run the existing secrets scanner over the whole tree
Backend already ships `scripts/scan-secrets.mjs`. Run it repo-wide as a final Phase 0
gate to catch anything S1-shaped that I haven't spotted manually.

---

## Phase 1 — DEAD CODE DELETION

### D1. `react-webapp/src/` — an entire second, dead frontend
Old Vite scaffold (`App.jsx`, `main.jsx`, `App.css`, `index.css`) plus an abandoned
graph feature (`features/graph/*`, `api/graph.ts`). **Nothing in the live app imports
any of it** (verified by grep). It exists only because the project was re-scaffolded
into `frontend/` and the old tree was never deleted.

### D2. `react-webapp/{package.json, vite.config.js, index.html, eslint.config.js, public/}` — the dead app's scaffold
- `react-webapp/index.html` loads `/src/main.jsx` — i.e. the dead app in D1.
- `react-webapp/package.json` is a frontend scaffold with **backend deps mixed in**
  (`express`, `helmet`, `morgan`, `compression`, `redis` in a Vite app!) — a clear sign
  it was never rationalized.
- ⚠️ **Verify before deleting:** what is the Vercel project's "Root Directory" setting?
  `vercel.json` sits at `react-webapp/`. If Vercel's root is `react-webapp/` it is
  currently building the DEAD app — which would be its own severe finding. If the root
  is `react-webapp/frontend`, then everything here except `vercel.json` (move it into
  `frontend/`) is safe to delete. **I need you to check the Vercel dashboard.**

### D3. `design/` — static HTML/JSX prototypes *(approved: delete)*
`app.jsx`, `terminal-app.jsx`, `friendly-app.jsx`, `mock-data.js`, etc. (~3,500 lines).
Superseded by the real frontend; recoverable from git history if ever needed.

### D4. Unrouted legacy password-auth pages
`pages/auth/ForgotPasswordPage.tsx` and `ResetPasswordPage.tsx` — **not referenced in
`App.tsx` routes or anywhere else**. Clerk owns credentials now; password reset happens
in Clerk's UI. (Related: backend still has a `password_reset_tokens` table cleanup in
account-delete — leave the DB table alone for now, it's harmless.)

### D5. `pages/SharedComponents/ProtectedRoute.tsx` — inferior duplicate
Never imported. The real one (`components/ProtectedRoute.tsx`) handles Clerk loading
states, auth errors, and retry; this one silently returns `null` while loading. Delete
the file and the now-empty `SharedComponents/` directory.

### D6. Backend one-off scripts mixed with production code
Move to `react-webapp/backend/scripts/` (where `purge-test-users.mjs` etc. already
live) or delete:
- `wipe-neo4j.mjs` — **wipes the graph database**; a destructive tool sitting at the
  package root one typo away from `npm start` is an incident waiting to happen. Move
  to `scripts/` with a confirmation prompt, or delete.
- `fix-schema.mjs`, `reset-postgres-survey.mjs` — one-time migration patches; their job
  is done (real migrations live in `src/db/migrations/`). Delete.
- `test-connection.mjs`, `test_neo4j.ts` — ad-hoc smoke tests. Delete (real tests exist
  in vitest) or fold into `scripts/`.
- `seed.js` + `seed-neo4j.mjs` (compat shim) — keep ONE seed entrypoint under
  `scripts/`, delete the shim.

### D7. EDEN debug/one-off scripts *(EDEN itself stays, per your call)*
`debug_pw.py`, `test_cookies.py`, `check_run.py`, `reclassify_categories.py`,
`download_profile_pics.py`, `scraped_clubs.txt`, `EDEN/backend/package-lock.json`
(a **Node** lockfile in a Python project — pure accident). Propose: move genuinely
reusable ones into `EDEN/backend/scraper_tools/`, delete the rest.

### D8. Dev tools exposed as production routes
`/inspect` (`GlbInspector.tsx` — 5 `console.log`s, a 3D-model debugging tool) is a
protected route shipped to all 2000 students. Propose: gate behind
`import.meta.env.DEV` or delete the route.

### D9. Obsolete e2e specs
`tests/e2e/debug.spec.ts` (a debugging scratch file) and the password-flow specs
(`auth/login.spec.ts`, `auth/signup.spec.ts`, `auth/protected-routes.spec.ts`) test a
credential flow that no longer exists (Clerk owns it). Delete debug spec; rewrite or
delete the auth specs (**decide: rewrite for Clerk test-mode, or delete for now?**).

---

## Phase 2 — DEDUPLICATION / SHARED MODULES

### C1. 21 files each re-declare the API base URL
`const API = import.meta.env.VITE_API_URL ?? "http://localhost:5175"` is copy-pasted
across 21 frontend files — **and the fallbacks disagree** (AuthContext says `5175`,
`App.tsx`'s setup screen tells developers to use `3001`, EDEN pages use `8000` via a
second variable). One typo'd port = one silently broken page.
**Action:** create `frontend/lib/api.ts` exporting `API_BASE_URL`, `EDEN_API_BASE_URL`,
and one authenticated-fetch helper (timeout + Bearer header + JSON parsing — the
pattern already built in `AuthContext.tsx`'s `apiFetch`, promoted to shared). Every
page imports from there.

### C2. Duplicate type definitions
- `GraphNode`: defined in `pages/node/types/graphNodes.ts` AND re-declared privately in
  `hooks/useNodeSearch.ts` — the copies can silently drift.
- `Opportunity`: `pages/opportunities/types/opportunities.ts` AND
  `pages/districts/data/districts.ts` (different shapes, same name — confusing).
- `User` / `UserProfile`: `context/AuthContext.tsx` AND
  `pages/events/components/EventDetailModal.tsx`.
**Action:** create `frontend/types/` (or extend existing per-feature `types/` files) and
make every consumer import the single canonical definition. Rename the districts one
(`ResearchOpportunity`) since it is genuinely a different thing.

### C3. Two `heatmap-calendar.tsx` files
`pages/home/heatmap-calendar.tsx` renders **hardcoded mock density data**; the events
version fetches real data from the EDEN API. **Action:** delete the mock one and reuse
the real one in Home (or extract a shared presentational grid if Home needs a
lightweight variant).

### C4. Backend `routes/auth.ts` internal duplication
- `formatUser` vs `formatPublicProfile` — 90% identical field mapping; collapse into
  one formatter with a `includePrivateFields` flag.
- `SELECT_PROFILE` vs `SELECT_PUBLIC_PROFILE` — same collapse.
- Lines 149–159: the `if (!normalizedName)` check is **written twice back-to-back**
  (the second is dead code that can never fire) with stale comments between.

### C5. Mock data still driving production pages
`Home.tsx` and `profile.tsx` import `mockOpportunities` from `pages/home/mock-data.ts`
while a real opportunities API + `useOpportunities` hook exists. 2000 students will see
fake data on the home page. **Action (decide):** wire both to the real hook, or keep
mock intentionally and mark it loudly. I recommend wiring to the real hook.

---

## Phase 3 — NAMING, STRUCTURE, CONFIG HYGIENE

### N1. `middlewear/` → `middleware/`
Misspelled directory imported by every backend route file. Rename + fix imports.
(Windows note: git is case/rename-safe here since the word itself changes.)

### N2. Root `package.json` duplicates backend deps
`@clerk/backend`, `express-rate-limit`, `node-cron`, `rate-limit-redis`, `redis` are
declared BOTH at repo root and in `backend/package.json`. The root copy exists only to
satisfy a deploy quirk; two copies means two versions can drift.
**Action:** adopt **npm workspaces** at the root (`"workspaces":
["react-webapp/frontend", "react-webapp/backend"]`), delete duplicated root deps, keep
root scripts as thin `npm run -w` delegates. This also makes CI honest (see N3).

### N3. CI workflows reference infrastructure that doesn't exist
- `ci.yaml` runs `npm run type-check -w shared|frontend|backend` — **there are no npm
  workspaces and no `shared` package**; these steps have never actually protected you.
- `playwright.yaml` sets `working-directory: react-webapp` and runs `npm run start` —
  no `start` script exists there (and it would build the dead app from D1/D2 anyway).
**Action:** after N2, point CI at the real workspaces; add a real `type-check` script
(`tsc --noEmit`) to frontend + backend; make Playwright build/serve `frontend/`.

### N4. Path aliases
Deep relative imports (`../../context/AuthContext`) everywhere. Add `@/` alias in
`frontend/tsconfig.json` + `vite.config.ts`. Low risk, big readability win.
*(Optional — say no and I'll skip; it touches many import lines.)*

### N5. File naming consistency
`pages/profile/profile.tsx` (lowercase) vs every other PascalCase page; two components
named `heatmap-calendar.tsx` (kebab) vs PascalCase siblings. Normalize to PascalCase
for components. *(Optional cosmetic.)*

---

## Phase 4 — TYPE-CHECK GREEN (~60 errors, includes REAL runtime bugs)

The frontend currently fails `tsc --noEmit`, so CI cannot protect you. Notable: several
"type errors" are **actual crashes waiting to happen**:

### T1. `pages/home/Home.tsx:279` — references undefined variable `cancelled`
A cleanup-flag pattern was half-copied; the variable doesn't exist in scope. This is a
`ReferenceError` at runtime on whatever path executes it.

### T2. `pages/events/components/EventDetailModal.tsx:366` — `<AttendanceForm />` used but never imported
Renders → immediate crash of the event detail modal.

### T3. `pages/districts/*` — components consume fields (`labs`, `ctaLabel`,
`accentRgb`, `Lab` type) that `data/districts.ts` no longer exports — the data file and
its consumers have drifted apart; whole sections of that page are type-unsound.

### T4. The long tail
Unused imports/vars (~25), `verbatimModuleSyntax` type-only-import violations (~5),
`CampusGraph.tsx` internal contradictions ("2d"/"3d" comparisons that can't overlap,
redeclared `profile` variable, wrong-arity calls), three.js ref typing in
`GlobeView`/`ResearchDistricts`. All get fixed with minimal diffs; CI then enforces via
N3 so it can't regress.

---

## Phase 5 — DEFERRED (flagged, not in this cleanse — approve separately later)

- **`CampusGraph.tsx` (4,186 lines)** — needs decomposition into
  hooks/components/utils; high blast radius, deserves its own branch + e2e coverage.
- **`EdenTabs.tsx` (1,348) / `EventsPage.tsx` (856) / `eden.ts` route (769)** — same.
- **`frontend/public/club_pics` (202 images in git)** — works fine on Vercel's CDN for
  2000 students; consider object storage only if the set grows.

---

## Execution order & commit plan (once approved)

| Commit | Contents | Risk |
|--------|----------|------|
| 1 | Phase 0: untrack node_modules, remove cookies, gitignore hardening | none (no code) |
| 2 | Phase 1: dead-code deletion (D1–D9, pending your D2 Vercel answer) | low |
| 3 | Phase 2: shared api/types modules, dedupe (C1–C5) | medium |
| 4 | Phase 3: middleware rename, workspaces, CI fixes (N1–N3) | medium |
| 5 | Phase 4: tsc green (T1–T4) | low-medium |

Each commit leaves the app building and runnable; verification after each phase =
`vite build` + backend `tsc` + smoke-run.
