/**
 * orgClassifier.ts — derive an organisation's type from its name.
 *
 * PURE MODULE. IT MUST IMPORT NOTHING.
 * `npm test` runs vitest in the default node environment; any transitive import
 * of ../config/postgres.js opens a pg Pool at test time (and throws when
 * DATABASE_URL is absent). That is why normalizeOrgName below is a deliberate
 * local twin of normalizeClubText in clubDirectory.ts rather than an import —
 * clubDirectory.test.ts pins the two implementations to the same fixture table,
 * so drift fails the build.
 *
 * Same input always yields the same output: no I/O, no clock, no process.env.
 *
 * The classifier — not the `clubs.type` column — is the source of truth. A
 * hand-edited row is overwritten on the next boot by services/clubTypeSync.ts.
 * To correct a mislabelled org, add it to EXPLICIT_TYPE_BY_NAME below and
 * deploy; no migration, no manual SQL. See the technical brief §10.
 */

export type OrgType = "club" | "sorority" | "fraternity"

/**
 * Twin of normalizeClubText (services/clubDirectory.ts) and of
 * normalizeClubText (frontend/pages/events/utils/clubMatching.ts).
 * If you change this, change all three — clubDirectory.test.ts will tell you.
 */
export function normalizeOrgName(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "")
}

/** The 24 letters of the Greek alphabet (Decision 2). */
export const GREEK_LETTERS: ReadonlySet<string> = new Set([
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
  "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi",
  "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega",
])

/**
 * Chapter-suffix noise that should not disqualify an otherwise all-Greek name
 * from rule 4 ("Alpha Kappa Alpha Sorority, Inc." never reaches rule 4, but
 * "Beta Psi Omega Inc." would).
 */
const GREEK_NAME_FILLER: ReadonlySet<string> = new Set(["inc", "incorporated"])

/**
 * Hand-maintained overrides, keyed on normalizeOrgName(name). Checked FIRST, so
 * an entry here beats every rule below it. This is also the production hot-fix
 * surface: adding a row here plus a unit case is the whole fix for a
 * mislabelled org.
 *
 * SIX ROWS ARE LOAD-BEARING — without them the rules below return the wrong
 * answer (Decision 9, approved 2026-08-10):
 *   Fraternity and Sorority Life  rule 2 would say `sorority`; it is an
 *                                 administrative umbrella body, not a chapter
 *   Tau Beta Pi                   rule 4 would say `fraternity`; engineering
 *                                 honour society
 *   Omega Chi Epsilon             rule 4 would say `fraternity`; chemical
 *                                 engineering honour society
 *   Gamma Sigma Epsilon           rule 4 would say `fraternity`; chemistry
 *                                 honour society
 *   Alpha Sigma Tau               rule 4 would say `fraternity`; real sorority
 *                                 with no cue in the name
 *   Sigma Psi Kappa               rule 4 would say `fraternity`; Asian-interest
 *                                 sorority with no cue in the name
 *
 * The remaining rows agree with what the rules already produce. They are
 * REGRESSION INSURANCE: they are exactly the CAUTION list from Decision 2, and
 * pinning them here means a future loosening of rule 4 cannot silently reclassify
 * the names the product owner called out by hand.
 *
 * Co-ed *professional* fraternities are still fraternities — Alpha Phi Omega,
 * Alpha Rho Chi, Alpha Kappa Psi and Beta Psi Omega are deliberately NOT
 * downgraded to `club` (Decision 9).
 */
export const EXPLICIT_TYPE_BY_NAME: ReadonlyMap<string, OrgType> = new Map<string, OrgType>([
  // ── Load-bearing overrides (Decision 9) ────────────────────────────────────
  [normalizeOrgName("Fraternity and Sorority Life"), "club"],
  [normalizeOrgName("Tau Beta Pi"), "club"],
  [normalizeOrgName("Omega Chi Epsilon"), "club"],
  [normalizeOrgName("Gamma Sigma Epsilon"), "club"],
  [normalizeOrgName("Alpha Sigma Tau"), "sorority"],
  [normalizeOrgName("Sigma Psi Kappa"), "sorority"],
  // DIFFERENT ROOT CAUSE from the six above, approved 2026-08-10. Those six are
  // names whose letters rule 4 reads correctly but judges wrongly (honour
  // societies, cue-less sororities). This one rule 4 never even considers: Phi
  // Sigma Kappa is a national men's social fraternity, "Alpha Octaton" is only
  // the chapter designation, and the non-Greek token `octaton` disqualifies the
  // whole name at rule 4 so it falls through to `club`.
  //
  // A trailing chapter/place/suffix clause is a general shape, not a one-off. It
  // is handled with an override rather than a "strip the suffix and re-test"
  // step because stripping is a guess: the same shape is what correctly keeps
  // "Order of Omega" and "Phi Eta Sigma - National First Year Honor Society" out
  // of Greek life. A survey of the live table found this to be the only row
  // affected (see the scan noted in the module tests), so one override is the
  // proportionate fix. If that count ever grows, revisit the rule.
  [normalizeOrgName("Phi Sigma Kappa - Alpha Octaton"), "fraternity"],

  // ── Regression insurance (Decision 2 CAUTION list; rules already agree) ────
  [normalizeOrgName("Association for Computing Machinery"), "club"],
  [normalizeOrgName("Philosophy Club"), "club"],
  [normalizeOrgName("Peer Wellness Coaching"), "club"],
  [normalizeOrgName("Pi-Landers"), "club"],
  [normalizeOrgName("Genetically Engineered Machines"), "club"],
  [normalizeOrgName("Order of Omega"), "club"],
  [normalizeOrgName("Phi Eta Sigma - National First Year Honor Society"), "club"],
  [normalizeOrgName("Interfraternity Council"), "club"],
  [normalizeOrgName("Alpha Rho Chi"), "fraternity"],
  [normalizeOrgName("Alpha Kappa Psi"), "fraternity"],
  [normalizeOrgName("Beta Psi Omega"), "fraternity"],
])

/**
 * Rules, in order:
 *   1. explicit override             -> that value
 *   2. whole word "sorority"         -> sorority
 *   3. whole word "fraternity"       -> fraternity
 *   4. all-Greek name (>= 2 letters) -> fraternity
 *   5. anything else                 -> club
 *
 * Tokenising on every non-alphanumeric run is what makes matching WHOLE-WORD,
 * which Decision 2 requires: "Philosophy Club" tokenises to
 * ["philosophy","club"] and never exposes a "phi"; "Pi-Landers" tokenises to
 * ["pi","landers"] so "landers" disqualifies it; and "Interfraternity Council"
 * yields "interfraternity", which is not the word "fraternity".
 */
export function classifyOrgType(name: string | null | undefined): OrgType {
  const explicit = EXPLICIT_TYPE_BY_NAME.get(normalizeOrgName(name))
  if (explicit) return explicit

  const tokens = (name ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (tokens.length === 0) return "club"

  if (tokens.includes("sorority")) return "sorority"
  if (tokens.includes("fraternity")) return "fraternity"

  let greekCount = 0
  for (const token of tokens) {
    if (GREEK_LETTERS.has(token)) {
      greekCount++
      continue
    }
    // One non-Greek, non-filler token is enough to disqualify the name. This is
    // what keeps "Order of Omega", "Alphabet Soup Club" and every honour
    // society with a descriptive suffix out of Greek life.
    if (!GREEK_NAME_FILLER.has(token)) return "club"
  }

  // A single Greek letter is far more often a coincidence ("Pi", "Delta
  // Robotics") than a chapter name, so require at least two.
  return greekCount >= 2 ? "fraternity" : "club"
}
