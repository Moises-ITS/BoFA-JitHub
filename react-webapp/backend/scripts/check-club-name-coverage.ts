/**
 * check-club-name-coverage.ts — does every onboarding club name resolve to a
 * real `clubs` row?
 *
 * WHY THIS IS A SCRIPT AND NOT A UNIT TEST
 * ----------------------------------------
 * The answer depends on live data: which of the 204 scraped rows currently exist
 * and how they are spelled. A unit test would have to hardcode a fixture of the
 * table, which would then be a second copy of the database that drifts. So this
 * is an ops check you run after touching CLUB_METADATA or the acronym table.
 *
 *   npm run clubs:check-coverage
 *
 * WHAT IT PROVES
 * --------------
 * users.clubs is populated exclusively from the onboarding <select>, so these
 * names are the ONLY strings a profile can contain. Every one that fails to
 * resolve is an organisation whose detail page will show "none of your
 * connections" no matter how many connections are actually in it. That is the
 * failure mode Decision 5 exists to prevent.
 *
 * EXIT CODE
 * ---------
 * Non-zero when a name fails to resolve AND is not listed in
 * ONBOARDING_NAMES_WITHOUT_CLUB_ROW. That exclusion list is the honest part: a
 * handful of onboarding options name organisations that simply have no row (no
 * Instagram handle means the scraper's importer skipped them), and no alias
 * entry can conjure one. Holding the script to "zero unresolved" including those
 * would make its exit code permanently red and therefore worthless.
 *
 * Use --verbose to also print what every name resolved TO, which is how you
 * catch a name that resolves to the WRONG org.
 */
import fs from "fs"
import path from "path"
import process from "process"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// dotenv before anything that reads process.env at import time (config/postgres
// builds its Pool on import) — same pattern as src/index.ts and reconcile-graph.
for (const candidate of [".env.local", ".env"]) {
  const resolved = path.resolve(__dirname, "..", candidate)
  if (fs.existsSync(resolved)) dotenv.config({ path: resolved, override: false })
}

const VERBOSE = process.argv.includes("--verbose")

const [
  { db },
  { findMatchingClub, normalizeClubText, resolveCanonicalClubName, serializeClubCollection },
  { CLUB_ACRONYM_HINTS },
  { ONBOARDING_CLUB_NAMES, ONBOARDING_NAMES_WITHOUT_CLUB_ROW },
] = await Promise.all([
  import("../src/config/postgres.js"),
  import("../src/services/clubDirectory.js"),
  import("../src/services/clubAcronyms.js"),
  import("../src/services/onboardingClubNames.js"),
])

type ClubRow = Parameters<typeof findMatchingClub>[0][number]

async function main(): Promise<number> {
  const { rows } = await db.query<ClubRow>(
    `SELECT c.club_id, c.name, c.instagram_handle, c.follower_count, c.bio, c.type
     FROM clubs c ORDER BY c.name ASC`
  )
  const groups = serializeClubCollection(rows)
  console.log(`clubs rows: ${rows.length}   dedup groups: ${groups.length}`)

  // Same acronym resolution organizationsService performs on each cache fill:
  // bind only when exactly one dedup group matches the search fragment.
  const acronymToGroupKey = new Map<string, string>()
  let ambiguous = 0
  for (const [acronym, hint] of Object.entries(CLUB_ACRONYM_HINTS)) {
    const needle = hint.toLowerCase()
    const matched = new Set<string>()
    for (const row of rows) {
      if (row.name.toLowerCase().includes(needle)) {
        matched.add(normalizeClubText(resolveCanonicalClubName(row.name)))
      }
    }
    if (matched.size === 1) acronymToGroupKey.set(normalizeClubText(acronym), [...matched][0])
    else ambiguous++
  }
  console.log(
    `acronym hints: ${Object.keys(CLUB_ACRONYM_HINTS).length}   bound: ${acronymToGroupKey.size}   unbound/ambiguous: ${ambiguous}`
  )

  const expectedMisses = new Set(ONBOARDING_NAMES_WITHOUT_CLUB_ROW.map(normalizeClubText))
  const unresolved: string[] = []
  const expectedUnresolved: string[] = []
  const staleExclusions: string[] = []
  let resolved = 0

  for (const name of ONBOARDING_CLUB_NAMES) {
    const hit = findMatchingClub(rows, name)
    const groupKey = hit
      ? normalizeClubText(resolveCanonicalClubName(hit.name))
      : acronymToGroupKey.get(normalizeClubText(name)) ?? null
    const isExpectedMiss = expectedMisses.has(normalizeClubText(name))

    if (!groupKey) {
      if (isExpectedMiss) expectedUnresolved.push(name)
      else unresolved.push(name)
      continue
    }

    resolved++
    if (isExpectedMiss) staleExclusions.push(`${name}  ->  ${hit?.name ?? groupKey}`)
    if (VERBOSE) console.log(`  OK  ${name.padEnd(52)} -> ${hit?.name ?? groupKey}`)
  }

  const total = ONBOARDING_CLUB_NAMES.length
  console.log(
    `\nonboarding names: ${total}   resolved: ${resolved}   ` +
      `unresolved(expected, no club row): ${expectedUnresolved.length}   ` +
      `unresolved(UNEXPECTED): ${unresolved.length}`
  )

  if (expectedUnresolved.length > 0) {
    console.log("\nExpected misses (no matching row exists in `clubs`):")
    for (const name of expectedUnresolved) console.log(`  -  ${name}`)
  }

  if (staleExclusions.length > 0) {
    console.log(
      "\nSTALE EXCLUSIONS — these are listed in ONBOARDING_NAMES_WITHOUT_CLUB_ROW but DO resolve now.\n" +
        "Remove them from that list so the script starts holding the alias table to account for them:"
    )
    for (const line of staleExclusions) console.log(`  !  ${line}`)
  }

  if (unresolved.length > 0) {
    console.log(
      "\nFAIL — these onboarding names resolve to nothing. Add an alias entry to\n" +
        "CLUB_METADATA in src/services/clubDirectory.ts (display_name must equal the\n" +
        "canonical key so the Events page keeps rendering identically), or, if the org\n" +
        "genuinely has no row, add it to ONBOARDING_NAMES_WITHOUT_CLUB_ROW with a reason:"
    )
    for (const name of unresolved) console.log(`  X  ${name}`)
    return 1
  }

  console.log("\nPASS — every onboarding name either resolves or is a documented miss.")
  return 0
}

let exitCode = 1
try {
  exitCode = await main()
} catch (err) {
  console.error("check-club-name-coverage failed:", err)
} finally {
  await db.end()
}
process.exit(exitCode)
