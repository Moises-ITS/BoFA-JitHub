/**
 * organizationsService.ts — every query and every rule behind the Organizations
 * directory. routes/organizations.ts is a thin shell over this file.
 *
 * WHY FILTERING AND PAGINATION HAPPEN HERE AND NOT IN SQL
 * ------------------------------------------------------
 * The `clubs` table contains genuine duplicate rows for the same organisation,
 * and the dedup key is normalizeClubText(resolveCanonicalClubName(name)) — a
 * value computed in TypeScript that exists in no column. LIMIT/OFFSET in SQL
 * would therefore slice RAW rows, and a page boundary landing between two
 * duplicates of one org would emit that org twice across two pages. That breaks
 * AC 39 in the ugliest possible way. Dedup has to see the whole set.
 *
 * Since the service already holds the full deduped list, filtering here costs one
 * Array.filter over ~180 entries and buys ONE implementation of search
 * semantics. The payoff is structural: the frontend needs no alias data, no
 * acronym table, and no third copy of the normalisation. All of that stays
 * server-side.
 */

import { db } from "../config/postgres.js"
import { CLUB_ACRONYM_HINTS } from "./clubAcronyms.js"
import {
  findMatchingClub,
  needsTypeFallback,
  normalizeClubText,
  resolveCanonicalClubName,
  serializeClubCollection,
  type ClubRow,
} from "./clubDirectory.js"
import type { OrgType } from "./orgClassifier.js"
import { rankTrendingRows, type TrendingRow } from "./orgRanking.js"

export type { OrgType }

// ── Wire types (mirrored verbatim in frontend/pages/organizations/types) ─────

export interface Organization {
  /** The surviving row's id after dedup. Stable key for stars, logos, routes. */
  club_id: number
  /** Canonical full name (resolveCanonicalClubName). */
  name: string
  /** Abbreviation when one exists, else identical to `name`. */
  display_name: string
  /** clubs.bio. null when the scrape had no description (AC 27). */
  bio: string | null
  type: OrgType
  instagram_handle: string | null
  /** Always `/club_pics/{club_id}.jpg`. May 404 — ClubAvatar handles it (AC 28). */
  logo_url: string
  /** Stars across ALL users, already summed over duplicate rows (AC 37, AC 39). */
  star_count: number
}

export interface OrganizationListResponse {
  organizations: Organization[]
  /** Count AFTER search+type filtering, BEFORE pagination. */
  total: number
  limit: number
  offset: number
  /** offset + organizations.length < total */
  has_more: boolean
}

export interface OrgConnection {
  user_id: string
  name: string
  major: string | null
  /** The exact profile string that matched, e.g. "SWE". For UI attribution. */
  matched_via: string
}

export interface OrganizationDetail extends Organization {
  connections: OrgConnection[]
}

export interface TrendingOrg {
  rank: number
  club_id: number
  /** display_name — what the Home panel renders. */
  club_name: string
  star_count: number
}

export class OrgValidationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "OrgValidationError"
  }
}

export const ORG_TYPES: readonly OrgType[] = ["club", "sorority", "fraternity"]

export function isOrgType(value: unknown): value is OrgType {
  return typeof value === "string" && (ORG_TYPES as readonly string[]).includes(value)
}

// ── Directory snapshot ───────────────────────────────────────────────────────

/** One deduped organisation plus everything the service needs to work with it. */
interface DirectoryEntry {
  /** star_count is always 0 in the snapshot — counts are merged in per request. */
  org: Organization
  org_key: string
  /** Normalised strings this org matches on: name, display_name, aliases, acronyms. */
  searchTerms: string[]
  /** EVERY club_id in the dedup group, not just the survivor's. */
  clubIds: number[]
}

interface DirectorySnapshot {
  at: number
  /** Sorted by name ASC — a stable order, which offset pagination requires. */
  entries: DirectoryEntry[]
  byGroupKey: Map<string, DirectoryEntry>
  /** Every duplicate's club_id maps to its group's entry, so an old link resolves. */
  byClubId: Map<number, DirectoryEntry>
  /** Raw rows, kept for findMatchingClub during connection resolution. */
  clubRows: ClubRow[]
  /** Parallel arrays for the `unnest` mapping in the trending/count queries. */
  mappingClubIds: number[]
  mappingGroupKeys: string[]
  acronymToGroupKey: Map<string, string>
}

