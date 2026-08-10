import { fileURLToPath } from "url"
import path from "path"
import dotenv from "dotenv"
import fs from "fs"
import type { CorsOptions } from "cors"
// Type-only imports are erased at compile time, so they can't defeat the
// "dotenv must run before any env-reading module" ordering below.
import type { Request, Response, NextFunction } from "express"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envCandidates = [
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env.local"),
  path.resolve(__dirname, "../../.env"),
]
for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false })
  }
}

// Dynamic imports ensure dotenv runs before any module that reads process.env
const [
  expressModule,
  { default: cors },
  { default: helmet },
  { default: compression },
  { default: morgan },
  { db },
  ,
  graphMod,
  authMod,
  connMod,
  oppMod,
  chatMemMod,
  buildingsMod,
  eventsMod,
  { attachEventsSocket, closeEventsSocket },
  { startScheduler },
  { runMigrations },
  { ensureNodeIds },
  { apiGlobalRateLimiter, apiWriteRateLimiter },
  { sanitizeRequestInputs },
  { observeApiTraffic },
  { enforceHttps },
  { isAllowedCorsOrigin },
] = await Promise.all([
  import("express"),
  import("cors"),
  import("helmet"),
  import("compression"),
  import("morgan"),
  import("./config/postgres.js"),
  import("./config/neo4j.js"),
  import("./routes/graph.js"),
  import("./routes/auth.js"),
  import("./routes/connections.js"),
  import("./routes/opportunities.js"),
  import("./routes/chatMemory.js"),
  import("./routes/buildings.js"),
  import("./routes/events.js"),
  import("./realtime/eventsSocket.js"),
  import("./scrapers/runner.js"),
  import("./db/migrate.js"),
  import("./services/graphService.js"),
  import("./middleware/authRateLimit.js"),
  import("./middleware/security.js"),
  import("./middleware/observability.js"),
  import("./middleware/transportSecurity.js"),
  import("./utils/origins.js"),
])

try {
  await runMigrations()
  await ensureNodeIds()
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error("Startup migration/setup failed:", msg)
}

// Run the opportunities migration on startup
try {
  const migrationCandidates = [
    path.resolve(__dirname, "db/migrations/003_opportunities.sql"),
    path.resolve(__dirname, "../src/db/migrations/003_opportunities.sql"),
    path.resolve(process.cwd(), "react-webapp/backend/src/db/migrations/003_opportunities.sql"),
    path.resolve(process.cwd(), "src/db/migrations/003_opportunities.sql"),
  ]
  const migrationPath = migrationCandidates.find((candidate) => fs.existsSync(candidate))
  if (!migrationPath) {
    throw new Error("003_opportunities.sql not found in expected locations")
  }
  const sql = fs.readFileSync(migrationPath, "utf8")
  await db.query(sql)
  console.log("Migration 003_opportunities applied")
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  if (!msg.includes("already exists")) {
    console.error("Migration 003 failed:", msg)
  }
}

const express = expressModule.default
const app = express()
app.disable("x-powered-by")
app.set("trust proxy", 1)

// Origin trust rules are shared with Clerk token verification (see
// utils/origins.ts) — they used to be duplicated here and could drift.
const corsOptions: CorsOptions = {
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin) {
      callback(null, true) // same-origin / curl / server-to-server: no Origin header
      return
    }
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true)
      return
    }
    callback(new Error(`CORS blocked for origin ${origin}`))
  },
  credentials: true,
}

app.use(cors(corsOptions))
app.options("*", cors(corsOptions))
app.use(enforceHttps)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}))
app.use(compression())
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"))
app.use(express.json({ limit: "100kb" }))
app.use(express.urlencoded({ extended: false, limit: "100kb" }))
app.set("query parser", "simple")
app.use("/api", apiGlobalRateLimiter)
app.use("/api", sanitizeRequestInputs)
app.use("/api", observeApiTraffic)
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return apiWriteRateLimiter(req, res, next)
  }
  next()
})

app.use("/api/graph", graphMod.default)
app.use("/api/auth", authMod.default)
app.use("/api/connections", connMod.default)
app.use("/api/opportunities", oppMod.default)
app.use("/api/chat-memory", chatMemMod.default)
app.use("/api/buildings", buildingsMod.default)

