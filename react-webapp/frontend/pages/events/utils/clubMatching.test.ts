import { describe, it, expect } from "vitest"
import { normalizeClubText, clubNamesEquivalent } from "./clubMatching"

/**
 * THE NORMALISATION CONTRACT — frontend half.
 *
 * This fixture is byte-identical to the one in
 * backend/src/services/clubDirectory.test.ts, which additionally checks
 * backend/src/services/orgClassifier.ts's dependency-free copy against it. Three
 * implementations of one rule exist for good reasons (the frontend cannot import
 * from the backend; orgClassifier must not transitively open a database pool at
 * test time) and three implementations are three chances to drift.
 *
 * Drift here is invisible in ordinary use and vicious when it bites: a club the
 * server treats as a duplicate would look like a distinct org to the client, so
 * the directory would show doubles and their stars would appear split. These two
 * test files are the only mechanism that actually catches it — if someone edits
 * one implementation, the other package's `npm test` goes red.
 *
 * IF YOU CHANGE THIS TABLE, CHANGE ITS TWIN IN THE SAME COMMIT.
 */
const NORMALIZATION_FIXTURE: Array<[string, string]> = [
  ["Society of Women Engineers", "societyofwomenengineers"],
  ["SWE", "swe"],
  ["Alpha Rho Chi", "alpharhochi"],
  ["Pi-Landers", "pilanders"],
  ["@njitshpe", "njitshpe"],
  ["  Delta  Phi  Epsilon ", "deltaphiepsilon"],
  ["", ""],
  ["Ω Chi", "chi"],
]

describe("normalizeClubText contract", () => {
  for (const [input, expected] of NORMALIZATION_FIXTURE) {
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      expect(normalizeClubText(input)).toBe(expected)
    })
  }

  it("treats null and undefined as the empty string", () => {
    expect(normalizeClubText(null)).toBe("")
    expect(normalizeClubText(undefined)).toBe("")
  })

  it("is idempotent — normalising an already-normalised value is a no-op", () => {
    // The backend applies this to values that may already have been through it
    // (a group key derived from a canonical name). If it were not idempotent,
    // the dedup key would depend on how many times it had been computed.
    for (const [, expected] of NORMALIZATION_FIXTURE) {
      expect(normalizeClubText(expected)).toBe(expected)
    }
  })
})

describe("clubNamesEquivalent", () => {
  it("matches across punctuation, case, and spacing differences", () => {
    expect(clubNamesEquivalent("Delta Phi Epsilon", "  delta-phi-epsilon ")).toBe(true)
  })

  it("does not treat two empty values as equivalent", () => {
    // Both normalise to "", and an empty name matching every other empty name
    // would collapse unrelated rows into one directory entry.
    expect(clubNamesEquivalent("", "")).toBe(false)
    expect(clubNamesEquivalent(null, undefined)).toBe(false)
  })

  it("does not match on a shared prefix", () => {
    expect(clubNamesEquivalent("Alpha Rho Chi", "Alpha Rho")).toBe(false)
  })
})