/**
 * NEW INFRASTRUCTURE, flagged deliberately: a 60s in-process memo.
 *
 * Re-running serializeClubCollection over 200 rows on every 24-row scroll batch
 * is pure waste — the club list changes when someone submits an event for an
 * unknown org, which is a handful of times per semester. Invalidated on TTL only.
 *
 * It holds NO per-user data: star counts are merged in after the cache read and
 * "did I star this" never enters it. If the backend is ever scaled to more than
 * one replica the worst case is two workers up to 60s out of sync on a club
 * rename. Acceptable at this scale, and stated here so it is a decision rather
 * than an accident.
 */
let directoryCache: DirectorySnapshot | null = null
const DIRECTORY_TTL_MS = 60_000

/** Test/ops seam — drops the memo so the next read rebuilds from the database. */
export function invalidateDirectoryCache(): void {
  directoryCache = null
}

async function loadClubRows(): Promise<ClubRow[]> {
  const { rows } = await db.query<ClubRow>(
    `SELECT c.club_id, c.name, c.instagram_handle, c.follower_count, c.bio, c.type
     FROM clubs c
     ORDER BY c.name ASC`
  )
  return rows
}

function buildSnapshot(clubRows: ClubRow[]): DirectorySnapshot {
  const serialized = serializeClubCollection(clubRows)

  // Group the RAW rows by the same key serializeClubCollection used, so every
  // duplicate's club_id is known to the group that survived.
  const rowsByGroup = new Map<string, ClubRow[]>()
  for (const row of clubRows) {
    const key = normalizeClubText(resolveCanonicalClubName(row.name))
    const bucket = rowsByGroup.get(key)
    if (bucket) bucket.push(row)
    else rowsByGroup.set(key, [row])
  }

  const entries: DirectoryEntry[] = []
  const byGroupKey = new Map<string, DirectoryEntry>()
  const byClubId = new Map<number, DirectoryEntry>()
  const mappingClubIds: number[] = []
  const mappingGroupKeys: string[] = []

  for (const club of serialized) {
    const groupRows = rowsByGroup.get(club.org_key) ?? []
    const entry: DirectoryEntry = {
      org: {
        club_id: club.club_id,
        name: club.name,
        display_name: club.display_name,
        bio: club.bio,
        type: club.type,
        instagram_handle: club.instagram_handle,
        logo_url: club.logo_url,
        star_count: 0,
      },
      org_key: club.org_key,
      searchTerms: uniqueNormalized([club.name, club.display_name, ...club.aliases]),
      clubIds: groupRows.map(r => r.club_id),
    }
    entries.push(entry)
    byGroupKey.set(entry.org_key, entry)
    for (const id of entry.clubIds) {
      byClubId.set(id, entry)
      mappingClubIds.push(id)
      mappingGroupKeys.push(entry.org_key)
    }
  }

  const acronymToGroupKey = resolveAcronyms(clubRows, byGroupKey, entries)

  return {
    at: Date.now(),
    entries,
    byGroupKey,
    byClubId,
    clubRows,
    mappingClubIds,
    mappingGroupKeys,
    acronymToGroupKey,
  }
}

function uniqueNormalized(values: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  for (const value of values) {
    const normalized = normalizeClubText(value)
    if (normalized) out.add(normalized)
  }
  return [...out]
}

/**
 * Bind each ported EDEN acronym to a dedup group, or skip it.
 *
 * CLUB_ACRONYM_HINTS values are search FRAGMENTS ("acm" -> "Computing
 * Machinery"), so resolution is a case-insensitive substring scan over
 * clubs.name. An acronym is only bound when EXACTLY ONE dedup group matches:
 * ambiguity must never silently pick a winner, because the losing org would then
 * be unreachable by its own acronym and nobody would ever find out why. A skip
 * is logged once per cache fill, which is how you notice that the ported table
 * has drifted from the current `clubs` rows.
 */