// Campus events: the feed, student submissions, RSVPs, and the club directory.
// Mounted at /api (not /api/events) because this one router owns three sibling
// path families the frontend already calls: /api/events/*, /api/rsvp/*, and
// /api/clubs. Previously served by the standalone EDEN FastAPI service on port
// 8000, which read this same database; see services/eventsService.ts.
app.use("/api", eventsMod.default)

// EDEN e-board analytics — PARKED for v2/v3, mounted only behind an explicit
// flag. History: these routes were previously wired only in an orphaned second
// entry point (server.ts, now deleted) and thus never actually served, while
// the frontend still linked to them. The flag keeps the revival a one-env-var
// operation without shipping half-finished endpoints to 2000 students today.
// (The EDEN Pool object in config/postgres.ts is constructed either way but
// never opens a connection unless these routes actually run a query.)
if (process.env.ENABLE_EDEN === "true") {
  const edenMod = await import("./routes/eden.js")
  app.use("/api/eden", edenMod.default)
  console.log("[config] EDEN routes mounted at /api/eden (ENABLE_EDEN=true)")
}

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found" })
})

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

// Terminal error handler — MUST be registered after every route. Without it,
// anything thrown outside a route's own try/catch (e.g. the CORS callback's
// Error, or a bug in middleware) falls to Express's default handler, which
// prints an HTML stack trace to the client. Full details stay in server logs;
// clients get a stable JSON shape they can actually parse.
// (The unused `_next` parameter is required — Express identifies error
// middleware by its 4-argument signature.)
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const isCorsRejection = err.message.startsWith("CORS blocked")
  if (!isCorsRejection) {
    console.error("[unhandled-route-error]", { path: req.originalUrl, message: err.message, stack: err.stack })
  }
  if (res.headersSent) return
  res.status(isCorsRejection ? 403 : 500).json({
    error: isCorsRejection ? "Origin not allowed" : "Internal server error",
  })
})

const PORT = process.env.PORT || 3001
const server = app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  // Opportunity scrapers — RETIRED. The opportunities board is student-submitted
  // now (`/api/opportunities` serves `source = 'community'` only), so scraping
  // job boards every 6h would write rows nothing renders while still spending
  // outbound API calls and pool connections. Set ENABLE_SCRAPERS=true to run
  // them again; see src/scrapers/README.md.
  if (process.env.ENABLE_SCRAPERS === "true") {
    console.warn("[scrapers] ENABLE_SCRAPERS=true — running retired opportunity scrapers")
    startScheduler()
  }
})

// Live events feed. Shares the HTTP server so it needs no second port and
// inherits the same TLS termination in production.
attachEventsSocket(server)

// ── Process lifecycle ─────────────────────────────────────────────────────────
// Railway (and any container platform) sends SIGTERM on redeploy/scale-down.
// Without this, in-flight student requests are severed mid-response and pool
// connections are abandoned for Postgres to time out on its side. Order
// matters: stop accepting new connections first, let in-flight requests
// finish, then release DB connections. The 10s force-exit guards against a
// hung request blocking the redeploy forever (platforms hard-kill at ~30s).
let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[lifecycle] ${signal} received — draining connections`)
  const forceExit = setTimeout(() => {
    console.error("[lifecycle] drain timed out after 10s — forcing exit")
    process.exit(1)
  }, 10_000)
  forceExit.unref()
  // Close WebSockets first: server.close() waits for existing connections to
  // end, and an open socket never ends on its own — without this the drain
  // always runs to the 10s force-exit.
  closeEventsSocket()
  server.close(async () => {
    try {
      await db.end()
    } catch (err) {
      console.error("[lifecycle] error closing Postgres pool:", err)
    }
    console.log("[lifecycle] shutdown complete")
    process.exit(0)
  })
}
process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))

// Log-and-continue: a rejected promise nobody awaited (e.g. a fire-and-forget
// scraper insert) should be visible in logs, not crash 2000 students' backend.
// Node's default behavior for unhandledRejection is a process crash.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason)
})
