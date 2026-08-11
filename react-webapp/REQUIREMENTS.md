# Project Requirements

## Tech Stack

| Layer         | Technology                                      | Version          |
|---------------|-------------------------------------------------|------------------|
| Frontend      | React, TypeScript, Vite                         | React 19, Vite 7 |
| Visualization | D3.js                                           | v7               |
| Routing       | React Router DOM                                | v7               |
| Backend       | Node.js, Express, TypeScript (via `tsx`)        | Express 4        |
| Graph DB      | Neo4j AuraDB                                    | Driver v5        |
| Relational DB | PostgreSQL (hosted on Railway)                  | Driver v8        |
| Cache         | Redis (optional cache + smoke-tested)           | redis v5         |
| Auth          | Clerk (`@clerk/clerk-react` + `@clerk/backend`) | Clerk v5/Core 2  |
| Hosting       | Vercel (frontend) + Railway (backend)           |                  |

---

## Updates (2026-04-09)

| Area | Update |
|------|--------|
| Frontend graph | Skill Tree mode removed |
| Frontend graph | 2.5D Isometric mode removed; supported modes are 2D and 3D |
| Backend startup | `src/index.ts` refactored to a single bootstrap flow |
| Redis | Added robust Redis config parsing and optional startup connect |
| Redis | Added `npm run redis:smoke` for connect + set/get/delete verification |
| CI | `react-webapp/.github/workflows/ci.yml` now uses explicit working directories and optional Redis smoke test |

---

## Prerequisites

Install these before anything else:

- **Node.js v20 or higher** — required by Vite 7
  - Download: https://nodejs.org (choose LTS)
  - Verify: `node -v`
- **npm v9 or higher** — comes with Node.js
  - Verify: `npm -v`
- **Git**
  - Verify: `git --version`

You also need credentials from a teammate for:
- Neo4j AuraDB (URI, username, password)
- Railway PostgreSQL (host, port, user, password, database name)
- Clerk keys (`CLERK_SECRET_KEY`, `CLERK_JWT_PUBLIC_KEY`, frontend publishable key)
- Redis connection URL (`redis://` or `rediss://`) if cache features are enabled

---

## Repository Structure

```
react-webapp/
├── REQUIREMENTS.md
├── README.md
├── frontend/                    # React + Vite app
│   ├── index.html
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Router + AuthProvider
│   ├── .env.local               # Your local env vars (create this)
│   ├── package.json
│   ├── context/
│   │   └── AuthContext.tsx      # Auth state, login/signup/logout
│   └── pages/
│       ├── auth/                # Login + Signup pages
│       │   ├── LoginPage.tsx
│       │   ├── SignupPage.tsx
│       │   └── auth.css
│       ├── node/                # Campus Graph — D3 force-directed graph
│       │   ├── CampusGraph.tsx
│       │   ├── CampusGraph.css
│       │   ├── types/
│       │   ├── constants/
│       │   ├── hooks/           # useGraphData (fetches from backend)
│       │   ├── utils/
│       │   └── components/      # SidePanel, FilterBar, SearchBar, Legend
│       ├── events/              # (planned)
│       ├── opportunities/       # (planned)
│       ├── research/            # (planned)
│       └── SharedComponents/
│           ├── Navbar.tsx
│           └── ProtectedRoute.tsx
└── backend/                     # Express API
    ├── .env                     # Your local env vars (create this)
    ├── package.json
    └── src/
        ├── index.ts             # Server entry point (port 3001)
        ├── config/
        │   ├── neo4j.ts         # Neo4j driver setup
        │   └── postgres.ts      # PostgreSQL pool setup
        ├── middlewear/
        │   └── auth.ts          # requireAuth JWT middleware
        ├── routes/
        │   ├── graph.ts         # /api/graph/*
        │   ├── auth.ts          # /api/auth/*
        │   └── connections.ts   # /api/connections/*
        ├── services/
        │   └── graphService.ts  # Neo4j queries + createStudentNode
        └── db/
            └── migrations/
                ├── 001_initial.sql
                └── 002_auth.sql  # Auth fields + connection_requests table
```