function resolveAcronyms(
  clubRows: ClubRow[],
  byGroupKey: Map<string, DirectoryEntry>,
  entries: DirectoryEntry[]
): Map<string, string> {
  const bound = new Map<string, string>()
  const unresolved: Array<{ acronym: string; hint: string; matchCount: number }> = []

  for (const [acronym, hint] of Object.entries(CLUB_ACRONYM_HINTS)) {
    const needle = hint.toLowerCase()
    const matched = new Set<string>()
    for (const row of clubRows) {
      if (row.name.toLowerCase().includes(needle)) {
        matched.add(normalizeClubText(resolveCanonicalClubName(row.name)))
      }
    }
    if (matched.size !== 1) {
      unresolved.push({ acronym, hint, matchCount: matched.size })
      continue
    }
    const groupKey = [...matched][0]
    if (!byGroupKey.has(groupKey)) continue
    bound.set(normalizeClubText(acronym), groupKey)
  }

  // Make every bound acronym searchable on its org, so `q=swe` works without the
  // frontend ever seeing the acronym table.
  for (const [normalizedAcronym, groupKey] of bound) {
    const entry = byGroupKey.get(groupKey)
    if (entry && !entry.searchTerms.includes(normalizedAcronym)) {
      entry.searchTerms.push(normalizedAcronym)
    }
  }

  for (const miss of unresolved) console.warn("[orgs][acronym-unresolved]", miss)
  console.info("[orgs][acronyms]", {
    total: Object.keys(CLUB_ACRONYM_HINTS).length,
    bound: bound.size,
    unresolved: unresolved.length,
    orgs: entries.length,
  })
  return bound
}

async function getSnapshot(): Promise<DirectorySnapshot> {
  const cached = directoryCache
  if (cached && Date.now() - cached.at < DIRECTORY_TTL_MS) return cached

  const startedAt = Date.now()
  const clubRows = await loadClubRows()
  const snapshot = buildSnapshot(clubRows)
  directoryCache = snapshot

  // Aggregated, not per-row: a database where migration 015 warned-and-no-opped
  // would otherwise emit ~200 identical lines per request. A non-zero count here
  // is THE signal that the column is missing or the reconciler is off.
  const fallbacks = clubRows.filter(needsTypeFallback)
  if (fallbacks.length > 0) {
    console.warn("[orgs][type-fallback]", {
      count: fallbacks.length,
      sample: fallbacks.slice(0, 3).map(r => r.name),
    })
  }
  console.info("[orgs][directory-cache]", {
    rows: clubRows.length,
    groups: snapshot.entries.length,
    durationMs: Date.now() - startedAt,
  })
  return snapshot
}

// ── Star aggregation ─────────────────────────────────────────────────────────

/**
 * Total stars per dedup GROUP.
 *
 * The dedup key lives in TypeScript, so it is handed to Postgres as two parallel
 * arrays and unnested into a join table. Every duplicate club_id for one org
 * shares a group_key, so their stars sum into a single row and can never split
 * across the duplicates (AC 39) — including stars written by any future path
 * that skips the canonicalisation on the write side.
 *
 * INNER JOIN, not LEFT: a star pointing at a club_id that no longer exists in
 * `clubs` simply drops out of every read.
 */
async function loadStarAggregates(snapshot: DirectorySnapshot, limit?: number): Promise<TrendingRow[]> {
  if (snapshot.mappingClubIds.length === 0) return []

  const params: unknown[] = [snapshot.mappingClubIds, snapshot.mappingGroupKeys]
  let limitClause = ""
  if (limit != null) {
    params.push(limit)
    limitClause = `LIMIT $3`
  }

  const { rows } = await db.query<{ group_key: string; star_count: number; latest_star_at: Date }>(
    `WITH mapping AS (
       SELECT * FROM unnest($1::int[], $2::text[]) AS m(club_id, group_key)
     )
     SELECT m.group_key,
            COUNT(*)::int     AS star_count,
            MAX(s.created_at) AS latest_star_at
     FROM org_stars s
     JOIN mapping m ON m.club_id = s.club_id
     GROUP BY m.group_key
     ORDER BY star_count DESC,
              latest_star_at ASC,
              m.group_key ASC
     ${limitClause}`,
    params
  )
  return rows.map(r => ({
    group_key: r.group_key,
    star_count: Number(r.star_count) || 0,
    latest_star_at: r.latest_star_at,
  }))
}

