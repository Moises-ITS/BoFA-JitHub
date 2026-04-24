import { useState } from "react";
import { format } from "date-fns";
import { clubNamesEquivalent, getClubTermsFromEvent } from "../utils/clubMatching";

export const CLUB_EMOJIS = ["🎯", "💡", "🚀", "🎓", "⚡", "🌟", "🔥", "🎨", "🏆", "💻", "🎪", "🌈"];

export interface UserProfile {
  major: string; interests: string[]; clubs: string[]
  skills?: string[]; looking_for?: string[]; year?: string | null
}
export interface AttendeeInfo { count: number; preview: { user_id: string; user_name: string; user_major: string }[] }

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

export const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  hackathon:         { bg: "var(--brand-primary-soft)",        color: "var(--brand-primary)" },
  workshop:          { bg: "var(--accent-networking-soft)",    color: "var(--accent-networking)" },
  recruiting:        { bg: "var(--accent-opportunities-soft)", color: "var(--accent-opportunities)" },
  conference:        { bg: "var(--accent-orgs-soft)",          color: "var(--accent-orgs)" },
  "info session":    { bg: "var(--accent-events-soft)",        color: "var(--accent-events)" },
  "general meeting": { bg: "rgba(255,255,255,0.06)",           color: "var(--text-muted)" },
  social:            { bg: "var(--accent-orgs-soft)",          color: "var(--accent-orgs)" },
  volunteering:      { bg: "var(--status-success-soft)",       color: "var(--status-success)" },
  "site tour":       { bg: "var(--accent-events-soft)",        color: "var(--accent-events)" },
  fundraiser:        { bg: "var(--status-error-soft)",         color: "var(--status-error)" },
  exposure:          { bg: "var(--status-info-soft)",          color: "var(--status-info)" },
  "study support":   { bg: "var(--accent-networking-soft)",    color: "var(--status-info)" },
};

