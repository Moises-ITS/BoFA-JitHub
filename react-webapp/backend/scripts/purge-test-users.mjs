import fs from "fs"
import path from "path"
import process from "process"
import dotenv from "dotenv"
import { Pool } from "pg"
import neo4j from "neo4j-driver"

const cwd = process.cwd()
for (const candidate of [".env.local", ".env"]) {
  const resolved = path.resolve(cwd, candidate)
  if (fs.existsSync(resolved)) {
    dotenv.config({ path: resolved, override: false })
  }
}

const APPLY = process.argv.includes("--apply")
// --all targets EVERY user row. The default prefix match only ever caught users
// whose id looked like "student-<studentId>" (the shape scripts/seed.js writes).
// Accounts created through the app get a uuid, so the prefix match silently
// matched nothing for them — hence the explicit opt-in for a full clear-out.
const ALL = process.argv.includes("--all")
const ID_PREFIX = "student-"

const databaseUrl = process.env.DATABASE_URL
const neo4jUri = process.env.NEO4J_URI
// NEO4J_USERNAME is the name Aura uses in the credentials file it hands you;
// accept both so this script works with the same .env as the server.
const neo4jUser = process.env.NEO4J_USER ?? process.env.NEO4J_USERNAME
const neo4jPassword = process.env.NEO4J_PASSWORD

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}
if (!neo4jUri || !neo4jUser || !neo4jPassword) {
  throw new Error("NEO4J_URI, NEO4J_USER (or NEO4J_USERNAME), and NEO4J_PASSWORD are required")
}

// Print WHERE this is pointed before doing anything. The single most expensive
// mistake here is running it against production while believing it is staging.
function describeTarget(url) {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`
  } catch {
    return "(unparseable DATABASE_URL)"
  }
}
console.log(`[cleanup] postgres : ${describeTarget(databaseUrl)}`)
console.log(`[cleanup] neo4j    : ${neo4jUri}`)
console.log(`[cleanup] selector : ${ALL ? "--all (EVERY user row)" : `id/graph_node_id LIKE '${ID_PREFIX}%'`}`)
console.log(`[cleanup] mode     : ${APPLY ? "APPLY (destructive)" : "dry run"}`)

// SSL policy mirrors src/config/postgres.ts. It has to: the simpler
// `!== "false"` rule here meant an unset PG_SSL_REJECT_UNAUTHORIZED defaulted
// to strict verification, and Railway's proxy presents a self-signed chain —
// so this script could not connect to the very database the server talks to
// happily. Railway-like hosts relax verification unless explicitly overridden.
const parsedDbUrl = new URL(databaseUrl)
const sslDisabled = process.env.PG_SSL === "disable"
const rejectRaw = process.env.PG_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase()
const isRailwayLikeHost =
  parsedDbUrl.hostname.endsWith(".rlwy.net") || parsedDbUrl.hostname.includes("railway.internal")
const rejectUnauthorized = rejectRaw != null ? rejectRaw !== "false" : !isRailwayLikeHost

const pg = new Pool({
  connectionString: databaseUrl,
  ssl: sslDisabled ? false : { rejectUnauthorized },
})

const neo = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword))

async function main() {
  const userRows = ALL
    ? await pg.query(
        `SELECT id, email, name, graph_node_id, clerk_id FROM users ORDER BY id ASC`
      )
    : await pg.query(
        `SELECT id, email, name, graph_node_id, clerk_id
         FROM users
         WHERE id LIKE $1 OR graph_node_id LIKE $1
         ORDER BY id ASC`,
        [`${ID_PREFIX}%`]
      )

  const ids = userRows.rows.map((r) => String(r.id))
  console.log(`[cleanup] matched postgres test users: ${ids.length}`)
  for (const row of userRows.rows.slice(0, 20)) {
    console.log(` - ${row.id} | ${row.email ?? "no-email"} | clerk_id=${row.clerk_id ?? "null"}`)
  }
  if (userRows.rows.length > 20) {
    console.log(` ... and ${userRows.rows.length - 20} more`)
  }

  if (!ids.length) {
    console.log("[cleanup] nothing to delete.")
    return
  }

  const neoSession = neo.session()
  const neoCountRes = await neoSession.run(
    `MATCH (s)
     WHERE (s:Student OR s:Professor) AND s.id IN $ids
     RETURN count(s) AS count`,
    { ids }
  )
  const neoCount = Number(neoCountRes.records[0]?.get("count") ?? 0)
  console.log(`[cleanup] matched neo4j Student nodes: ${neoCount}`)
  await neoSession.close()

  if (!APPLY) {
    console.log("[cleanup] dry run complete. Re-run with --apply to delete.")
    return
  }

  const client = await pg.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      "DELETE FROM user_notifications WHERE user_id = ANY($1::varchar[]) OR related_user_id = ANY($1::varchar[])",
      [ids]
    )
    await client.query("DELETE FROM user_chat_memory WHERE user_id = ANY($1::text[])", [ids])
    await client.query(
      "DELETE FROM connection_requests WHERE from_user_id = ANY($1::varchar[]) OR to_user_id = ANY($1::varchar[])",
      [ids]
    )
    await client.query("DELETE FROM password_reset_tokens WHERE user_id = ANY($1::varchar[])", [ids])
    await client.query("DELETE FROM users WHERE id = ANY($1::varchar[])", [ids])
    await client.query("COMMIT")
    console.log("[cleanup] postgres delete committed")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  const neoDeleteSession = neo.session()
  try {
    // Professors live under a :Professor label, not :Student — matching only
    // :Student left their nodes behind as orphans after the Postgres row went.
    await neoDeleteSession.run(
      `MATCH (s)
       WHERE (s:Student OR s:Professor) AND s.id IN $ids
       DETACH DELETE s`,
      { ids }
    )
    await neoDeleteSession.run(
      `MATCH (n:Club|Company|Interest)
       WHERE NOT (n)--()
       DELETE n`
    )
    console.log("[cleanup] neo4j delete committed")
  } finally {
    await neoDeleteSession.close()
  }
}

main()
  .catch((err) => {
    console.error("[cleanup] failed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pg.end()
    await neo.close()
  })

