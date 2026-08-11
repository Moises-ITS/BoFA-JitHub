/**
 * orgRanking.ts — the ordering contract for the star-based trending panel.
 *
 * PURE MODULE. IT MUST IMPORT NOTHING (see the header of orgClassifier.ts for
 * why: backend tests run in a node environment with no database).
 *
 * THE DECISION 4 REDUCTION — do not "fix" this without reading it.
 * Decision 4 states the tiebreak as: "compare the created_at of the Nth star for
 * each org, where N = the tied count; the earlier timestamp wins." For an org
 * that has exactly `star_count` stars, the Nth star (N = star_count) IS its most
 * recent star. So "reached that count first" is exactly "has the earlier
 * MAX(created_at)". The tiebreak is only ever consulted when the counts are
 * equal, which is precisely the case where that identity holds — so no window
 * function and no per-star history is needed, just MAX(created_at).
 */

export interface TrendingRow {
  /** normalizeClubText(canonical name) — the dedup group key. Unique per org. */
  group_key: string
  star_count: number
  /** MAX(org_stars.created_at) across every duplicate club_id in the group. */
  latest_star_at: Date
}

function toMillis(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime()
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Applies the exact ORDER BY the trending SQL uses, in JS:
 *
 *   star_count     DESC   (AC 32)
 *   latest_star_at ASC    (AC 33 — Decision 4's tiebreak, per the reduction above)
 *   group_key      ASC    (determinism)
 *
 * The group_key term is not decoration. Two orgs can share a created_at to the
 * microsecond (same request batch, a coarse clock, a restored dump). Without a
 * total order the executor is free to return either first and this test suite
 * would be flaky. group_key is a normalised name, unique per group, so adding
 * it makes the order total.
 *
 * Returns a new array; the input is not mutated.
 */
export function rankTrendingRows(rows: TrendingRow[]): TrendingRow[] {
  return [...rows].sort((a, b) => {
    if (a.star_count !== b.star_count) return b.star_count - a.star_count
    const at = toMillis(a.latest_star_at)
    const bt = toMillis(b.latest_star_at)
    if (at !== bt) return at - bt
    return a.group_key < b.group_key ? -1 : a.group_key > b.group_key ? 1 : 0
  })
}