/** Extract a short, readable blurb from a raw Instagram caption. */
export function captionBlurb(caption: string): string {
  // Drop hashtag-only lines, blank lines, and emoji-only lines
  const lines = caption.split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#") && /[a-zA-Z]/.test(l));
  const text = lines[0] ?? caption;
  // Strip inline hashtags and collapse whitespace
  const clean = text.replace(/#\S+/g, "").replace(/\s{2,}/g, " ").trim();
  // Take up to first sentence break
  const sentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  if (sentence.length <= 80) return sentence;
  // Break at last word boundary before 80 chars
  const cut = sentence.slice(0, 80).replace(/\s+\S*$/, "");
  return cut + "…";
}

export function getEventCategories(event: any): string[] {
  const values = Array.isArray(event?.event_categories) && event.event_categories.length > 0
    ? event.event_categories
    : typeof event?.event_category === "string"
      ? event.event_category.split(",")
      : [];

  const unique: string[] = [];
  values.forEach((value) => {
    const cleaned = String(value ?? "").trim().toLowerCase();
    if (cleaned && !unique.includes(cleaned)) {
      unique.push(cleaned);
    }
  });
  return unique;
}

export function fmt12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

export function ClubAvatar({ clubId, clubName, index }: { clubId: number; clubName: string; index: number }) {
  const [failed, setFailed] = useState(false);
  if (!failed)
    return <img src={`/club_pics/${clubId}.jpg`} alt={clubName} onError={() => setFailed(true)} className="w-10 h-10 rounded-lg object-cover shrink-0" />;
  return <div className="text-3xl shrink-0 w-10 h-10 flex items-center justify-center">{CLUB_EMOJIS[index % CLUB_EMOJIS.length]}</div>;
}

export function matchScore(event: any, profile: UserProfile): number {
  const hasProfile = profile.major || profile.interests.length > 0 || profile.clubs.length > 0;
  if (!hasProfile) return -1;
  let score = 0;
  const cat = getEventCategories(event)[0] ?? "";
  const clubName = event.club_name ?? "";
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

export function EventDetailModal({ event, attendees, connectionIds, rsvpStatus, onRsvpToggle, profile, onClose, forceReadOnly }: {
  event: any; attendees: AttendeeInfo | null; connectionIds: Set<string>;
  rsvpStatus: string | null; onRsvpToggle?: (id: number) => void;
  profile: UserProfile; onClose: () => void;
  /** True for "Top Events of the Semester" and any context where RSVPs are irrelevant */
  forceReadOnly?: boolean;
}) {
  const score = matchScore(event, profile);
  const isGoing = rsvpStatus === "going";
  const eventCategories = getEventCategories(event);
  // Past events: hide RSVP. forceReadOnly overrides date check (e.g. events with no date that are still past).
  const isPast = forceReadOnly || (event.date ? new Date(event.date + "T23:59:59") < new Date() : false);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "85vh", overflowY: "auto", padding: "24px" }}>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
          <ClubAvatar clubId={event.club_id} clubName={event.club_name} index={0} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ color: "#fff", fontWeight: 600, fontSize: "18px", lineHeight: 1.3, margin: "0 0 2px" }}>{event.event_name}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: 0 }}>{event.club_name}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "20px", padding: "2px", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
          <span style={{ color: "var(--text-primary)", fontSize: "14px" }}>
            📅 {event.date ? format(new Date(event.date + "T00:00:00"), "EEEE, MMMM d") : "Date TBD"}
            {event.start_time ? ` at ${fmt12(event.start_time.slice(0, 5))}` : ""}
            {event.end_time ? ` – ${fmt12(event.end_time.slice(0, 5))}` : ""}
          </span>
          {event.campus_location && (
            <span style={{ color: "var(--text-primary)", fontSize: "14px" }}>📍 {event.campus_location}{event.event_room ? `, ${event.event_room}` : ""}</span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
          {eventCategories.map((category) => {
            const catStyle = CATEGORY_STYLE[category] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)" };
            return (
              <span
                key={category}
                style={{ backgroundColor: catStyle.bg, color: catStyle.color, fontSize: "12px", padding: "3px 10px", borderRadius: "6px", fontWeight: 500, textTransform: "capitalize" as const }}
              >
                {category}
              </span>
            );
          })}
          {event.has_free_food && <span style={{ backgroundColor: "var(--accent-events-soft)", color: "var(--accent-events)", fontSize: "12px", padding: "3px 10px", borderRadius: "6px" }}>Free Food</span>}
          {event.virtual && <span style={{ backgroundColor: "var(--accent-orgs-soft)", color: "var(--accent-orgs)", fontSize: "12px", padding: "3px 10px", borderRadius: "6px" }}>Virtual</span>}
          {event.is_open_to_public && <span style={{ backgroundColor: "var(--status-info-soft)", color: "var(--status-info)", fontSize: "12px", padding: "3px 10px", borderRadius: "6px" }}>Open to Public</span>}
        </div>

        {event.caption && (
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              lineHeight: 1.6,
              borderLeft: "2px solid var(--border-default)",
              paddingLeft: "12px",
              marginBottom: "16px",
              maxHeight: "180px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {event.caption}
          </div>
        )}

        {(Array.isArray(event.collaborators) && event.collaborators.length > 0) && (
          <div style={{ marginBottom: "16px" }}>
            <p style={{ color: "var(--text-subtle)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Collaborating Clubs
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {event.collaborators.map((collaborator: string) => (
                <span
                  key={collaborator}
                  style={{ backgroundColor: "rgba(215,25,32,0.12)", border: "1px solid rgba(215,25,32,0.24)", color: "#ffe7e8", fontSize: "12px", padding: "6px 10px", borderRadius: "999px", fontWeight: 600 }}
                >
                  {collaborator}
                </span>
              ))}
            </div>
          </div>
        )}

        {(Array.isArray(event.sponsors) && event.sponsors.length > 0) && (
          <div style={{ marginBottom: "16px" }}>
            <p style={{ color: "var(--text-subtle)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Corporate Partners
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {event.sponsors.map((sponsor: string) => (
                <span
                  key={sponsor}
                  style={{ backgroundColor: "rgba(49,197,143,0.12)", border: "1px solid rgba(49,197,143,0.24)", color: "var(--accent-opportunities)", fontSize: "12px", padding: "6px 10px", borderRadius: "999px", fontWeight: 600 }}
                >
                  {sponsor}
                </span>
              ))}
            </div>
          </div>
        )}

        {score >= 70 && (
          <div style={{ backgroundColor: "var(--status-success-soft)", border: "1px solid rgba(63,199,141,0.28)", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <span style={{ color: "var(--status-success)", fontSize: "15px" }}>✦</span>
            <div>
              <p style={{ color: "var(--status-success)", fontSize: "12px", fontWeight: 600, margin: "0 0 4px" }}>Strong Match</p>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>{explainMatch(event, profile)}</p>
            </div>
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <p style={{ color: "var(--text-subtle)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 10px" }}>
            {attendees?.count ?? 0} {isPast ? "Attended" : "Going"}
          </p>
          {attendees && attendees.preview.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {attendees.preview.map((p, i) => {
                const isConn = connectionIds.has(p.user_id);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", backgroundColor: isConn ? "var(--status-success-soft)" : "rgba(255,255,255,0.07)", border: `1px solid ${isConn ? "rgba(63,199,141,0.28)" : "var(--border-default)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600, color: isConn ? "var(--status-success)" : "var(--text-muted)", flexShrink: 0 }}>
                      {p.user_name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ color: "var(--text-primary)", fontSize: "14px" }}>{p.user_name}</span>
                    {p.user_major && <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>· {p.user_major}</span>}
                    {isConn && <span style={{ color: "var(--status-success)", fontSize: "11px", marginLeft: "2px" }}>connection</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--text-subtle)", fontSize: "13px", margin: 0 }}>
              {isPast ? "No attendance data recorded for this event." : "No one has RSVP'd yet — be the first!"}
            </p>
          )}
        </div>

        {isPast && event.date && event.club_id != null && (
          <AttendanceForm
            eventId={event.event_id}
            clubId={event.club_id}
            eventDate={event.date}
          />
        )}

        {onRsvpToggle && !isPast && (
          <button onClick={() => onRsvpToggle(event.event_id)}
            onMouseEnter={e => { if (isGoing) { e.currentTarget.textContent = "Cancel RSVP"; e.currentTarget.style.color = "var(--status-error)"; e.currentTarget.style.borderColor = "rgba(243,111,111,0.3)"; e.currentTarget.style.backgroundColor = "var(--status-error-soft)"; } }}
            onMouseLeave={e => { if (isGoing) { e.currentTarget.textContent = "✓ Going"; e.currentTarget.style.color = "var(--status-success)"; e.currentTarget.style.borderColor = "rgba(63,199,141,0.28)"; e.currentTarget.style.backgroundColor = "var(--status-success-soft)"; } }}
            style={{ width: "100%", padding: "10px", borderRadius: "10px", border: `1px solid ${isGoing ? "rgba(63,199,141,0.28)" : "var(--border-default)"}`, backgroundColor: isGoing ? "var(--status-success-soft)" : "rgba(255,255,255,0.05)", color: isGoing ? "var(--status-success)" : "var(--text-primary)", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}>
            {isGoing ? "✓ Going" : "RSVP"}
          </button>
        )}

      </div>
    </div>
  );
}
