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

import { classifyOrgType, type OrgType } from "./orgClassifier.js"

export type { OrgType }

export interface ClubRow {
  club_id: number
  name: string
  instagram_handle: string | null
  follower_count: number | null
  bio: string | null
  /** clubs.type. Nullable: migration 015 may have warned-and-no-opped, and a
   *  row created since the last boot has not been through clubTypeSync yet. */
  type?: string | null
}

export interface SerializedClub {
  club_id: number
  name: string
  display_name: string
  aliases: string[]
  instagram_handle: string | null
  logo_url: string
  /** clubs.bio — the org description. null when the scrape had none (AC 27). */
  bio: string | null
  /** Never null: falls back to classifyOrgType when the column is unset. */
  type: OrgType
  /** normalizeClubText(canonical name) — THE dedup group key. Stars, search and
   *  trending all group on this, so it is serialised rather than recomputed by
   *  each caller (three independent recomputations is three chances to drift). */
  org_key: string
}

/**
 * ALIAS TABLE — expanding this is safe; changing a `display_name` is not.
 *
 * getClubDisplayName feeds the Events page club dropdown AND the Events sidebar
 * podium (eventsService.getClubsTrending), which the Organizations feature is
 * required to leave behaviourally identical. So every entry added for the
 * organizations directory sets `display_name` to the row's own name — the added
 * value is purely in `aliases`, which only affect matching and search.
 *
 * Entries whose `display_name` is a real abbreviation (ACM, IEEE, ...) predate
 * this feature and are unchanged.
 */
const CLUB_METADATA: Record<string, { display_name: string; aliases: string[] }> = {
  "Association for Computing Machinery": { display_name: "ACM", aliases: ["ACM"] },
  "Institute of Electrical and Electronics Engineers": { display_name: "IEEE", aliases: ["IEEE"] },
  "Society of Hispanic Professional Engineers": { display_name: "SHPE", aliases: ["SHPE"] },
  "Society of Women Engineers": { display_name: "SWE", aliases: ["SWE"] },
  "National Society of Black Engineers": { display_name: "NSBE", aliases: ["NSBE"] },
  "American Society of Civil Engineers": { display_name: "ASCE", aliases: ["ASCE"] },
  "American Society of Mechanical Engineers": { display_name: "ASME", aliases: ["ASME"] },
  "American Institute of Chemical Engineers": { display_name: "AIChE", aliases: ["AIChE"] },
  "Google Developer Student Club": { display_name: "GDSC", aliases: ["GDSC", "Google Student Developer Club"] },
  "Student Government Association": { display_name: "SGA", aliases: ["SGA"] },
  "Latino American Student Organization": { display_name: "LASO", aliases: ["LASO"] },
  "Muslim Student Association": { display_name: "MSA", aliases: ["MSA"] },
  "Hispanic Association of Computing College Students": {
    display_name: "HACCS",
    aliases: ["HACCS", "Hispanic and Latine Association of Computing College Students"],
  },

  // ── Added for the Organizations directory ──────────────────────────────────
  // Every entry below exists because an onboarding NJIT_CLUBS option names an
  // organisation that the `clubs` table spells differently, so a connection's
  // profile string resolved to nothing (or worse, to the wrong row) without it.
  // Found by `npm run clubs:check-coverage` against the live 204-row table.
  // NOTE the display_name === key convention explained above: these must not
  // change how any club renders on the Events page.
  "Caribbean Students Organization": {
    display_name: "Caribbean Students Organization",
    aliases: ["Caribbean Student Association", "CaribSO"],
  },
  "Chinese Undergraduate Student Association": {
    display_name: "Chinese Undergraduate Student Association",
    aliases: ["Chinese Student Association", "CUSA"],
  },
  "Engineers Without Borders": {
    display_name: "Engineers Without Borders",
    // The onboarding form says "Engineering"; the org is "Engineers".
    aliases: ["Engineering Without Borders", "EWB"],
  },
  "Entrepreneur Society": {
    display_name: "Entrepreneur Society",
    aliases: ["Entrepreneurship Club"],
  },
  "NJIT Esports": {
    display_name: "NJIT Esports",
    aliases: ["ESports Club", "Esports Club", "Esports"],
  },
  "Finance and Actuarial Society": {
    display_name: "Finance and Actuarial Society",
    aliases: ["Finance Club"],
  },
  "Association of Indian Students": {
    display_name: "Association of Indian Students",
    aliases: ["Indian Student Association", "AIS"],
  },
  "Korean Students Association": {
    display_name: "Korean Students Association",
    // One character apart ("Student" vs "Students"), which is exactly enough to
    // defeat substring matching.
    aliases: ["Korean Student Association", "KSA"],
  },
  "Highlander Chess Club": {
    display_name: "Highlander Chess Club",
    aliases: ["Chess Club"],
  },
  "New Jersey Institute of Technology Soccer Club": {
    display_name: "New Jersey Institute of Technology Soccer Club",
    aliases: ["Soccer Club", "NJIT Soccer Club"],
  },
  "NJIT Volleyball Club": {
    display_name: "NJIT Volleyball Club",
    aliases: ["Volleyball Club"],
  },
  "NJIT Tennis Club": {
    display_name: "NJIT Tennis Club",
    // Without this exact alias, "Tennis Club" partial-matches BOTH this row and
    // "Table Tennis Club", and which one wins is a preference-heuristic coin flip.
    aliases: ["Tennis Club"],
  },
  "Theatre Arts & Technology Program": {
    display_name: "Theatre Arts & Technology Program",
    aliases: ["Theatre Arts Group", "Theater Arts Group"],
  },
  "Women in Computing Society": {
    display_name: "Women in Computing Society",
    // Replaces a "Women in Computer Science" -> WiCS entry that pointed at a
    // canonical name no row has ever carried; the real row is this one.
    aliases: ["Women in Computer Science", "WiCS"],
  },
  "NJIT Biomedical Engineering Society": {
    display_name: "NJIT Biomedical Engineering Society",
    // Replaces a "Biomedical Engineering Society" -> BMES entry whose canonical
    // name no row has ever carried. Without an exact alias, "Biomedical
    // Engineering Society" partial-matches this row AND "Graduate Biomedical
    // Engineering Society", and the preference heuristic picked the GRADUATE
    // chapter — i.e. undergraduates were being matched to the wrong org.
    aliases: ["BMES", "Biomedical Engineering Society"],
  },
  "Society of Physics Students": {
    display_name: "Society of Physics Students",
    aliases: ["Physics Club"],
  },
  "NJIT Information & Cybersecurity Club": {
    display_name: "NJIT Information & Cybersecurity Club",
    aliases: ["Cyber Defense Organization", "Cybersecurity Club"],
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

/** The stored clubs.type, but only when it is one of the three legal values. */
function storedOrgType(raw: string | null | undefined): OrgType | null {
  const value = (raw ?? "").trim().toLowerCase()
  return value === "club" || value === "sorority" || value === "fraternity" ? value : null
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
    bio: club.bio ?? null,
    // The stored column wins; classifying on read is a FALLBACK so the API can
    // never emit a null type on a database where migration 015 warned-and-
    // no-opped or where CLUB_TYPE_SYNC=off. organizationsService counts how
    // often this path is taken and logs the total once per cache fill — a
    // non-zero count is the signal that the schema change did not land.
    type: storedOrgType(club.type) ?? classifyOrgType(canonicalName),
    org_key: normalizeClubText(canonicalName),
  }
}

/** True when serializeClub would have to classify this row on read. */
export function needsTypeFallback(club: ClubRow): boolean {
  return storedOrgType(club.type) === null
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
