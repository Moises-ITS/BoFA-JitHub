# BoFA-JitHub — System Architecture

## Overview

BoFA-JitHub is a campus social-graph platform for NJIT students. It combines a professional networking layer (graph-based student connections), an events intelligence engine (Instagram scraper + AI assistant), a 3D campus digital twin, and an opportunities feed — all behind NJIT-email-only authentication.

---

## System Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                           │
│                React 19 + Vite + Tailwind + Clerk                   │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌────────┐  │
│  │CampusGraph│ │ EventsPage│ │DigitalTwin│ │ Sandbox  │ │Profile │  │
│  │ D3 / 3D  │ │  EDEN API │ │  Cesium   │ │JITI (SSE)│ │ Auth   │  │
│  └────┬─────┘ └────┬──────┘ └─────┬─────┘ └────┬─────┘ └───┬────┘  │
└───────│────────────│──────────────│──────────────│────────────│──────┘
        │            │              │              │            │
        ▼            ▼              │              ▼            ▼
┌───────────────────────────┐      │    ┌──────────────────────────┐
│  Express Backend (3001)   │      │    │  EDEN FastAPI (8000)     │
│  TypeScript · Node.js     │◄─────┼────│  Python · Uvicorn        │
│                           │      │    │                          │
│  /api/auth                │      │    │  /events (CRUD + heatmap)│
│  /api/graph               │      │    │  /clubs                  │
│  /api/connections         │      │    │  /rsvp                   │
│  /api/opportunities       │      │    │  /sandbox (Claude SSE)   │
│  /api/buildings           │      │    │                          │
│  /api/chat-memory         │      │    │  APScheduler scrapers     │
│  Background scrapers       │      │    │  Instagram (Playwright)   │
└───────────────────────────┘      │    └──────────────────────────┘
         │           │             │              │
    ┌────┘      ┌────┘        ┌────┘         ┌───┘
    ▼           ▼             ▼              ▼
┌────────┐ ┌────────┐  ┌───────────┐  ┌──────────────┐
│ Neo4j  │ │Postgres│  │  Cesium   │  │  Anthropic   │
│ AuraDB │ │(Railway│  │  Ion API  │  │  Claude API  │
│        │ │  PG)   │  │  (Globe)  │  │  (Haiku 4.5) │
└────────┘ └────────┘  └───────────┘  └──────────────┘
                │
           ┌────┘
           ▼
        ┌───────┐
        │ Redis │
        │(optional│
        │rate lim)│
        └───────┘