---

## Step-by-Step Local Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd react-webapp
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Install backend dependencies

```bash
cd ../backend
npm install
```

### 4. Create `frontend/.env.local`

```
VITE_API_URL=http://localhost:3001
```

### 5. Create `backend/.env`

```
PORT=3001
FRONTEND_URL=http://localhost:3000

# Neo4j AuraDB
NEO4J_URI=neo4j+s://<your-instance>.databases.neo4j.io
NEO4J_USER=<your-neo4j-username>
NEO4J_PASSWORD=<your-neo4j-password>

# PostgreSQL (Railway)
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
DB_HOST=<host>
DB_PORT=<port>
DB_USER=<user>
DB_PASSWORD=<password>
DB_NAME=<database>

# Clerk auth
CLERK_SECRET_KEY=sk_test_...
# Optional — enables local token verification instead of a call to Clerk
CLERK_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
<paste PEM key here>
-----END PUBLIC KEY-----"

# Redis cache (optional but recommended)
# Must be redis:// or rediss:// (not postgresql://)
REDIS_URL=rediss://default:<password>@<host>:<port>
# Optional: multiple instances for smoke test
# REDIS_URLS=rediss://... , rediss://...
```

### 6. Run the database migration

This adds the auth columns and connection_requests table to your PostgreSQL database.
Only needs to be run once (safe to re-run — skips if already applied).

```bash
cd backend
npx tsx src/db/migrate.ts
```

Expected output:
```
PostgreSQL connected
Migration 002_auth.sql applied successfully
```

### 7. Run the backend

Open **Terminal 1** from the `backend/` folder:

```bash
npm run dev
```

Expected output:
```
Backend running on port 3001
PostgreSQL connected
Neo4j connected
```

Verify:
```bash
curl http://localhost:3001/health
# expected: {"status":"ok"}
```

### 8. Run the frontend

Open **Terminal 2** from the `frontend/` folder:

```bash
npm run dev
```

Open **http://localhost:3000** — you will be redirected to `/login`.

---

## All Available Scripts

### Frontend (`frontend/`)

| Command           | What it does                                   |
|-------------------|------------------------------------------------|
| `npm run dev`     | Start Vite dev server on http://localhost:3000 |
| `npm run build`   | Compile to `dist/` for production              |
| `npm run preview` | Serve the production build locally             |
| `npm run lint`    | Run ESLint                                     |

### Backend (`backend/`)

| Command                          | What it does                              |
|----------------------------------|-------------------------------------------|
| `npm run dev`                    | Start Express with hot-reload via tsx     |
| `npm run build`                  | Compile TypeScript to `dist/`             |
| `npm run start`                  | Run compiled `dist/index.js` (production) |
| `npm run redis:smoke`            | Redis connect + set/get/delete smoke test |
| `npx tsx src/db/migrate.ts`      | Run pending SQL migrations                |

---

## Backend Dependencies

### Runtime

| Package          | Purpose                                        |
|------------------|------------------------------------------------|
| `express`        | HTTP server framework                          |
| `cors`           | Cross-origin request handling                  |
| `dotenv`         | Load `.env` files                              |
| `pg`             | PostgreSQL client                              |
| `neo4j-driver`   | Neo4j database driver                          |
| `@clerk/backend` | Verify Clerk session tokens in backend routes  |
| `redis`          | Redis client for cache-backed features         |
| `bcryptjs`       | Hash and compare passwords                     |
| `uuid`           | Generate unique user IDs                       |
| `express-rate-limit` | Rate limiting middleware                  |

### Dev / Type Definitions

| Package               | Purpose                        |
|-----------------------|--------------------------------|
| `tsx`                 | Run TypeScript directly        |
| `typescript`          | TypeScript compiler            |
| `@types/express`      | Express type definitions       |
| `@types/cors`         | CORS type definitions          |
| `@types/pg`           | PostgreSQL type definitions    |
| `@types/node`         | Node.js type definitions       |
| `@types/jsonwebtoken` | JWT type definitions           |
| `@types/bcryptjs`     | bcryptjs type definitions      |
| `@types/uuid`         | uuid type definitions          |

