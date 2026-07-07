import { Pool } from "pg"

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase()
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true
  if (h.startsWith("172.")) {
    const second = Number.parseInt(h.split(".")[1] ?? "", 10)
    if (second >= 16 && second <= 31) return true
  }
  if (h.endsWith(".internal") || h.endsWith(".local")) return true
  return false
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is required")
}

let parsedDbUrl: URL
try {
  parsedDbUrl = new URL(connectionString)
  const privateHost = isPrivateHost(parsedDbUrl.hostname)
  const isProduction = process.env.NODE_ENV === "production"
  const enforcePrivateDb = process.env.ENFORCE_PRIVATE_DATABASE === "true" && isProduction
  if (!privateHost) {
    const msg =
      "Database host appears publicly routable. Restrict DB access using private networking, firewall allowlists, or a managed proxy."
    if (enforcePrivateDb) {
      throw new Error(msg)
    }
    console.warn(`[security][deployment] ${msg}`)
  }
} catch (err) {
  if (err instanceof Error && err.message.includes("Database host appears")) throw err
  throw new Error("DATABASE_URL is not a valid URL")
}

const sslDisabled = process.env.PG_SSL === "disable"
const pgRejectUnauthorizedRaw = process.env.PG_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase()
const isRailwayLikeHost =
  parsedDbUrl.hostname.endsWith(".rlwy.net") ||
  parsedDbUrl.hostname.includes("railway.internal")

const rejectUnauthorized =
  pgRejectUnauthorizedRaw != null
    ? pgRejectUnauthorizedRaw !== "false"
    : !isRailwayLikeHost

if (!sslDisabled && !rejectUnauthorized) {
  console.warn("[security][deployment] PG_SSL_REJECT_UNAUTHORIZED=false weakens TLS verification.")
}

/**
 * Pool sizing/timeouts, tuned for ~2000 students on a small number of instances:
 * - max: pg's default is 10; overridable per environment (PG_POOL_MAX) because
 *   the right number depends on the Postgres plan's connection cap divided by
 *   instance count — a config decision, not a code decision.
 * - connectionTimeoutMillis: without it, a checkout against an exhausted pool
 *   waits FOREVER; 5s turns a saturated pool into a fast, visible 500 instead
 *   of an ever-growing queue of hung requests.
 * - statement_timeout: without it, one runaway query holds its connection
 *   indefinitely and the pool bleeds out one connection at a time. 10s is far
 *   above any legitimate query here.
 */
const poolMax = Number.parseInt(process.env.PG_POOL_MAX ?? "", 10)
const statementTimeoutMs = Number.parseInt(process.env.PG_STATEMENT_TIMEOUT_MS ?? "", 10)

export const db = new Pool({
  connectionString,
  ssl: sslDisabled ? false : { rejectUnauthorized },
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
  connectionTimeoutMillis: 5_000,
  statement_timeout: Number.isFinite(statementTimeoutMs) && statementTimeoutMs > 0 ? statementTimeoutMs : 10_000,
})

// Idle clients can be dropped by the server/network (Railway restarts, LB
// timeouts). Without this handler that emits an 'error' event on the pool,
// which is FATAL to the Node process if unhandled — the classic "backend
// randomly dies at 3am" bug. Logging is the correct response: the pool
// discards the broken client and mints a new one on the next checkout.
db.on("error", (err) => {
  console.error("[postgres] idle client error (connection dropped; pool will recover):", err.message)
})

db.connect()
  .then(client => {
    console.log("PostgreSQL connected")
    client.release()
  })
  .catch(err => console.error("PostgreSQL connection failed:", err))

// EDEN's separate Postgres — holds clubs/events/rsvps (owned by the FastAPI backend).
// Used read-only by the /api/eden/* routes (mounted only when ENABLE_EDEN=true).
// SECURITY: credentials come exclusively from env — a previous version shipped a
// hardcoded fallback password in source, which is never acceptable. Constructing
// the Pool without a password is harmless (pg connects lazily); if EDEN is
// enabled without credentials, the loud startup warning below explains the
// auth failures that will follow.
export const edenDb = new Pool({
  host:     process.env.EDEN_DB_HOST     ?? "localhost",
  port:     Number(process.env.EDEN_DB_PORT) || 5432,
  user:     process.env.EDEN_DB_USER     ?? "postgres",
  password: process.env.EDEN_DB_PASSWORD,
  database: process.env.EDEN_DB_NAME     ?? "eden",
  ssl:      false,
  max: 5,
  connectionTimeoutMillis: 5_000,
})

edenDb.on("error", (err) => {
  console.error("[postgres][eden] idle client error (pool will recover):", err.message)
})

if (process.env.ENABLE_EDEN === "true" && !process.env.EDEN_DB_PASSWORD) {
  console.warn(
    "[config] ENABLE_EDEN=true but EDEN_DB_PASSWORD is not set — /api/eden queries will fail to authenticate."
  )
}
