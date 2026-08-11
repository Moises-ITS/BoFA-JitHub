/**
 * onboardingClubNames.ts — the club names a student profile can actually contain.
 *
 * These are the ONLY strings that ever land in users.clubs today: onboarding and
 * profile editing both render a fixed <select> over this list, so "which of my
 * connections are in this org" is entirely a question of mapping these strings
 * onto clubs rows.
 *
 * SOURCE OF TRUTH IS THE FRONTEND. Copied verbatim from NJIT_CLUBS in
 * react-webapp/frontend/pages/auth/ProfileSetupPage.tsx (duplicated in
 * components/EditProfileModal.tsx). Those copies were deliberately NOT
 * refactored in this ticket — touching the onboarding form to serve a directory
 * feature is scope the change does not need. Consequence: if someone adds a club
 * to the form, add it here too and re-run `npm run clubs:check-coverage`.
 *
 * 58 entries. (The technical brief says 59; the array has always had 58. The
 * count is cosmetic — the coverage script reports the real number.)
 */

export const ONBOARDING_CLUB_NAMES: readonly string[] = [
  "American Institute of Aeronautics and Astronautics",
  "American Institute of Chemical Engineers",
  "American Chemical Society",
  "American Society of Civil Engineers",
  "American Society of Mechanical Engineers",
  "Alpha Phi Omega",
  "Association for Computing Machinery",
  "Biomedical Engineering Society",
  "Caribbean Student Association",
  "Chess Club",
  "Chinese Student Association",
  "Climbing Club",
  "Computer Science Honors Society",
  "Cooking Club",
  "Cyber Defense Organization",
  "Data Science Club",
  "Debate Club",
  "Engineering Without Borders",
  "Entrepreneurship Club",
  "ESports Club",
  "Film Club",
  "Finance Club",
  "Google Developer Student Club",
  "Hack@NJIT",
  "HACCS",
  "Indian Student Association",
  "Institute of Electrical and Electronics Engineers",
  "International Students Organization",
  "Investment Club",
  "Korean Student Association",
  "Latino American Student Organization",
  "Martial Arts Club",
  "Mathematics Club",
  "Mathematics Honor Society",
  "Model United Nations",
  "Muslim Student Association",
  "National Society of Black Engineers",
  "Pakistani Student Association",
  "Photography Club",
  "Physics Club",
  "Pre-Medical Society",
  "Robotics Club",
  "Rugby Club",
  "Soccer Club",
  "Society of Hispanic Professional Engineers",
  "Society of Women Engineers",
  "Software Engineering Club",
  "Step Team",
  "Student Government Association",
  "Table Tennis Club",
  "Tau Beta Pi",
  "Tennis Club",
  "Theatre Arts Group",
  "Turkish Student Association",
  "Vietnamese Student Association",
  "Volleyball Club",
  "Women in Computer Science",
  "Women in Engineering",
]

/**
 * Onboarding names with NO corresponding row in the live `clubs` table (verified
 * against the shared database on 2026-08-10, 204 rows). These are options the
 * profile form offers for organisations that either do not exist on the NJIT
 * Engage portal, have no Instagram handle (the scraper's import filter), or have
 * simply never been scraped.
 *
 * They are NOT an alias-table gap and no CLUB_METADATA entry can fix them —
 * there is nothing to alias TO. `clubs:check-coverage` treats them as expected
 * misses so that the script's exit code stays a meaningful signal about the
 * alias table rather than a permanent red light.
 *
 * If one of these later appears in `clubs`, delete it from this list; the script
 * will then hold the alias table to account for it.
 */
export const ONBOARDING_NAMES_WITHOUT_CLUB_ROW: readonly string[] = [
  "American Institute of Aeronautics and Astronautics",
  "American Society of Civil Engineers",
  "Climbing Club",
  "Computer Science Honors Society",
  "Cooking Club",
  "Data Science Club",
  "Debate Club",
  "Film Club",
  "Hack@NJIT",
  "International Students Organization",
  "Investment Club",
  "Latino American Student Organization",
  "Martial Arts Club",
  "Mathematics Club",
  "Mathematics Honor Society",
  "Model United Nations",
  "Pakistani Student Association",
  "Pre-Medical Society",
  "Rugby Club",
  "Software Engineering Club",
  "Step Team",
  "Student Government Association",
  "Tau Beta Pi",
  "Women in Engineering",
]
