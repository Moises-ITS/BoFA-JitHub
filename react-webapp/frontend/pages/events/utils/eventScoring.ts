/**
 * eventScoring.ts — the personalization engine: how well does an event match a
 * student's profile?
 *
 * WHY THIS FILE EXISTS: the affinity tables and scoring functions lived inside
 * EventDetailModal.tsx, so "the modal" was secretly also the recommendation
 * engine consumed by three pages, and Fast Refresh broke on every edit. Pure
 * data + pure functions now live here — which also makes the scoring finally
 * unit-testable without rendering anything.
 *
 * HOW SCORING WORKS (matchScore): additive points capped at 100 —
 *   - each profile interest × event category affinity (INTEREST_AFFINITIES)
 *   - major × category (MAJOR_AFFINITIES)
 *   - each looking_for intent × category (LOOKING_FOR_AFFINITIES)
 *   - class year × category (YEAR_BOOSTS)
 *   - +30 if the event is hosted by a club the student belongs to
 *   - +20 if hosted by a club in the same "community group" (CLUB_GROUPS —
 *     e.g. SHPE↔SWE↔NSBE) as one of the student's clubs
 *   - up to +8 for Instagram engagement, +4 for free food
 * A profile with no major/interests/clubs returns -1 ("can't score").
 * The weights are hand-tuned heuristics, not learned values.
 */
import { clubNamesEquivalent, getClubTermsFromEvent } from "./clubMatching";
import { getEventCategories } from "./eventFormatting";
import type { User } from "@/context/AuthContext";

/**
 * The slice of the canonical User (context/AuthContext) that scoring needs.
 * DESIGN CHOICE: derived with Pick<> instead of re-declaring the fields so
 * this can never drift from the real User shape — if AuthContext renames a
 * field, this breaks at compile time instead of silently mis-scoring events.
 * skills/looking_for/year stay optional because some callers build partial
 * profiles without them.
 */
export type UserProfile =
  Pick<User, "major" | "interests" | "clubs"> &
  Partial<Pick<User, "skills" | "looking_for" | "year">>;

/**
 * Clubs that share a community/audience. Used for the +20 "network adjacency"
 * boost: being in SHPE makes SWE's events more relevant even without direct
 * membership. Names appear alongside their acronyms because event data refers
 * to clubs inconsistently.
 */
export const CLUB_GROUPS: string[][] = [
  [
    "Association for Computing Machinery", "ACM",
    "Institute of Electrical and Electronics Engineers", "IEEE",
    "Google Developer Student Club", "GDSC",
    "Hack@NJIT", "Women in Computer Science", "WiCS",
    "Software Engineering Club", "Data Science Club", "Cyber Defense Organization",
  ],
  [
    "Society of Hispanic Professional Engineers", "SHPE",
    "Society of Women Engineers", "SWE",
    "National Society of Black Engineers", "NSBE",
    "Biomedical Engineering Society", "BMES",
    "Women in Computer Science", "WiCS",
    "Latino American Student Organization", "LASO",
    "Hispanic Association of Computing College Students", "HACCS",
    "Hispanic and Latine Association of Computing College Students",
  ],
  [
    "American Society of Civil Engineers", "ASCE",
    "American Society of Mechanical Engineers", "ASME",
    "American Institute of Chemical Engineers", "AIChE",
    "Biomedical Engineering Society", "BMES",
    "Institute of Electrical and Electronics Engineers", "IEEE",
  ],
  ["Entrepreneurship Club", "Finance Club", "Investment Club", "Student Government Association", "SGA"],
  ["Muslim Student Association", "MSA", "Latino American Student Organization", "LASO", "Caribbean Student Association", "Chinese Student Association", "Korean Student Association", "Vietnamese Student Association"],
  ["Pre-Medical Society", "Biomedical Engineering Society", "BMES", "Biology Club"],
];

