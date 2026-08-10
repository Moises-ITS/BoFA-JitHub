/**
 * clubDirectory.ts — canonical club names, display abbreviations, and fuzzy
 * name matching.
 *
 * Ported from EDEN's club_directory.py when the events pipeline moved into this
 * backend. The behaviour is deliberately identical: the `clubs` table has 200+
 * rows scraped over time and contains genuine duplicates of the same
 * organisation ("Society of Women Engineers" vs "SWE" vs the Instagram handle),
 * so a single canonical name plus an alias list is what makes the club dropdown
 * and the search box agree with each other.
 *
 * The frontend has its own copy of normalizeClubText/clubNamesEquivalent in
 * pages/events/utils/clubMatching.ts. Both must use the SAME normalisation
 * (strip everything non-alphanumeric, lowercase) or a club the server considers
 * a duplicate will look distinct to the client.
 */

export interface ClubRow {
  club_id: number
  name: string
  instagram_handle: string | null
  follower_count: number | null
  bio: string | null
}

export interface SerializedClub {
  club_id: number
  name: string
  display_name: string
  aliases: string[]
  instagram_handle: string | null
  logo_url: string
}

const CLUB_METADATA: Record<string, { display_name: string; aliases: string[] }> = {
  "Association for Computing Machinery": { display_name: "ACM", aliases: ["ACM"] },
  "Institute of Electrical and Electronics Engineers": { display_name: "IEEE", aliases: ["IEEE"] },
  "Society of Hispanic Professional Engineers": { display_name: "SHPE", aliases: ["SHPE"] },
  "Society of Women Engineers": { display_name: "SWE", aliases: ["SWE"] },
  "National Society of Black Engineers": { display_name: "NSBE", aliases: ["NSBE"] },
  "American Society of Civil Engineers": { display_name: "ASCE", aliases: ["ASCE"] },
  "American Society of Mechanical Engineers": { display_name: "ASME", aliases: ["ASME"] },
  "American Institute of Chemical Engineers": { display_name: "AIChE", aliases: ["AIChE"] },
  "Biomedical Engineering Society": { display_name: "BMES", aliases: ["BMES"] },
  "Google Developer Student Club": { display_name: "GDSC", aliases: ["GDSC", "Google Student Developer Club"] },
  "Student Government Association": { display_name: "SGA", aliases: ["SGA"] },
  "Latino American Student Organization": { display_name: "LASO", aliases: ["LASO"] },
  "Muslim Student Association": { display_name: "MSA", aliases: ["MSA"] },
  "Women in Computer Science": { display_name: "WiCS", aliases: ["WiCS"] },
  "Hispanic Association of Computing College Students": {
    display_name: "HACCS",
    aliases: ["HACCS", "Hispanic and Latine Association of Computing College Students"],
  },
}

export function normalizeClubText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "")
}

const ALIAS_TO_CANONICAL: Map<string, string> = new Map()
for (const [canonicalName, meta] of Object.entries(CLUB_METADATA)) {
  for (const term of [canonicalName, meta.display_name, ...meta.aliases]) {
    const normalized = normalizeClubText(term)
    if (normalized) ALIAS_TO_CANONICAL.set(normalized, canonicalName)
  }
}

export function resolveCanonicalClubName(fullName: string): string {
  return ALIAS_TO_CANONICAL.get(normalizeClubText(fullName)) ?? fullName
}

export function getClubDisplayName(fullName: string): string {
  const canonicalName = resolveCanonicalClubName(fullName)
  return CLUB_METADATA[canonicalName]?.display_name ?? fullName
}

/** Dedupe by normalized form while preserving the first-seen original spelling. */
function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const value of values) {
    const cleaned = (value ?? "").trim()
    const normalized = normalizeClubText(cleaned)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    unique.push(cleaned)
  }
  return unique
}