---

## Frontend Dependencies

### Runtime

| Package                | Purpose                                    |
|------------------------|--------------------------------------------|
| `react`                | UI library                                 |
| `react-dom`            | DOM rendering                              |
| `react-router-dom`     | Client-side routing                        |
| `d3`                   | Force-directed graph visualization         |
| `@supabase/supabase-js`| (installed, currently unused)              |

### Dev

| Package                      | Purpose                         |
|------------------------------|---------------------------------|
| `vite`                       | Build tool + dev server         |
| `@vitejs/plugin-react`       | React JSX transform for Vite    |
| `typescript`                 | TypeScript support              |
| `eslint`                     | Linting                         |
| `eslint-plugin-react-hooks`  | React hooks lint rules          |
| `eslint-plugin-react-refresh`| Vite HMR lint rules             |

---

## Environment Variables Reference

### `frontend/.env.local`

| Variable       | Required | Local Value             | Description                    |
|----------------|----------|-------------------------|--------------------------------|
| `VITE_API_URL` | Yes      | `http://localhost:3001` | Backend base URL for API calls. Must be the **backend** port (3001), never the Vite dev port — pointing it at the frontend makes every API call return `index.html` as a silent 200 |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | `pk_test_...` | Clerk frontend key, passed to `<ClerkProvider>`. Public by design (ships in the browser bundle). This is NOT `CLERK_SECRET_KEY` or `CLERK_JWT_PUBLIC_KEY`, which are backend-only |

### `backend/.env`

| Variable         | Required | Description                                          |
|------------------|----------|------------------------------------------------------|
| `PORT`           | No       | Express listen port. Defaults to `3001`              |
| `FRONTEND_URL`   | Yes      | CORS allowed origin. `http://localhost:3000` locally |
| `CLERK_SECRET_KEY` | Yes    | Clerk backend secret key (`sk_...`)                  |
| `CLERK_JWT_PUBLIC_KEY` | No  | PEM (quoted, multi-line). Verifies session tokens locally; without it `utils/clerkToken.ts` falls back to `CLERK_SECRET_KEY` + a network call to Clerk. Recommended in production. Never put `pk_...`/`sk_...` here — those are rejected silently |
| `NEO4J_URI`      | Yes      | Neo4j AuraDB connection URI (`neo4j+s://...`)        |
| `NEO4J_USER`     | Yes      | Neo4j username                                       |
| `NEO4J_PASSWORD` | Yes      | Neo4j password                                       |
| `DATABASE_URL`   | Yes      | Full PostgreSQL connection string                    |
| `DB_HOST`        | Yes      | PostgreSQL host                                      |
| `DB_PORT`        | Yes      | PostgreSQL port                                      |
| `DB_USER`        | Yes      | PostgreSQL username                                  |
| `DB_PASSWORD`    | Yes      | PostgreSQL password                                  |
| `DB_NAME`        | Yes      | PostgreSQL database name                             |
| `REDIS_URL`      | No       | Primary Redis URI (`redis://` or `rediss://`)        |
| `REDIS_URLS`     | No       | Comma-separated Redis URIs for multi-instance checks |

---

## API Endpoints

### Public

| Method | Route               | Description                   |
|--------|---------------------|-------------------------------|
| GET    | `/health`           | Server health check           |
| POST   | `/api/auth/signup`  | Register a new user           |
| POST   | `/api/auth/login`   | Login and receive a JWT token |

### Protected (requires `Authorization: Bearer <token>` header)

| Method | Route                       | Description                                    |
|--------|-----------------------------|------------------------------------------------|
| GET    | `/api/auth/me`              | Get current user profile                       |
| GET    | `/api/graph/nodes`          | All graph nodes from Neo4j                     |
| GET    | `/api/graph/links`          | All graph edges from Neo4j                     |
| POST   | `/api/connections/request`  | Send a connection request to another user      |
| POST   | `/api/connections/accept`   | Accept an incoming connection request          |
| POST   | `/api/connections/reject`   | Reject an incoming connection request          |
| GET    | `/api/connections/pending`  | List incoming pending connection requests      |
| GET    | `/api/connections`          | List all accepted connections                  |