```

---

## Services

### 1. Express Backend (`react-webapp/backend`) — Port 3001

TypeScript Express API. The trust boundary of the application — every sensitive operation passes through here, token-verified before touching any database.

**Responsibilities**
- Clerk JWT verification on all protected routes
- PostgreSQL user management (profile CRUD, connection requests, notifications, chat memory)
- Neo4j graph writes (student nodes, relationships, connection edges)
- Serving graph data to the frontend for visualization
- Background scraping of job/scholarship listings every 6 hours
- Rate limiting all API surfaces

**Startup sequence**
1. Load `.env`
2. Run idempotent SQL migrations (`runMigrations`)
3. Patch Neo4j nodes missing `id` property (`ensureNodeIds`)
4. Register middleware (CORS, Helmet, compression, rate limiters)
5. Mount all routers
6. Start cron scrapers (`startScheduler`)

---

### 2. EDEN FastAPI Backend (`EDEN/backend`) — Port 8000

Python async API. Owns everything related to campus events — data collection, engagement scoring, RSVP, and the JITI AI assistant.

**Responsibilities**
- Serving event, club, and RSVP data from PostgreSQL
- Instagram scraper (Playwright + stored cookies) → engagement scoring
- Streaming Claude responses for JITI AI chat (SSE)
- Agentic tool loop: Claude can call `search_events`, `get_event_details`, `get_club_info`, and `find_club_members` (which proxies back to Express)

**Separation rationale:** Events/clubs/RSVP data has a fundamentally different access pattern (heavy reads, Instagram-sourced writes) and a different team surface from the social-graph data in Express. Keeping them in a separate Python service lets the scraping and AI logic use Python-native libraries (Playwright, anthropic, APScheduler) without dragging those into the Node.js codebase.

---

### 3. React Frontend (`react-webapp/frontend`) — Port 5173

React 19 + Vite SPA. Lazy-loads all heavy pages (Cesium, Three.js, D3, isometric canvas) to keep initial bundle small.

**Route structure**

| Path | Page | Heavy dependency |
|------|------|-----------------|
| `/` | LandingPage | — |
| `/login`, `/signup` | Clerk-hosted auth | Clerk |
| `/home` | Home dashboard | motion |
| `/network` | CampusGraph | D3, 3d-force-graph |
| `/events` | EventsPage | — |
| `/opportunities` | OpportunitiesPage | Cesium/Resium |
| `/map` | DigitalTwin | Cesium/Resium |
| `/campus` | CampusView | React Three Fiber |
| `/research` | ResearchDistricts | Canvas (isometric) |
| `/sandbox` | SandboxPage (JITI) | SSE stream |
| `/profile` | Profile | — |

---

## Data Stores

### PostgreSQL (Railway)

Primary relational store. Shared between Express and EDEN (same database, different schemas logically).

**Express-owned tables**

| Table | Purpose |
|-------|---------|
| `users` | Student profiles (name, email, major, GPA, clubs[], skills[], looking_for[], clerk_id) |
| `connection_requests` | Social connection state machine (pending/accepted/rejected) |
| `user_notifications` | In-app notification inbox |
| `user_chat_memory` | Weighted topic history for JITI personalization |
| `opportunities` | Scraped internships, scholarships, networking events |
| `password_reset_tokens` | Legacy reset flow tokens |

**EDEN-owned tables**

| Table | Purpose |
|-------|---------|
| `clubs` | NJIT club registry (name, Instagram handle, follower count) |
| `events` | Club events with timing, location, engagement prediction scores |
| `event_posts` | Instagram post metrics per event (likes, comments, engagement_score) |
| `event_rsvps` | Student RSVP records |
| `collaborations` | Event co-host relationships |
| `sponsors` | Event sponsor relationships |

**Migration strategy:** Express runs idempotent SQL migrations automatically at startup (`IF NOT EXISTS`). EDEN uses SQLAlchemy models with `create_all`.

---

### Neo4j AuraDB

Graph database. Stores the student social graph — nodes for entities, edges for relationships.

**Node labels**

| Label | Key properties |
|-------|----------------|
| `Student` | id, name, major, gpa, graduationYear, bio, year |
| `Club` | id, name |
| `Company` | id, name |
| `Interest` | id, name |

**Relationships**

| Type | From → To | Created when |
|------|-----------|-------------|
| `MEMBER_OF` | Student → Club | Profile saved with club listed |
| `WORKS_AT` | Student → Company | Profile saved with company listed |
| `INTERESTED_IN` | Student → Interest | Interests overlap with at least one other student |
| `CONNECTED_TO` | Student ↔ Student | Connection request accepted |

**Graph query patterns used**
- `MATCH` all nodes/links → D3 renders full campus graph
- `shortestPath(from, to, maxDepth: 10)` → path mode in CampusGraph
- Scored recommendations: `MATCH` students sharing clubs (×3 weight), interests (×2), major (×2)

---

### Redis (Optional)

Backing store for `express-rate-limit` when `REDIS_URL` is present. Gracefully absent in local development — falls back to in-memory rate limiting. Enables shared rate limit state across multiple Express instances in production.

---

## Authentication Flow

```
Browser                    Clerk                  Express Backend          PostgreSQL / Neo4j
  │                          │                          │                       │
  │──── Sign up (email) ────►│                          │                       │
  │◄─── Clerk session ───────│                          │                       │
  │                          │                          │                       │
  │──── POST /api/auth/sync (Bearer: clerk_token) ─────►│                       │
  │                          │    verifyToken(token)───►│                       │
  │                          │◄────────────────── sub ──│                       │
  │                          │                          │──── INSERT users ─────►│
  │                          │                          │──── MERGE Student ─────►│
  │◄──────────────────────── user JSON ─────────────────│                       │
  │                          │                          │                       │
  │──── GET /api/auth/me (Bearer: clerk_token) ─────────►│                       │
  │◄──────────────────────── user JSON ─────────────────│                       │
  │                          │                          │                       │
  │  (every 50 seconds)      │                          │                       │
  │──── getToken(skipCache) ─►│                          │                       │
  │◄─── fresh JWT ───────────│                          │                       │