export const INTEREST_AFFINITIES: Record<string, Record<string, number>> = {
  "Machine Learning":        { hackathon: 25, workshop: 20, conference: 18 },
  "Artificial Intelligence": { hackathon: 25, workshop: 20, conference: 18 },
  "Software Development":    { hackathon: 22, workshop: 18, recruiting: 15 },
  "Fullstack":               { hackathon: 20, workshop: 18, recruiting: 15 },
  "Programming":             { hackathon: 22, workshop: 18 },
  "Cybersecurity":           { workshop: 20, hackathon: 18, conference: 15 },
  "Data Analytics":          { workshop: 20, hackathon: 18, conference: 15 },
  "Robotics":                { workshop: 22, "site tour": 15, hackathon: 14 },
  "Hardware":                { workshop: 20, "site tour": 18 },
  "Finance":                 { recruiting: 20, "info session": 18, conference: 15 },
  "Investment Banking":      { recruiting: 22, "info session": 20, conference: 15 },
  "Startups":                { hackathon: 20, recruiting: 18, conference: 16 },
  "Innovation":              { hackathon: 18, conference: 15, workshop: 14 },
  "Sustainability":          { volunteering: 22, "site tour": 18, workshop: 12 },
  "Environmental":           { volunteering: 22, "site tour": 18 },
  "Environmental Studies":   { volunteering: 20, "site tour": 16 },
  "Design":                  { workshop: 18, exposure: 16, hackathon: 14 },
  "Architecture":            { "site tour": 22, exposure: 18 },
  "Project Management":      { workshop: 16, conference: 14, recruiting: 14 },
  "Technical Sales":         { recruiting: 20, "info session": 18, exposure: 16 },
};

export const MAJOR_AFFINITIES: Record<string, Record<string, number>> = {
  "Computer Science":          { workshop: 18, recruiting: 16, conference: 12, "info session": 10, hackathon: 22 },
  "Information Technology":    { workshop: 18, recruiting: 16, "info session": 12, hackathon: 20 },
  "Electrical Engineering":    { workshop: 18, recruiting: 16, "site tour": 14, hackathon: 18 },
  "Mechanical Engineering":    { workshop: 16, recruiting: 14, "site tour": 18, hackathon: 14 },
  "Civil Engineering":         { "site tour": 20, volunteering: 14, workshop: 12 },
  "Chemical Engineering":      { workshop: 16, recruiting: 14, "info session": 12 },
  "Biomedical Engineering":    { workshop: 14, recruiting: 12, volunteering: 16 },
  "Business Administration":   { recruiting: 20, exposure: 16, conference: 14, "info session": 12 },
  "Architecture":              { "site tour": 22, exposure: 18, workshop: 12 },
  "Biology":                   { volunteering: 20, "info session": 16, workshop: 12 },
  "Applied Mathematics":       { workshop: 18, conference: 14, "study support": 18 },
  "Physics":                   { workshop: 18, conference: 14, "info session": 12 },
  "Data Science":              { hackathon: 22, workshop: 18, conference: 14 },
  "Computer Engineering":      { hackathon: 20, workshop: 18, recruiting: 16, "site tour": 14 },
  "Humanities / Liberal Arts": { social: 18, exposure: 16, volunteering: 14 },
};

export const LOOKING_FOR_AFFINITIES: Record<string, Record<string, number>> = {
  "Internship":            { recruiting: 25, "info session": 18, conference: 12 },
  "Job":                   { recruiting: 25, "info session": 18, conference: 12 },
  "Co-op":                 { recruiting: 22, "info session": 16 },
  "Hackathon Partner":     { hackathon: 28 },
  "Research Opportunity":  { conference: 20, workshop: 16 },
  "Study Group":           { "study support": 22, workshop: 12 },
  "Networking":            { recruiting: 18, conference: 16, exposure: 14, "info session": 12 },
  "New Friends":           { social: 22, exposure: 14 },
};

