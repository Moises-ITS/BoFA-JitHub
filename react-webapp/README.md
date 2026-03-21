# JitHub — React Web App

Full-stack web app: React + Vite frontend, Express + TypeScript backend, PostgreSQL (Railway), Neo4j (AuraDB), Clerk auth.

---

## Prerequisites

- Node.js 18+
- npm 9+
- Access to the Railway PostgreSQL database
- Access to the Neo4j AuraDB instance
- Access to the Clerk dashboard (ask project owner for keys)

---

## Setup

### 1. Clone and install

```bash
# Install frontend deps
cd react-webapp/frontend
npm install

# Install backend deps
cd ../backend
npm install
```

### 2. Environment variables

#### `backend/.env`

Create this file with the following variables:

```
DATABASE_URL=postgresql://...          # Railway connection string
DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=railway

NEO4J_URI=neo4j+s://...               # AuraDB URI
NEO4J_USER=...
NEO4J_PASSWORD=...

FRONTEND_URL=http://localhost:5173
PORT=3001

CLERK_SECRET_KEY=sk_test_...          # From Clerk Dashboard > API Keys
CLERK_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
<paste PEM key here, keep the quotes and line breaks>
-----END PUBLIC KEY-----"
```

> **CLERK_JWT_PUBLIC_KEY** — get this from Clerk Dashboard > API Keys > "JWT Public Key".
> It must be wrapped in double quotes in the `.env` file and include the `-----BEGIN/END PUBLIC KEY-----` header/footer lines exactly as shown above.
> Without this, token verification will fail on every request.

#### `frontend/.env.local`

```
VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...   # From Clerk Dashboard > API Keys
```

---

## Running locally

```bash
# Terminal 1 — backend (auto-runs DB migrations on start)
cd react-webapp/backend
npm run dev

# Terminal 2 — frontend
cd react-webapp/frontend
npm run dev
```

Or run both at once from the frontend directory:

```bash
cd react-webapp/frontend
npm run dev:all
```

Frontend: http://localhost:5173
Backend: http://localhost:3001

---

## Critical dependency note — `@clerk/backend`

The backend uses `@clerk/backend@^2.33.1` (the `latest-v5` npm tag).

**Do NOT upgrade to `^3.x` or later.** Version 3+ ("Core 3") cannot verify tokens issued by `@clerk/clerk-react@5.x` ("Core 2"), which is what the frontend uses. Every authenticated request will return `401 Invalid token` if the backend is on v3.

```json
"@clerk/backend": "^2.33.1"   <- correct
"@clerk/backend": "^3.x.x"    <- breaks token verification
```

---

## Auth flow

Authentication is handled entirely by Clerk. PostgreSQL stores profile data only.

1. User signs up via Clerk (`/signup`) — Clerk handles email verification
2. On first login, the backend auto-creates a PostgreSQL + Neo4j profile from Clerk user data
3. On subsequent logins, Clerk validates the session and the backend loads the profile by `clerk_id`
4. Only `@njit.edu` email addresses are accepted

---

## Database migrations

Migrations run automatically when the backend starts. They are idempotent (safe to run multiple times). Current migrations:

| Migration | Description |
|-----------|-------------|
| 001_create_users | Base users table |
| 002_auth_columns | Auth-related columns |
| 002_connection_requests | Connection requests table |
| 003_interests | Interests array column |
| 004_graph_node_id | Neo4j node ID column |
| 005_linkedin | LinkedIn URL column |
| 006_password_reset | Password reset tokens (legacy, unused) |
| 007_clerk_id | `clerk_id` column linking Postgres users to Clerk accounts |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, Clerk React |
| Backend | Express, TypeScript, tsx (dev), Clerk Backend SDK |
| Auth | Clerk (accounts + session tokens) |
| Primary DB | PostgreSQL via Railway |
| Graph DB | Neo4j AuraDB |
| Routing | React Router v7 |
| Animations | Motion (Framer Motion v12) |
| Graph viz | D3.js v7 |
