import { describe, it, expect } from "vitest"
import { classifyOrgType, GREEK_LETTERS, EXPLICIT_TYPE_BY_NAME, normalizeOrgName } from "./orgClassifier.js"

/**
 * The table in describe("Decision 2 CAUTION list") below IS the fixture the
 * technical brief specifies — one case per row, each asserting the exact
 * OrgType. Do not thin it out: eleven of those rows agree with what the rules
 * already produce and exist precisely so a future loosening of the Greek rule
 * fails here instead of in production.
 */
describe("classifyOrgType", () => {
  describe("Decision 9 overrides — one case per approved row", () => {
    const decision9: Array<[string, string]> = [
      ["Alpha Sigma Tau", "sorority"],           // real sorority, no cue in the name
      ["Sigma Psi Kappa", "sorority"],           // Asian-interest sorority, no cue
      ["Tau Beta Pi", "club"],                   // engineering honour society
      ["Gamma Sigma Epsilon", "club"],           // chemistry honour society
      ["Omega Chi Epsilon", "club"],             // chemical engineering honour society
      ["Fraternity and Sorority Life", "club"],  // administrative umbrella body
    ]
    for (const [name, expected] of decision9) {
      it(`${name} -> ${expected}`, () => {
        expect(classifyOrgType(name)).toBe(expected)
      })
    }

    it("Phi Sigma Kappa - Alpha Octaton -> fraternity (chapter-suffix override)", () => {
      // Approved 2026-08-10. A national men's social fraternity whose row name
      // carries the chapter designation "Alpha Octaton"; the non-Greek token
      // `octaton` makes rule 4 fall through to `club` without this entry.
      expect(classifyOrgType("Phi Sigma Kappa - Alpha Octaton")).toBe("fraternity")
    })

    it("the bare Phi Sigma Kappa name still classifies from the rules alone", () => {
      // Guards the override from becoming load-bearing for the wrong reason: if
      // the row is ever renamed to drop the chapter, rule 4 handles it.
      expect(classifyOrgType("Phi Sigma Kappa")).toBe("fraternity")
    })

    it("Beta Psi Omega stays a fraternity (Decision 9 resolved the ambiguity)", () => {
      expect(classifyOrgType("Beta Psi Omega")).toBe("fraternity")
    })

    it("co-ed professional fraternities are NOT downgraded to club", () => {
      expect(classifyOrgType("Alpha Phi Omega")).toBe("fraternity")
      expect(classifyOrgType("Alpha Rho Chi")).toBe("fraternity")
      expect(classifyOrgType("Alpha Kappa Psi")).toBe("fraternity")
    })
  })

  describe("Decision 2 CAUTION list", () => {
    const cautionList: Array<[string, string]> = [
      ["Association for Computing Machinery", "club"],
      ["Philosophy Club", "club"],
      ["Peer Wellness Coaching", "club"],
      ["Pi-Landers", "club"],
      ["Genetically Engineered Machines", "club"],
      ["Order of Omega", "club"],
      ["Phi Eta Sigma - National First Year Honor Society", "club"],
      ["Interfraternity Council", "club"],
      ["Fraternity and Sorority Life", "club"],
      ["Tau Beta Pi", "club"],
      ["Omega Chi Epsilon", "club"],
      ["Gamma Sigma Epsilon", "club"],
      ["Alpha Rho Chi", "fraternity"],
      ["Alpha Kappa Psi", "fraternity"],
      ["Beta Psi Omega", "fraternity"],
    ]
    for (const [name, expected] of cautionList) {
      it(`${name} -> ${expected}`, () => {
        expect(classifyOrgType(name)).toBe(expected)
      })
    }
  })

  describe("whole-word matching, not substrings", () => {
    // Every one of these contains a Greek letter or a Greek-life cue as a
    // SUBSTRING. None of them is Greek life.
    it("does not find 'phi' inside 'Philosophy'", () => {
      expect(classifyOrgType("Philosophy Club")).toBe("club")
    })
    it("does not find 'alpha' inside 'Alphabet'", () => {
      expect(classifyOrgType("Alphabet Soup Club")).toBe("club")
    })
    it("splits on the hyphen so 'landers' disqualifies 'Pi-Landers'", () => {
      expect(classifyOrgType("Pi-Landers")).toBe("club")
    })
    it("does not find 'fraternity' inside 'Interfraternity'", () => {
      expect(classifyOrgType("Interfraternity Council")).toBe("club")
    })
    it("does not find 'pi' inside 'Peer Wellness Coaching'", () => {
      expect(classifyOrgType("Peer Wellness Coaching")).toBe("club")
    })
  })

  describe("Greek-letter names", () => {
    for (const name of ["Alpha Rho Chi", "Alpha Kappa Psi", "Iota Phi Theta", "Sigma Alpha Mu"]) {
      it(`${name} -> fraternity`, () => {
        expect(classifyOrgType(name)).toBe("fraternity")
      })
    }

    it("tolerates an Inc./Incorporated suffix on an all-Greek name", () => {
      expect(classifyOrgType("Beta Psi Omega Inc.")).toBe("fraternity")
      expect(classifyOrgType("Delta Epsilon Psi, Incorporated")).toBe("fraternity")
    })

    it("a single Greek token is below the >= 2 threshold", () => {
      expect(classifyOrgType("Pi")).toBe("club")
      expect(classifyOrgType("Omega")).toBe("club")
    })

    it("one non-Greek token disqualifies the whole name", () => {
      expect(classifyOrgType("Delta Sigma Robotics")).toBe("club")
    })
  })

  describe("explicit sorority / fraternity cues", () => {
    it("Alpha Kappa Alpha Sorority, Inc. -> sorority", () => {
      expect(classifyOrgType("Alpha Kappa Alpha Sorority, Inc.")).toBe("sorority")
    })
    it("real live-database spellings classify correctly", () => {
      expect(classifyOrgType("Zeta Phi Beta Sorority Inc.")).toBe("sorority")
      expect(classifyOrgType("Kappa Phi Gamma Sorority, Incorporated")).toBe("sorority")
      expect(classifyOrgType("Delta Phi Epsilon Sorority")).toBe("sorority")
      expect(classifyOrgType("Iota Phi Theta Fraternity Incorporated")).toBe("fraternity")
      expect(classifyOrgType("Alpha Rho Chapter of Alpha Sigma Phi Fraternity")).toBe("fraternity")
      expect(classifyOrgType("Sigma Pi Fraternity International")).toBe("fraternity")
    })
    it("sorority wins when a name somehow contains both cues", () => {
      expect(classifyOrgType("Some Sorority and Fraternity Chapter")).toBe("sorority")
    })
  })

  describe("degenerate input", () => {
    for (const value of ["", "   ", "!!!", null, undefined]) {
      it(`${JSON.stringify(value)} -> club`, () => {
        expect(classifyOrgType(value)).toBe("club")
      })
    }
  })

  it("is pure — the same input always yields the same output", () => {
    for (const name of ["Alpha Rho Chi", "Philosophy Club", "Tau Beta Pi", ""]) {
      expect(classifyOrgType(name)).toBe(classifyOrgType(name))
    }
  })
})

describe("exported tables", () => {
  it("GREEK_LETTERS has all 24 letters and nothing else", () => {
    expect(GREEK_LETTERS.size).toBe(24)
    for (const letter of ["alpha", "omega", "omicron", "upsilon", "xi", "mu"]) {
      expect(GREEK_LETTERS.has(letter)).toBe(true)
    }
    expect(GREEK_LETTERS.has("sorority")).toBe(false)
  })

  it("EXPLICIT_TYPE_BY_NAME is keyed on the normalised form", () => {
    // Keying on anything else would make the map silently miss on real data:
    // the live table spells names with commas, hyphens and stray casing.
    expect(EXPLICIT_TYPE_BY_NAME.get(normalizeOrgName("TAU  beta-Pi"))).toBe("club")
    expect(EXPLICIT_TYPE_BY_NAME.get("Tau Beta Pi")).toBeUndefined()
  })

  it("every override value is a legal OrgType", () => {
    for (const value of EXPLICIT_TYPE_BY_NAME.values()) {
      expect(["club", "sorority", "fraternity"]).toContain(value)
    }
  })
})