const YEAR_BOOSTS: Record<string, Record<string, number>> = {
  "Freshman":  { social: 8, exposure: 6 },
  "Sophomore": { social: 6, workshop: 4 },
  "Junior":    { recruiting: 10, "info session": 8 },
  "Senior":    { recruiting: 12, "info session": 10, conference: 6 },
  "Graduate":  { conference: 10, workshop: 8, "info session": 6 },
};

export function matchScore(event: any, profile: UserProfile): number {
  const hasProfile = profile.major || profile.interests.length > 0 || profile.clubs.length > 0;
  if (!hasProfile) return -1;
  let score = 0;
  const cat = getEventCategories(event)[0] ?? "";
  const clubTerms = getClubTermsFromEvent(event);
  for (const interest of profile.interests) score += INTEREST_AFFINITIES[interest]?.[cat] ?? 0;
  score += MAJOR_AFFINITIES[profile.major]?.[cat] ?? 0;
  for (const intent of (profile.looking_for ?? [])) score += LOOKING_FOR_AFFINITIES[intent]?.[cat] ?? 0;
  if (profile.year) score += YEAR_BOOSTS[profile.year]?.[cat] ?? 0;
  if (profile.clubs.some(c => clubTerms.some(term => clubNamesEquivalent(c, term)))) score += 30;
  for (const group of CLUB_GROUPS) {
    const userInGroup = profile.clubs.some(c => group.some(groupClub => clubNamesEquivalent(c, groupClub)));
    const eventInGroup = group.some(groupClub => clubTerms.some(term => clubNamesEquivalent(groupClub, term)));
    if (userInGroup && eventInGroup) { score += 20; break; }
  }
  if (event.engagement_score) score += Math.min(8, event.engagement_score * 2);
  if (event.has_free_food) score += 4;
  return Math.min(100, Math.round(score));
}

/** Human-readable "why this matched" sentence for scores shown as Strong Match. */
export function explainMatch(event: any, profile: UserProfile): string {
  const cat = getEventCategories(event)[0] ?? "";
  const clubName = event.club_name ?? "";
  const clubTerms = getClubTermsFromEvent(event);
  const reasons: string[] = [];
  if (profile.clubs.some(c => clubTerms.some(term => clubNamesEquivalent(c, term)))) {
    reasons.push(`you're a member of ${clubName}`);
  } else {
    for (const group of CLUB_GROUPS) {
      const userClubs = profile.clubs.filter(c => group.some(groupClub => clubNamesEquivalent(c, groupClub)));
      const eventInGroup = group.some(groupClub => clubTerms.some(term => clubNamesEquivalent(groupClub, term)));
      if (userClubs.length > 0 && eventInGroup) {
        reasons.push(`your involvement with ${userClubs[0]} connects you to ${clubName}'s network`);
        break;
      }
    }
  }
  const matchingInterests = profile.interests.filter(i => (INTEREST_AFFINITIES[i]?.[cat] ?? 0) >= 18);
  if (matchingInterests.length >= 2)
    reasons.push(`your interests in ${matchingInterests[0]} and ${matchingInterests[1]}`);
  else if (matchingInterests.length === 1)
    reasons.push(`your interest in ${matchingInterests[0]}`);
  if ((MAJOR_AFFINITIES[profile.major]?.[cat] ?? 0) >= 16)
    reasons.push(`your ${profile.major} background`);
  const intentMatch = (profile.looking_for ?? []).find(i => (LOOKING_FOR_AFFINITIES[i]?.[cat] ?? 0) >= 18);
  if (intentMatch) reasons.push(`you're looking for ${intentMatch.toLowerCase()}`);
  const catLabel = cat ? `This ${cat}` : "This event";
  if (reasons.length === 0) return `${catLabel} aligns well with your profile on JitHub.`;
  if (reasons.length === 1) return `${catLabel} is a strong fit because of ${reasons[0]}.`;
  return `${catLabel} is a strong fit — ${reasons[0]} and ${reasons[1]} make it especially relevant to you.`;
}
