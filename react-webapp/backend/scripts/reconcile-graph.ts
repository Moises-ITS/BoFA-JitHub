/**
 * reconcile-graph.ts — rebuilds missing Neo4j projections from Postgres.
 *
 * WHY THIS EXISTS
 * ---------------
 * Postgres owns identity; Neo4j is a projection of it used for discovery.
 * Signup writes Postgres first, then attempts the graph write through
 * safeGraphWrite(), which swallows failures so an unreachable or paused Aura
 * instance can never block account creation. The price of that choice is
 * drift: a user can exist without a graph node.
 *
 * `users.graph_node_id` is the marker. It is set ONLY after a projection
 * lands, so `WHERE graph_node_id IS NULL` is exactly the set of rows still
 * owed a node. This script drains that queue.
 *
 * WHY TYPESCRIPT, NOT .mjs LIKE THE OTHER SCRIPTS
 * ----------------------------------------------
 * It calls createStudentNode()/createProfessorNode() directly instead of
 * re-implementing their Cypher. A hand-copied version drifted immediately —
 * the real student path uses WORKS_AT (not WORKED_AT) and only creates an
 * Interest node when another student already shares that interest. Importing
 * the real functions makes reconciled nodes identical to signup-created ones
 * by construction, which is the entire point of the script.
 *
 *   npx tsx scripts/reconcile-graph.ts           # dry run: report only
 *   npx tsx scripts/reconcile-graph.ts --apply   # actually write
 *
 * Safe to re-run: every write is a MERGE on the user id, so replaying a row
 * that already has a node updates it in place rather than duplicating.
 * Run after deploys and after any Neo4j outage.
 */
import fs from "fs"
import path from "path"
import process from "process"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// dotenv must run before anything that reads process.env at module load —
// config/neo4j.ts builds its driver on import, so the service modules below
// are pulled in dynamically AFTER this loop (same pattern as src/index.ts).
for (const candidate of [".env.local", ".env"]) {
  const resolved = path.resolve(__dirname, "..", candidate)
  if (fs.existsSync(resolved)) dotenv.config({ path: resolved, override: false })
}

const APPLY = process.argv.includes("--apply")

const [{ db }, { createStudentNode, createProfessorNode }] = await Promise.all([
  import("../src/config/postgres.js"),
  import("../src/services/graphService.js"),
])

interface UserRow {
  id: string
  name: string | null
  major: string | null
  gpa: string | number | null
  graduation_year: number | null
  bio: string | null
  clubs: string[] | null
  companies: string[] | null
  interests: string[] | null
  linkedin_url: string | null
  department: string | null
  user_type: string | null
}

async function main() {
  console.log(`[reconcile] neo4j : ${process.env.NEO4J_URI}`)
  console.log(`[reconcile] mode  : ${APPLY ? "APPLY" : "dry run"}`)

  // Guests are intentionally absent from the graph, so they are never owed a
  // node and must not sit in the queue forever. A NULL user_type is treated as
  // 'student', matching the `|| "student"` default used across the routes.
  const { rows } = await db.query(
    `SELECT id, name, major, gpa, graduation_year, bio, clubs, companies,
            interests, linkedin_url, department, user_type
     FROM users
     WHERE graph_node_id IS NULL
       AND (user_type IS NULL OR user_type <> 'guest')
     ORDER BY id ASC`
  )
  const users = rows as UserRow[]

  console.log(`[reconcile] rows needing a projection: ${users.length}`)
  for (const row of users.slice(0, 20)) {
    console.log(`  - ${row.id} | ${row.name ?? "no-name"} | ${row.user_type ?? "student (null)"}`)
  }
  if (users.length > 20) console.log(`  ... and ${users.length - 20} more`)

  if (!users.length) return
  if (!APPLY) {
    console.log("[reconcile] dry run complete. Re-run with --apply to write.")
    return
  }

  let ok = 0
  let failed = 0
  for (const row of users) {
    try {
      const interests = Array.isArray(row.interests) ? row.interests : []
      if (row.user_type === "professor") {
        await createProfessorNode({
          id: row.id,
          name: row.name ?? "Professor",
          department: row.department ?? "",
          interests,
          bio: row.bio,
          linkedinUrl: row.linkedin_url,
        })
      } else {
        await createStudentNode({
          id: row.id,
          name: row.name ?? "Student",
          major: row.major ?? "",
          gpa: row.gpa == null ? null : Number(row.gpa),
          graduationYear: row.graduation_year ?? null,
          bio: row.bio ?? "",
          clubs: Array.isArray(row.clubs) ? row.clubs : [],
          companies: Array.isArray(row.companies) ? row.companies : [],
          interests,
          linkedinUrl: row.linkedin_url,
        })
      }
      // Same marker the signup path sets: the graph node id IS the user id.
      await db.query("UPDATE users SET graph_node_id = $1 WHERE id = $2", [row.id, row.id])
      ok += 1
    } catch (err) {
      failed += 1
      console.error(`[reconcile] FAILED ${row.id}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`[reconcile] done. projected=${ok} failed=${failed}`)
  if (failed > 0) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error("[reconcile] failed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.end()
    process.exit(process.exitCode ?? 0)
  })