async function starCountForGroup(clubIds: number[]): Promise<number> {
  if (clubIds.length === 0) return 0
  const { rows } = await db.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM org_stars WHERE club_id = ANY($1::int[])",
    [clubIds]
  )
  return Number(rows[0]?.n) || 0
}

function withStarCount(entry: DirectoryEntry, counts: Map<string, number>): Organization {
  return { ...entry.org, star_count: counts.get(entry.org_key) ?? 0 }
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export interface ListOrganizationsParams {
  q?: string | null
  type?: OrgType | null
  limit: number
  offset: number
}

export async function listOrganizations(params: ListOrganizationsParams): Promise<OrganizationListResponse> {
  const snapshot = await getSnapshot()
  const aggregates = await loadStarAggregates(snapshot)
  const counts = new Map(aggregates.map(a => [a.group_key, a.star_count]))

  // Search: normalised substring against name, display_name, every merged
  // duplicate's spelling, the Instagram handle, and any bound acronym. That is
  // what makes "SWE" find "Society of Women Engineers" (AC 11).
  const needle = normalizeClubText(params.q)
  const filtered = snapshot.entries.filter(entry => {
    if (params.type && entry.org.type !== params.type) return false
    if (!needle) return true
    return entry.searchTerms.some(term => term.includes(needle))
  })

  const page = filtered.slice(params.offset, params.offset + params.limit)
  const organizations = page.map(entry => withStarCount(entry, counts))

  return {
    organizations,
    total: filtered.length,
    limit: params.limit,
    offset: params.offset,
    has_more: params.offset + organizations.length < filtered.length,
  }
}

/**
 * Canonical (post-dedup) club ids the user has starred, so the frontend can
 * `has()` them straight against Organization.club_id. Stars recorded against a
 * duplicate row still map to the survivor.
 */
export async function getStarredClubIds(userId: string): Promise<number[]> {
  const snapshot = await getSnapshot()
  const { rows } = await db.query<{ club_id: number }>(
    "SELECT club_id FROM org_stars WHERE user_id = $1",
    [userId]
  )
  const canonical = new Set<number>()
  for (const row of rows) {
    const entry = snapshot.byClubId.get(row.club_id)
    if (entry) canonical.add(entry.org.club_id)
  }
  return [...canonical].sort((a, b) => a - b)
}

/** Cap on the connections list; a profile-string scan is cheap but the payload is not. */
const CONNECTIONS_LIMIT = 50

export async function getOrganizationDetail(clubId: number, userId: string): Promise<OrganizationDetail | null> {
  const snapshot = await getSnapshot()
  // Resolving through byClubId rather than matching the survivor's id means an
  // old link to a non-surviving duplicate lands on the right org instead of 404.
  const entry = snapshot.byClubId.get(clubId)
  if (!entry) return null

  const [starCount, connections] = await Promise.all([
    starCountForGroup(entry.clubIds),
    loadOrgConnections(snapshot, entry, userId),
  ])

  return { ...entry.org, star_count: starCount, connections }
}

/**
 * Which of the caller's accepted connections list this org on their profile.
 *
 * The query duplicates the CASE-join shape of GET /api/connections rather than
 * calling it, because that route does not select u.clubs and routes/connections.ts
 * is explicitly out of scope for this feature.
 */
async function loadOrgConnections(
  snapshot: DirectorySnapshot,
  entry: DirectoryEntry,
  userId: string
): Promise<OrgConnection[]> {
  const { rows } = await db.query<{ id: string; name: string | null; major: string | null; clubs: string[] | null }>(
    `SELECT u.id, u.name, u.major, u.clubs
     FROM connection_requests cr
     JOIN users u ON u.id = CASE
       WHEN cr.from_user_id = $1 THEN cr.to_user_id
       ELSE cr.from_user_id
     END
     WHERE (cr.from_user_id = $1 OR cr.to_user_id = $1)
       AND cr.status = 'accepted'`,
    [userId]
  )

  const matches: OrgConnection[] = []
  for (const row of rows) {
    const profileClubs = Array.isArray(row.clubs) ? row.clubs : []
    for (const raw of profileClubs) {
      const groupKey = resolveProfileClubString(snapshot, raw)
      if (groupKey !== entry.org_key) continue
      // De-duplicate by user: a profile can list both "SWE" and "Society of
      // Women Engineers", and the same person must not appear twice.
      matches.push({
        user_id: row.id,
        name: row.name ?? "Anonymous",
        major: row.major ?? null,
        matched_via: raw,
      })
      break
    }
  }

  matches.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  return matches.slice(0, CONNECTIONS_LIMIT)
}

/**
 * A profile string ("SWE", "Chess Club", "@njitshpe") to a dedup group key.
 * findMatchingClub first — exact alias hits win outright and partials are only
 * trusted when unambiguous — then the ported acronym map as a fallback.
 */
function resolveProfileClubString(snapshot: DirectorySnapshot, raw: string): string | null {
  const text = (raw ?? "").trim()
  if (!text) return null

  const hit = findMatchingClub(snapshot.clubRows, text)
  if (hit) return normalizeClubText(resolveCanonicalClubName(hit.name))

  return snapshot.acronymToGroupKey.get(normalizeClubText(text)) ?? null
}

export type StarAction = "add" | "remove"

export interface StarResult {
  ok: true
  club_id: number
  star_count: number
}

/**
 * Star / unstar, always against the CANONICAL club_id so a star can never land
 * on a duplicate row the directory does not show. Both directions are
 * idempotent: double-clicking is safe.
 */
export async function setStar(userId: string, clubId: number, action: StarAction): Promise<StarResult> {
  const snapshot = await getSnapshot()
  const entry = snapshot.byClubId.get(clubId)
  if (!entry) {
    console.warn("[orgs][star-failed]", { action, userId, clubId, reason: "unknown_organization" })
    throw new OrgValidationError("Not found", 404)
  }

  const canonicalId = entry.org.club_id
  try {
    if (action === "add") {
      // DO NOTHING, not DO UPDATE: re-starting must not reset created_at, or a
      // user could re-click their way up the Decision 4 trending tiebreak.
      await db.query(
        `INSERT INTO org_stars (user_id, club_id) VALUES ($1, $2)
         ON CONFLICT (user_id, club_id) DO NOTHING`,
        [userId, canonicalId]
      )
    } else {
      // Deletes across every duplicate id, so a star recorded before this
      // feature canonicalised writes still clears.
      await db.query(
        "DELETE FROM org_stars WHERE user_id = $1 AND club_id = ANY($2::int[])",
        [userId, entry.clubIds]
      )
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.warn("[orgs][star-failed]", { action, userId, clubId: canonicalId, reason })
    throw err
  }

  const starCount = await starCountForGroup(entry.clubIds)
  console.info("[orgs][star]", {
    action,
    userId,
    clubId: canonicalId,
    groupKey: entry.org_key,
    starCount,
    ok: true,
  })
  return { ok: true, club_id: canonicalId, star_count: starCount }
}

/** The star-based Home ranking. Empty array when nothing is starred (AC 35/38). */
export async function getTrendingOrgs(limit: number): Promise<TrendingOrg[]> {
  const startedAt = Date.now()
  const snapshot = await getSnapshot()
  const rows = await loadStarAggregates(snapshot, limit)

  // Belt and braces: the SQL is already ordered, but re-applying the pure
  // ranking here means the ordering contract has exactly one definition and it
  // is the one the unit tests exercise.
  const ranked: TrendingRow[] = rankTrendingRows(rows)

  const trending: TrendingOrg[] = []
  for (const row of ranked) {
    const entry = snapshot.byGroupKey.get(row.group_key)
    if (!entry) continue // group vanished between the snapshot and the query
    trending.push({
      rank: trending.length + 1,
      club_id: entry.org.club_id,
      club_name: entry.org.display_name,
      star_count: row.star_count,
    })
  }

  console.info("[orgs][trending]", {
    limit,
    // Capped at `limit` by the query; only its zero-ness is meaningful, and
    // zero is exactly the AC 35 "hide the whole panel" condition.
    groupsWithStars: rows.length,
    returned: trending.length,
    durationMs: Date.now() - startedAt,
  })
  return trending
}
