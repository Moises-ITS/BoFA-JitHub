/**
 * organizations.ts — the wire contract for /api/organizations.
 *
 * MIRRORED VERBATIM from backend/src/services/organizationsService.ts. These two
 * files are twins: the backend owns the shapes, this file exists only because the
 * frontend cannot import across the package boundary. If you change one, change
 * the other in the same commit — a silent divergence here type-checks cleanly and
 * fails at runtime.
 *
 * DELIBERATELY ABSENT: any alias/acronym table, and any copy of
 * `normalizeClubText`. Search and type filtering are 100% server-side (the `q`
 * param already matches name, display_name, every duplicate spelling, the
 * Instagram handle, and the ported acronym list). Shipping a client-side alias
 * table would be a second, drifting implementation of search semantics for zero
 * gain — see the technical brief §5.
 */

export type OrgType = "club" | "sorority" | "fraternity"

/** The three real categories plus the unfiltered default the UI adds on top. */
export type OrgTypeFilter = OrgType | "all"

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
  /**
   * Empty for BOTH "this user has no connections at all" and "none of them are
   * in this org". Resolution R2: do not distinguish — one shared empty state
   * covers AC 29 and AC 30.
   */
  connections: OrgConnection[]
}

export interface TrendingOrg {
  /** 1-based. */
  rank: number
  club_id: number
  /** display_name — what the Home panel renders. */
  club_name: string
  star_count: number
}

/** Both star endpoints return this. See starOrganization() for why club_id matters. */
export interface StarResult {
  ok: true
  club_id: number
  star_count: number
}

/** How many organizations one scroll batch fetches (Resolution R5). */
export const ORG_PAGE_SIZE = 24

/** The dropdown's options, in render order. AC 14 wants exactly these four. */
export const ORG_TYPE_FILTERS: ReadonlyArray<{ value: OrgTypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "club", label: "Clubs" },
  { value: "sorority", label: "Sororities" },
  { value: "fraternity", label: "Fraternities" },
]
