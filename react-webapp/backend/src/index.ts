import { fileURLToPath } from "url"
import path from "path"
import dotenv from "dotenv"
import fs from "fs"
import type { CorsOptions } from "cors"

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
  { startScheduler },
  { runMigrations },
  { ensureNodeIds },
  { apiGlobalRateLimiter, apiWriteRateLimiter },
  { sanitizeRequestInputs },
  { observeApiTraffic },
  { enforceHttps },
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
  import("./scrapers/runner.js"),
  import("./db/migrate.js"),
  import("./services/graphService.js"),
  import("./middlewear/authRateLimit.js"),
  import("./middlewear/security.js"),
  import("./middlewear/observability.js"),
  import("./middlewear/transportSecurity.js"),
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
  const migrationPath = path.resolve(__dirname, "db/migrations/003_opportunities.sql")
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

function normalizeOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin)
    return `${parsed.protocol}//${parsed.host}`.toLowerCase()
  } catch {
    return null
  }
}

const vercelProject =
  (process.env.FRONTEND_VERCEL_PROJECT ?? process.env.VERCEL_PROJECT_NAME ?? "")
    .trim()
    .toLowerCase()
const vercelTeam =
  (process.env.FRONTEND_VERCEL_TEAM ?? process.env.VERCEL_TEAM_SLUG ?? "")
    .trim()
    .toLowerCase()

function isAllowedVercelOrigin(origin: string): boolean {
  if (!vercelProject) return false

  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }

  if (parsed.protocol !== "https:") return false

  const host = parsed.hostname.toLowerCase()
  if (!host.endsWith(".vercel.app")) return false

  if (host === `${vercelProject}.vercel.app`) return true
  if (!host.startsWith(`${vercelProject}-`)) return false
  if (!vercelTeam) return true

  return host.endsWith(`-${vercelTeam}.vercel.app`)
}

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URLS,
]
  .filter(Boolean)
  .flatMap((value) => (value as string).split(","))
  .map((origin) => origin.trim())
  .map((origin) => normalizeOrigin(origin) ?? origin.toLowerCase())
  .filter(Boolean)

const allowedOrigins = new Set<string>([
  ...configuredOrigins,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
])

const corsOptions: CorsOptions = {
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin) {
      callback(null, true)
      return
    }

    const normalized = normalizeOrigin(origin) ?? origin.toLowerCase()
    if (allowedOrigins.has(normalized) || isAllowedVercelOrigin(origin)) {
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
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found" })
})

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  // Kick off scrapers after the server is listening
  startScheduler()
})