```

- Only `@njit.edu` emails pass the `sync` route guard
- `requireAuth` middleware verifies the Clerk JWT and resolves the internal `userId` from `clerk_id` on every protected request
- Token refresh runs every 50 seconds on the frontend (Clerk default TTL is 60 seconds)

---

## Connection System

```
User A                   Express                  PostgreSQL              Neo4j
  │                         │                          │                    │
  │── POST /connections/request ──────────────────────►│                    │
  │                         │── INSERT connection_request (pending) ────────►│
  │                         │                          │                    │
  │ (User B sees notification)                         │                    │
  │── POST /connections/accept ───────────────────────►│                    │
  │                         │── UPDATE status=accepted ────────────────────►│
  │                         │── INSERT user_notifications ─────────────────►│
  │                         │── createConnectionInNeo4j ────────────────────────────►│
  │                         │   MERGE (a)-[:CONNECTED_TO]-(b)                        │
```

Status machine: `none → pending → accepted | rejected`. Rejection returns to `none`.

---

## Events Intelligence Pipeline

```
Instagram (Playwright scraper)
    │
    ▼
event_posts table (likes, comments, captions)
    │
    ▼
Scoring Engine (engagement_score = (likes + comments) / avg_likes_last_10)
    │
    ▼
events table (predicted_engagement_score, event_category)
    │
    ├──► GET /events/upcoming   → EventsPage (upcoming feed)
    ├──► GET /events/trending   → Home dashboard
    ├──► GET /events/heatmap    → Heatmap calendar
    └──► JITI AI tool: search_events
```

**Category classifier** (`classifier.py`): Rule-based keyword matching on event captions to assign one of 12 categories (fundraiser, workshop, hackathon, GBM, social, etc.).

---

## JITI AI Assistant

```
Frontend (SandboxPage)
    │
    │  POST /sandbox/chat/stream
    │  { message, events_context, recommendations_context, memory_context }
    ▼
EDEN /sandbox router (SSE)
    │
    ▼
AsyncAnthropic (claude-haiku-4-5-20251001)
    │
    │  Agentic tool loop (max 4 iterations)
    ├──► search_events(club_name, categories, keyword)  → EDEN DB
    ├──► get_event_details(event_id)                    → EDEN DB
    ├──► get_club_info(club_name)                       → EDEN DB
    └──► find_club_members(club_name, user_token)       → Express /api/connections/club-members
         │
         ▼
    Neo4j + Postgres (scored by shared interests/skills/topics)
```

Context injected into system prompt: upcoming events, trending clubs, user's recommendations, and their weighted chat memory topics (from `user_chat_memory`).

---

## Opportunity Feed

```
Scrapers (every 6 hours via node-cron)
  ├── TheMuse API      → Engineering internships
  ├── Remotive API     → Remote tech jobs
  ├── scholarships.ts  → 12 curated major scholarships (static)
  └── networking.ts    → 10 curated networking events (static)
        │
        ▼
  opportunities table (PostgreSQL)
  geocoder.ts assigns lat/lng by city/state
        │
        ▼
  GET /api/opportunities
        │
        ▼
  OpportunitiesPage
  Cesium Ion globe — markers at lat/lng coordinates
  Filter by type, urgency, location; sort by match/deadline/newest
