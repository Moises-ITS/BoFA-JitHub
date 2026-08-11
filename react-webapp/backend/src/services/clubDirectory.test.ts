import { describe, it, expect } from "vitest"
import {
  normalizeClubText,
  serializeClub,
  serializeClubCollection,
  needsTypeFallback,
  type ClubRow,
} from "./clubDirectory.js"
import { normalizeOrgName } from "./orgClassifier.js"

function row(overrides: Partial<ClubRow> & { club_id: number; name: string }): ClubRow {
  return {
    instagram_handle: null,
    follower_count: null,
    bio: null,
    type: null,
    ...overrides,
  }
}

/**
 * THE NORMALISATION CONTRACT.
 *
 * This fixture has TWO twins that must stay byte-identical:
 *   - frontend/pages/events/utils/clubMatching.ts  (normalizeClubText)
 *   - backend/src/services/orgClassifier.ts        (normalizeOrgName)
 *
 * The frontend keeps its own copy because it cannot import from the backend, and
 * orgClassifier keeps its own because it must not import anything that could
 * transitively open a database pool at test time. Three implementations of one
 * rule is three chances to drift, and drift here is invisible: a club the server
 * considers a duplicate would look distinct to the client, and the classifier
 * would miss its own override table. The twin test in
 * frontend/pages/events/utils/clubMatching.test.ts uses this same table.
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

  it("orgClassifier's dependency-free copy agrees on every case", () => {
    for (const [input] of NORMALIZATION_FIXTURE) {
      expect(normalizeOrgName(input)).toBe(normalizeClubText(input))
    }
  })

  it("agrees on null and undefined too", () => {
    expect(normalizeClubText(null)).toBe("")
    expect(normalizeOrgName(null)).toBe("")
    expect(normalizeClubText(undefined)).toBe("")
    expect(normalizeOrgName(undefined)).toBe("")
  })
})

describe("serializeClub", () => {
  it("passes bio through unchanged", () => {
    expect(serializeClub(row({ club_id: 1, name: "Chess Club", bio: "We play chess." })).bio)
      .toBe("We play chess.")
  })

  it("preserves a null bio rather than substituting a placeholder (AC 27)", () => {
    // The detail modal keys its "render a description at all" decision off this
    // being falsy, so an empty string or a "No description" string here would
    // silently defeat AC 27 in the UI.
    expect(serializeClub(row({ club_id: 1, name: "Chess Club", bio: null })).bio).toBeNull()
  })

  it("prefers the stored type over classifying the name", () => {
    // The stored column is authoritative: it is what clubTypeSync reconciled and
    // what the type filter reads. A name that the classifier would call a
    // fraternity must still serialise as whatever the column says.
    const club = serializeClub(row({ club_id: 2, name: "Alpha Rho Chi", type: "club" }))
    expect(club.type).toBe("club")
  })

  it("normalises the stored type's casing and whitespace", () => {
    expect(serializeClub(row({ club_id: 2, name: "Whatever", type: " Sorority " })).type).toBe("sorority")
  })

  it("falls back to the classifier when the column is null", () => {
    expect(serializeClub(row({ club_id: 3, name: "Alpha Rho Chi", type: null })).type).toBe("fraternity")
    expect(serializeClub(row({ club_id: 4, name: "Philosophy Club", type: null })).type).toBe("club")
    expect(serializeClub(row({ club_id: 5, name: "Zeta Phi Beta Sorority Inc.", type: null })).type).toBe("sorority")
  })

  it("falls back when the column holds a value outside the OrgType union", () => {
    // There is deliberately no CHECK constraint on clubs.type, so junk is
    // possible; the API contract still promises one of three values.
    expect(serializeClub(row({ club_id: 6, name: "Philosophy Club", type: "greek" })).type).toBe("club")
  })

  it("never emits a null type", () => {
    for (const value of [null, undefined, "", "   ", "nonsense"]) {
      const club = serializeClub(row({ club_id: 7, name: "Some Org", type: value as string | null }))
      expect(["club", "sorority", "fraternity"]).toContain(club.type)
    }
  })

  it("classifies the CANONICAL name, not the raw row name", () => {
    // "Chinese Student Association" is an alias of "Chinese Undergraduate
    // Student Association"; both must land on the same verdict or two duplicate
    // rows of one org could carry different types.
    const a = serializeClub(row({ club_id: 8, name: "Chinese Student Association" }))
    const b = serializeClub(row({ club_id: 9, name: "Chinese Undergraduate Student Association" }))
    expect(a.type).toBe(b.type)
    expect(a.name).toBe(b.name)
  })

  it("emits org_key as the normalised canonical name", () => {
    expect(serializeClub(row({ club_id: 10, name: "Society of Women Engineers" })).org_key)
      .toBe("societyofwomenengineers")
    // An alias and its canonical share one key — that is what makes them one
    // dedup group and keeps their stars undivided.
    expect(serializeClub(row({ club_id: 11, name: "SWE" })).org_key).toBe("societyofwomenengineers")
  })

  it("still emits the pre-existing fields unchanged", () => {
    const club = serializeClub(row({ club_id: 12, name: "SWE", instagram_handle: "njitswe" }))
    expect(club.club_id).toBe(12)
    expect(club.name).toBe("Society of Women Engineers")
    expect(club.display_name).toBe("SWE")
    expect(club.logo_url).toBe("/club_pics/12.jpg")
    expect(club.instagram_handle).toBe("njitswe")
  })
})

describe("needsTypeFallback", () => {
  it("is true exactly when the stored value is unusable", () => {
    expect(needsTypeFallback(row({ club_id: 1, name: "X", type: null }))).toBe(true)
    expect(needsTypeFallback(row({ club_id: 1, name: "X", type: "" }))).toBe(true)
    expect(needsTypeFallback(row({ club_id: 1, name: "X", type: "greek" }))).toBe(true)
    expect(needsTypeFallback(row({ club_id: 1, name: "X", type: "club" }))).toBe(false)
  })
})

describe("serializeClubCollection", () => {
  it("collapses duplicate rows for one org into a single entry (AC 39)", () => {
    const result = serializeClubCollection([
      row({ club_id: 1, name: "Society of Women Engineers" }),
      row({ club_id: 2, name: "SWE" }),
    ])
    expect(result).toHaveLength(1)
  })

  it("folds every duplicate's spelling into the survivor's aliases", () => {
    const [club] = serializeClubCollection([
      row({ club_id: 1, name: "Society of Women Engineers" }),
      row({ club_id: 2, name: "SWE", instagram_handle: "njitswe" }),
    ])
    const aliases = club.aliases.map(normalizeClubText)
    expect(aliases).toContain("societyofwomenengineers")
    expect(aliases).toContain("swe")
    expect(aliases).toContain("njitswe")
  })

  it("gives every member of a group the same org_key", () => {
    const [club] = serializeClubCollection([
      row({ club_id: 1, name: "Society of Women Engineers" }),
      row({ club_id: 2, name: "SWE" }),
    ])
    expect(club.org_key).toBe("societyofwomenengineers")
  })

  it("sorts by name ascending — the stable order offset pagination requires", () => {
    const names = serializeClubCollection([
      row({ club_id: 1, name: "Zeta Club" }),
      row({ club_id: 2, name: "Anime Club" }),
      row({ club_id: 3, name: "Music Club" }),
    ]).map(c => c.name)
    expect(names).toEqual(["Anime Club", "Music Club", "Zeta Club"])
  })

  it("carries bio and type onto the surviving entry", () => {
    const [club] = serializeClubCollection([
      row({ club_id: 1, name: "Alpha Sigma Tau", bio: "Sisterhood.", type: "sorority", instagram_handle: "ast" }),
    ])
    expect(club.bio).toBe("Sisterhood.")
    expect(club.type).toBe("sorority")
  })

  it("handles an empty table", () => {
    expect(serializeClubCollection([])).toEqual([])
  })
})
