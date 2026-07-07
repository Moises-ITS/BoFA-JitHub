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

export const db = new Pool({
  connectionString,
  ssl: sslDisabled ? false : { rejectUnauthorized },
})

db.connect()
  .then(client => {
    console.log("PostgreSQL connected")
    client.release()
  })
  .catch(err => console.error("PostgreSQL connection failed:", err))

// EDEN's separate Postgres — holds clubs/events/rsvps (owned by the FastAPI backend).
// Used read-only by the /api/eden/* routes to join attendance against events.
export const edenDb = new Pool({
  host:     process.env.EDEN_DB_HOST     ?? "localhost",
  port:     Number(process.env.EDEN_DB_PORT) || 5432,
  user:     process.env.EDEN_DB_USER     ?? "postgres",
  password: process.env.EDEN_DB_PASSWORD ?? "Perdomo1107!",
  database: process.env.EDEN_DB_NAME     ?? "eden",
  ssl:      false,
})