export function getClubAliases(
  fullName: string,
  instagramHandle?: string | null,
  extraAliases: Array<string | null | undefined> = []
): string[] {
  const canonicalName = resolveCanonicalClubName(fullName)
  const meta = CLUB_METADATA[canonicalName]
  const aliases: Array<string | null | undefined> = [
    fullName,
    canonicalName,
    getClubDisplayName(fullName),
    ...(meta?.aliases ?? []),
    ...extraAliases,
  ]
  const handle = (instagramHandle ?? "").trim().replace(/^@/, "")
  if (handle) aliases.push(handle, `@${handle}`)
  return uniqueStrings(aliases)
}

/**
 * When several rows describe the same club, this picks which one the dropdown
 * shows. Ordered by descending significance, matching EDEN's tuple comparison:
 * prefer the row already spelled canonically, then one with richer metadata,
 * then the larger following, then (as a stable tie-break) the lower club_id —
 * the older row, which is the one existing events are most likely linked to.
 */
function comparePreference(a: ClubRow, b: ClubRow): number {
  const key = (club: ClubRow): number[] => [
    club.name === resolveCanonicalClubName(club.name) ? 1 : 0,
    (club.instagram_handle ?? "").trim() ? 1 : 0,
    (club.bio ?? "").trim() ? 1 : 0,
    club.follower_count ?? 0,
    (club.name ?? "").length,
    -(club.club_id ?? 0),
  ]
  const ka = key(a)
  const kb = key(b)
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] - kb[i]
  }
  return 0
}

function preferred(clubs: ClubRow[]): ClubRow {
  return clubs.reduce((best, club) => (comparePreference(club, best) > 0 ? club : best))
}

export function serializeClub(club: ClubRow, extraAliases: Array<string | null | undefined> = []): SerializedClub {
  const canonicalName = resolveCanonicalClubName(club.name)
  return {
    club_id: club.club_id,
    name: canonicalName,
    display_name: getClubDisplayName(canonicalName),
    aliases: getClubAliases(canonicalName, club.instagram_handle, extraAliases),
    instagram_handle: club.instagram_handle,
    logo_url: `/club_pics/${club.club_id}.jpg`,
  }
}

/** Collapse duplicate rows for the same organisation into one directory entry. */
export function serializeClubCollection(clubs: ClubRow[]): SerializedClub[] {
  const grouped = new Map<string, ClubRow[]>()
  for (const club of clubs) {
    const key = normalizeClubText(resolveCanonicalClubName(club.name))
    const group = grouped.get(key)
    if (group) group.push(club)
    else grouped.set(key, [club])
  }

  const serialized: SerializedClub[] = []
  for (const group of grouped.values()) {
    // Every spelling in the group becomes an alias, so searching any of the
    // merged duplicates still finds the single surviving entry.
    const extraAliases = group.flatMap(club => getClubAliases(club.name, club.instagram_handle))
    serialized.push(serializeClub(preferred(group), extraAliases))
  }

  serialized.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  return serialized
}

/**
 * Resolve free-text ("SHPE", "@njitshpe", "Society of Hispanic...") to a club
 * row. Exact alias hits win outright; a partial hit is only trusted when it is
 * unambiguous or clearly the strongest candidate.
 */
export function findMatchingClub(clubs: ClubRow[], query: string): ClubRow | null {
  const normalizedQuery = normalizeClubText(query)
  if (!normalizedQuery) return null

  const exact: ClubRow[] = []
  const partial: ClubRow[] = []

  for (const club of clubs) {
    const terms = new Set(
      getClubAliases(club.name, club.instagram_handle).map(normalizeClubText).filter(Boolean)
    )
    if (terms.has(normalizedQuery)) {
      exact.push(club)
      continue
    }
    for (const term of terms) {
      if (normalizedQuery.includes(term) || term.includes(normalizedQuery)) {
        partial.push(club)
        break
      }
    }
  }

  if (exact.length > 0) return preferred(exact)
  if (partial.length > 0) return preferred(partial)
  return null
}