---

## Database Schema

### PostgreSQL (`001_initial.sql` + `002_auth.sql`)

```sql
-- Core user account (auth + profile)
users (
  id              VARCHAR PRIMARY KEY,       -- UUID
  email           VARCHAR UNIQUE NOT NULL,
  name            VARCHAR,
  password_hash   VARCHAR,                   -- bcrypt hash
  major           VARCHAR,
  gpa             DECIMAL(3,2),              -- 0.00 – 4.00
  graduation_year INTEGER,
  bio             TEXT,
  clubs           TEXT[],                    -- club names
  companies       TEXT[],                    -- company/internship names
  graph_node_id   VARCHAR,                   -- Neo4j node id (same as id)
  created_at      TIMESTAMP DEFAULT NOW()
)

-- Two-way connection request system
connection_requests (
  id           SERIAL PRIMARY KEY,
  from_user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR DEFAULT 'pending',   -- pending | accepted | rejected
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
)

-- Other tables: scholarships, internships, applications (see 001_initial.sql)
```

### Neo4j (Graph Database)

**Node types:** `student`, `club`, `company`, `professor`

**Relationships:**
| Relationship    | From    | To              | Created when                        |
|-----------------|---------|-----------------|-------------------------------------|
| `MEMBER_OF`     | student | club            | Student lists club during signup    |
| `WORKS_AT`      | student | company         | Student lists company during signup |
| `CONNECTED_TO`  | student | student         | Connection request is accepted      |

---

## Auth Flow

### Sign Up
1. User fills 4-step form: Account → Academic → Campus Life → Profile
2. `POST /api/auth/signup` — backend hashes password, inserts into PostgreSQL, creates Student node in Neo4j (with `MEMBER_OF` / `WORKS_AT` relationships), returns JWT
3. JWT stored in `localStorage`, user redirected to `/`

### Login
1. `POST /api/auth/login` — backend verifies password hash, returns JWT + user object
2. JWT stored in `localStorage`, user redirected to `/`

### Session Persistence
- On app load, `AuthContext` reads token from `localStorage` and calls `GET /api/auth/me` to validate it
- If token is invalid or expired, user is redirected to `/login`
- JWT tokens expire after **7 days**

### Connection Requests
1. User A sends request → `POST /api/connections/request` (status: `pending`)
2. User B sees it via `GET /api/connections/pending`
3. User B accepts → `POST /api/connections/accept` → status set to `accepted` in PostgreSQL + `CONNECTED_TO` relationship created in Neo4j (bidirectional)
4. Either user can see their accepted connections at `GET /api/connections`

---

## Pages

| Page     | Route     | Auth     | Description                                       |
|----------|-----------|----------|---------------------------------------------------|
| Login    | `/login`  | Public   | Email + password login                            |
| Sign Up  | `/signup` | Public   | 4-step registration form                          |
| Graph    | `/`       | Required | D3 force-directed campus graph                    |
| Events   | `/events` | Planned  | Club event calendar + budget tracking             |
| Opps     | `/opportunities` | Planned | Job/internship smart feed                  |
| Research | `/research` | Planned | Professor research project matching             |

---

## Production Deployment

### Vercel (frontend)

Settings → Environment Variables:
```
VITE_API_URL=https://your-backend.railway.app
```

### Railway (backend)

Variables tab:
```
PORT=3001
FRONTEND_URL=https://your-app.vercel.app
CLERK_SECRET_KEY=...
CLERK_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY-----"
NEO4J_URI=...
NEO4J_USER=...
NEO4J_PASSWORD=...
DATABASE_URL=...  (Railway sets this automatically if using Railway Postgres)
REDIS_URL=rediss://...  (public endpoint for local/CI checks)
```

If you use Railway private hostnames like `redis.railway.internal`, they resolve only inside Railway network and will fail from local machines/CI runners.

After deploying to Railway for the first time, run the migration once:
```bash
railway run npx tsx src/db/migrate.ts
```