```

---

## 3D Visualization Stack

| View | Technology | What it renders |
|------|-----------|----------------|
| Digital Twin (`/map`) | Cesium Ion + Resium | Photorealistic 3D globe centered on NJIT campus; building markers |
| Campus View (`/campus`) | React Three Fiber + Three.js | Interactive 3D GLB model of NJIT campus with hotspot markers |
| Opportunities (`/opportunities`) | Cesium Ion + Resium | World globe with opportunity pins by geographic location |
| Campus Graph 3D mode | 3d-force-graph | 3D force-directed network graph of student/club/company nodes |
| Research Districts (`/research`) | HTML Canvas (isometric) | 2D isometric campus building map with pan/zoom/rotate |
| Campus Graph 2D mode | D3 force simulation | 2D force-directed graph, primary network view |

---

## Security Architecture

### Transport
- `enforceHttps` middleware redirects HTTP → HTTPS in production
- `helmet` sets standard security headers (CSP, HSTS, X-Frame-Options, etc.)
- CORS restricted to known frontend origins (configurable via env)

### Authentication
- All protected routes pass through Clerk JWT verification (`verifyClerkSessionToken`)
- `requireAuth` middleware resolves internal `userId` from `clerk_id` on every request
- Only `@njit.edu` email addresses can create accounts (enforced in `/api/auth/sync`)
- Token TTL: Clerk JWTs expire in 60 seconds; frontend refreshes every 50 seconds

### Input Sanitization
- `sanitizeRequestInputs` strips control characters from all incoming body/query/params
- `requireSafeId` validates ID parameters against `[a-zA-Z0-9:_-]{1,128}`
- `sanitizeStringArray` caps array length (50 items max) and item length (80 chars max)
- `sanitizeOptionalHttpsUrl` enforces HTTPS-only URLs
- `toBoundedPositiveInt` prevents integer overflow in numeric params

### Rate Limiting

| Limiter | Limit | Applies to |
|---------|-------|-----------|
| `apiGlobalRateLimiter` | 500 req / 15 min | All `/api` routes |
| `apiWriteRateLimiter` | 120 req / 15 min | POST/PUT/PATCH/DELETE |
| `syncRateLimiter` | 10 req / 15 min | `/api/auth/sync` only |
| `profileUpdateRateLimiter` | 20 req / 15 min | `/api/auth/profile` |
| `connectionActionRateLimiter` | 80 req / 10 min | `/api/connections/*` |

Redis-backed in production for shared state across instances; falls back to in-memory.

### Observability
- `observeApiTraffic` middleware buckets request counts per IP+method; warns at 240+ req/min
- All 4xx/5xx responses are logged with context
- Private database host enforcement configurable via `ENFORCE_PRIVATE_DATABASE=true`

---

## Tech Stack Decisions

### Clerk — Authentication

**Chosen over:** Rolling a custom JWT auth system, Auth0, Supabase Auth.

Clerk handles account creation, session management, password resets, and multi-device logout entirely. The alternative — building custom token issuance, refresh rotation, password hashing, and reset flows — is a significant security surface with no product differentiation. Clerk's `@clerk/clerk-react` + `@clerk/backend` split lets the frontend do full UI (SignIn, SignUp components) while the backend independently verifies tokens without a network call to Clerk (using the published JWT public key). The tradeoff is Clerk version pinning: `@clerk/backend` must stay at v2.x on the Express side to match the Core 2 token format emitted by `@clerk/clerk-react` v5 on the frontend — a documented constraint tracked in the codebase.

---

### Neo4j AuraDB — Graph Database

**Chosen over:** Modeling relationships purely in PostgreSQL (join tables), or using a different graph DB.

The entire `/network` page is a graph traversal problem. Finding shortest paths between students, scoring recommendations by shared connections, and rendering an interactive graph of 100+ nodes and 300+ edges requires a database that thinks natively in nodes and edges. In PostgreSQL, a `connection_requests` table with recursive CTEs can answer "are these two users connected?" but answering "score all students by how many of my clubs/interests they share, across all relationship types simultaneously" becomes a multi-join query that grows in complexity with each new relationship type. In Neo4j, this is a single Cypher `MATCH` clause. New relationship types (`WORKS_AT`, `INTERESTED_IN`) are added without schema migrations — just new relationship creation calls. The `shortestPath` function with `maxDepth: 10` traversing `CONNECTED_TO|MEMBER_OF|INTERESTED_IN|WORKS_AT` is three lines of Cypher; the equivalent SQL is a recursive CTE with multiple UNION branches. Neo4j AuraDB specifically was chosen as the hosted cloud offering — no infrastructure to manage, connects via `neo4j+s://` driver.

---

### PostgreSQL — Relational Store

**Chosen over:** MongoDB, a pure graph approach in Neo4j for all data.

Users, connection requests, opportunities, notifications, and events all have strong relational structure: foreign keys, unique constraints, array columns, `ON CONFLICT` upserts, and aggregation queries (engagement scoring, top clubs by likes). PostgreSQL handles all of this natively. Railway's managed PostgreSQL removes operational overhead (backups, failover, patching). The `pg` pool library gives direct SQL control without an ORM — important for the migration system which runs raw `CREATE TABLE IF NOT EXISTS` statements at startup to keep the schema self-managing without a separate migration CLI.

---

### Redis — Rate Limit Backing Store

**Chosen over:** In-memory rate limiting only, database-backed rate limiting.

In a single-process local dev environment, in-memory rate limiting works fine. In a production deployment with potentially multiple Express instances (e.g., Railway autoscaling), in-memory counters are per-instance — a user could exhaust five instances' counters separately and never be blocked. Redis gives a shared counter store across all instances. The implementation gracefully degrades: if `REDIS_URL` is absent, rate limiting falls back to in-memory. This makes local development frictionless while production stays correctly bounded.

---

### D3.js — 2D Force Graph

**Chosen over:** vis.js, Cytoscape.js, a pre-built graph component.

D3's force simulation gives complete control over node positioning, link rendering, collision detection, and the tick loop. The campus graph needs custom rendering for multiple node types (Student, Club, Company, Interest) with different colors, sizes, and interaction behaviors. D3 also handles the 100+ node graph without performance issues because only SVG/Canvas primitives are redrawn per tick. Pre-built graph libraries abstract away exactly the customization points this feature needs. D3 v7 also integrates cleanly with React 19 by using a `useRef` to attach the simulation to a DOM element outside React's render cycle.

---

### 3d-force-graph — 3D Network View

**Chosen over:** Custom Three.js graph implementation.

The 3D globe mode in CampusGraph is a secondary visualization mode that reuses the same node/link data. `3d-force-graph` wraps Three.js and provides the same force-simulation API as D3 but in 3D — switching between modes requires only swapping the renderer, not rewriting the data layer. The library handles WebGL node rendering, camera controls, and the tick loop internally, reducing the Three.js surface area needed in the codebase.

---

### React Three Fiber / Three.js — Campus 3D Model

**Chosen over:** Babylon.js, Unity WebGL, plain Three.js.

The Campus View page loads a `.glb` 3D model of NJIT and overlays interactive hotspot markers on buildings. React Three Fiber lets the 3D scene be composed with React components (`<Canvas>`, `<OrbitControls>`, `<HotspotMarker>`) rather than imperative Three.js setup code. `@react-three/drei` provides `OrbitControls`, `useGLTF`, `Html` (for DOM overlays in 3D space) and other utilities that would each require a hundred lines of boilerplate in raw Three.js. The result is a 3D scene that integrates cleanly with React state and router.

---

### Cesium Ion + Resium — 3D Globe

**Chosen over:** Mapbox GL, Leaflet, Google Maps, deck.gl.

Two features require a true 3D photorealistic globe: the Digital Twin (building-level view of NJIT campus) and the Opportunities map (worldwide pin placement). Cesium Ion provides the photorealistic Google 3D Tileset — actual building geometry rendered from satellite imagery. No other mapping library offers this at the same fidelity. Resium wraps the Cesium Viewer in React component syntax so scene objects (entities, camera positions, event handlers) compose with React state. The tradeoff is bundle size (`vite-plugin-cesium` copies Cesium's static assets at build time) which is why the Digital Twin and Opportunities pages are lazy-loaded.

---

### FastAPI (Python) — EDEN Events Service

**Chosen over:** Adding events to the Express backend, Django.

Three Python-specific requirements drove the EDEN service: Playwright (headless browser for Instagram scraping — no mature Node equivalent for this use case), the `anthropic` Python SDK (streaming SSE from Claude with agentic tool loops is better supported in the Python SDK), and `APScheduler` (flexible in-process scheduling for the scraper). Keeping these in Python avoids pulling a headless browser runtime and async generator patterns into the Node.js codebase. FastAPI specifically was chosen over Django because EDEN is a pure API with no templates or admin interface — FastAPI's async-first design, automatic OpenAPI docs, and Pydantic model validation are a better fit than Django's batteries for a microservice.

---

### Anthropic Claude (Haiku 4.5) — JITI AI

**Chosen over:** OpenAI GPT, local LLM, GPT-4 class models.

The JITI assistant runs inside an agentic loop that may call 4 tool iterations per user message. At that call volume, cost matters. Claude Haiku 4.5 is the fastest and lowest-cost Claude model while still supporting multi-turn tool use and streaming. The model is configurable via `CLAUDE_MODEL` env var so the team can upgrade to Sonnet or Opus for better reasoning without a code change. The `anthropic` Python SDK's `AsyncAnthropic` client supports SSE natively, which maps directly to FastAPI's `StreamingResponse` — the frontend receives tokens as they're generated rather than waiting for the full response.

---

### Tailwind CSS v4 — Styling

**Chosen over:** CSS Modules, styled-components, Sass, Tailwind v3.

Tailwind v4 integrates directly as a Vite plugin (`@tailwindcss/vite`) — no PostCSS config, no separate build step. The utility-first approach keeps component styles co-located with markup, which is especially important for a codebase with many one-off dashboard widgets. The NJIT design token system (colors, gradients, borders) is expressed as CSS custom properties (`var(--brand-primary)`, `var(--bg-surface)`) defined globally and referenced in Tailwind utility classes and inline styles.

---

### Vite v7 — Build Tool

**Chosen over:** Create React App, Webpack, Parcel.

Vite's ESM-based dev server gives sub-second hot reload even as the codebase grows. The plugin ecosystem (`@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-plugin-cesium`) covers all the project's build requirements without custom webpack configuration. Vitest shares the Vite config for unit tests — no separate Jest config or babel transform setup.

---

### node-cron — Opportunity Scraper Scheduler

**Chosen over:** A separate worker process, Bull/BullMQ queue, external cron service.

The scrapers run every 6 hours and are low-stakes (idempotent `ON CONFLICT DO NOTHING` inserts). Running them in-process with `node-cron` keeps the deployment to a single Express service — no separate worker dyno, no message queue infrastructure. If a scrape fails silently, the next 6-hour run picks it up. This tradeoff (simplicity over reliability) is appropriate for the current scale: a university club events feed.

---

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| React frontend | Vercel | `vercel.json` in frontend; static SPA deployment |
| Express backend | Railway | `DATABASE_URL` auto-injected by Railway |
| PostgreSQL | Railway | Managed Postgres instance |
| EDEN FastAPI | Railway (or similar) | `uvicorn app.main:app` |
| Neo4j | Neo4j AuraDB | Managed cloud graph DB |
| Redis | Optional | Railway Redis or Upstash |

---

## Environment Variables Reference

### Express Backend

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEO4J_URI` | Yes | Neo4j AuraDB URI (`neo4j+s://...`) |
| `NEO4J_USER` | Yes | Neo4j username |
| `NEO4J_PASSWORD` | Yes | Neo4j password |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret |
| `CLERK_JWT_PUBLIC_KEY` | Yes | Clerk JWT public key (PEM) |
| `FRONTEND_URL` | Yes | Allowed CORS origin |
| `REDIS_URL` | No | Redis URI for shared rate limiting |
| `PORT` | No | Defaults to 3001 |
| `NODE_ENV` | No | `production` enables HTTPS redirect |
| `PG_SSL` | No | Set `disable` to turn off SSL |

### EDEN FastAPI

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `AUTH_API_URL` | No | Express backend URL (default: localhost:3001) |
| `CLAUDE_MODEL` | No | Model override (default: `claude-haiku-4-5-20251001`) |

### React Frontend

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_API_URL` | Yes | Express backend base URL |
| `VITE_EVENTS_API_URL` | Yes | EDEN FastAPI base URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `VITE_CESIUM_ION_TOKEN` | Yes | Cesium Ion token for globe |
