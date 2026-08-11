import { describe, it, expect } from "vitest"
import { rankTrendingRows, type TrendingRow } from "./orgRanking.js"

/**
 * FIXTURE NOTE — read before "fixing" anything here.
 *
 * `latest_star_at` is MAX(org_stars.created_at) for the group, and comparing it
 * ascending IS Decision 4's tiebreak. Decision 4 words the rule as "compare the
 * created_at of the Nth star for each org, where N = the tied count". For an org
 * with exactly `star_count` stars, the Nth star is its most recent star — so
 * "reached that count first" reduces exactly to "has the earlier MAX(created_at)".
 * The reduction is only relied on when the counts are equal, which is the only
 * situation the tiebreak is ever consulted in. No window function needed.
 */

const at = (iso: string) => new Date(iso)

describe("rankTrendingRows", () => {
  it("orders by star_count descending (AC 32)", () => {
    const rows: TrendingRow[] = [
      { group_key: "b", star_count: 2, latest_star_at: at("2026-01-01T00:00:00Z") },
      { group_key: "a", star_count: 9, latest_star_at: at("2026-01-01T00:00:00Z") },
      { group_key: "c", star_count: 5, latest_star_at: at("2026-01-01T00:00:00Z") },
    ]
    expect(rankTrendingRows(rows).map(r => r.group_key)).toEqual(["a", "c", "b"])
  })

  it("breaks a tie in favour of the org that got there first (AC 33)", () => {
    // 1ms apart: the smallest gap that can exist and still be a real ordering.
    const rows: TrendingRow[] = [
      { group_key: "late", star_count: 3, latest_star_at: at("2026-03-01T12:00:00.001Z") },
      { group_key: "early", star_count: 3, latest_star_at: at("2026-03-01T12:00:00.000Z") },
    ]
    expect(rankTrendingRows(rows).map(r => r.group_key)).toEqual(["early", "late"])
  })

  it("count outranks timestamp — a later org with more stars still wins", () => {
    const rows: TrendingRow[] = [
      { group_key: "few-but-early", star_count: 3, latest_star_at: at("2020-01-01T00:00:00Z") },
      { group_key: "many-but-late", star_count: 4, latest_star_at: at("2026-01-01T00:00:00Z") },
    ]
    expect(rankTrendingRows(rows).map(r => r.group_key)).toEqual(["many-but-late", "few-but-early"])
  })

  it("is deterministic on a full three-way tie, and stable under shuffling", () => {
    // Two orgs CAN share a created_at to the microsecond — same request batch, a
    // coarse clock, a restored dump. Without the group_key term the executor
    // could return any order and this suite would be flaky.
    const same = at("2026-05-05T05:05:05Z")
    const rows: TrendingRow[] = [
      { group_key: "charlie", star_count: 7, latest_star_at: same },
      { group_key: "alpha", star_count: 7, latest_star_at: same },
      { group_key: "bravo", star_count: 7, latest_star_at: same },
    ]
    const expected = ["alpha", "bravo", "charlie"]
    expect(rankTrendingRows(rows).map(r => r.group_key)).toEqual(expected)
    expect(rankTrendingRows([...rows].reverse()).map(r => r.group_key)).toEqual(expected)
    expect(rankTrendingRows([rows[1], rows[2], rows[0]]).map(r => r.group_key)).toEqual(expected)
  })

  it("applies all three keys together", () => {
    const rows: TrendingRow[] = [
      { group_key: "zeta", star_count: 2, latest_star_at: at("2026-01-01T00:00:00Z") },
      { group_key: "beta", star_count: 5, latest_star_at: at("2026-01-02T00:00:00Z") },
      { group_key: "alpha", star_count: 5, latest_star_at: at("2026-01-02T00:00:00Z") },
      { group_key: "gamma", star_count: 5, latest_star_at: at("2026-01-01T00:00:00Z") },
      { group_key: "delta", star_count: 2, latest_star_at: at("2025-12-31T00:00:00Z") },
    ]
    expect(rankTrendingRows(rows).map(r => r.group_key)).toEqual([
      "gamma", // 5 stars, earliest
      "alpha", // 5 stars, later timestamp, wins the key tiebreak
      "beta",  // 5 stars, same timestamp as alpha
      "delta", // 2 stars, earliest
      "zeta",  // 2 stars
    ])
  })

  it("returns [] for [] — zero starred orgs is the AC 35 hidden-panel case", () => {
    expect(rankTrendingRows([])).toEqual([])
  })

  it("does not mutate its input", () => {
    const rows: TrendingRow[] = [
      { group_key: "b", star_count: 1, latest_star_at: at("2026-01-01T00:00:00Z") },
      { group_key: "a", star_count: 9, latest_star_at: at("2026-01-01T00:00:00Z") },
    ]
    rankTrendingRows(rows)
    expect(rows.map(r => r.group_key)).toEqual(["b", "a"])
  })

  it("tolerates timestamps that arrive as strings rather than Date objects", () => {
    // pg is configured to parse TIMESTAMP into Date, but this fold is also the
    // documented pure seam for tests and any future caller.
    const rows = [
      { group_key: "late", star_count: 3, latest_star_at: "2026-03-01T12:00:01Z" },
      { group_key: "early", star_count: 3, latest_star_at: "2026-03-01T12:00:00Z" },
    ] as unknown as TrendingRow[]
    expect(rankTrendingRows(rows).map(r => r.group_key)).toEqual(["early", "late"])
  })
})
