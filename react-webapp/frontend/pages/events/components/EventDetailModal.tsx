import { useState } from "react";
import { format } from "date-fns";

export const CLUB_EMOJIS = ["🎯", "💡", "🚀", "🎓", "⚡", "🌟", "🔥", "🎨", "🏆", "💻", "🎪", "🌈"];

export interface UserProfile { major: string; interests: string[]; clubs: string[] }
export interface AttendeeInfo { count: number; preview: { user_id: string; user_name: string; user_major: string }[] }

export const CLUB_GROUPS: string[][] = [
  ["ACM", "IEEE", "GDSC", "Hack@NJIT", "WiCS", "Software Engineering Club", "Data Science Club", "Cyber Defense Organization"],
  ["SHPE", "SWE", "NSBE", "BMES", "WiCS", "LASO"],
  ["ASCE", "ASME", "AIChE", "BMES", "IEEE"],
  ["Entrepreneurship Club", "Finance Club", "Investment Club", "SGA"],
  ["MSA", "LASO", "Caribbean Student Association", "Chinese Student Association", "Korean Student Association", "Vietnamese Student Association"],
  ["Pre-Medical Society", "BMES", "Biology Club"],
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

export const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  hackathon:         { bg: "rgba(192,57,43,0.2)",    color: "#E74C3C" },
  workshop:          { bg: "rgba(52,152,219,0.2)",   color: "#5DADE2" },
  recruiting:        { bg: "rgba(39,174,96,0.2)",    color: "#2ECC71" },
  conference:        { bg: "rgba(155,89,182,0.2)",   color: "#BB8FCE" },
  "info session":    { bg: "rgba(230,126,34,0.2)",   color: "#F39C12" },
  "general meeting": { bg: "rgba(255,255,255,0.07)", color: "#9CA3AF" },
  social:            { bg: "rgba(241,196,15,0.2)",   color: "#F4D03F" },
  volunteering:      { bg: "rgba(26,188,156,0.2)",   color: "#1ABC9C" },
  "site tour":       { bg: "rgba(230,126,34,0.2)",   color: "#E67E22" },
  fundraiser:        { bg: "rgba(231,76,60,0.15)",   color: "#E74C3C" },
  exposure:          { bg: "rgba(52,73,94,0.4)",     color: "#AAB7B8" },
  "study support":   { bg: "rgba(52,152,219,0.15)",  color: "#85C1E9" },
};

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
  const cat = event.event_category ?? "";
  const clubName = event.club_name ?? "";
  for (const interest of profile.interests) score += INTEREST_AFFINITIES[interest]?.[cat] ?? 0;
  score += MAJOR_AFFINITIES[profile.major]?.[cat] ?? 0;
  if (profile.clubs.some(c => c.toLowerCase() === clubName.toLowerCase())) score += 30;
  for (const group of CLUB_GROUPS) {
    const userInGroup = profile.clubs.some(c => group.includes(c));
    const eventInGroup = group.includes(clubName);
    if (userInGroup && eventInGroup) { score += 20; break; }
  }
  if (event.engagement_score) score += Math.min(8, event.engagement_score * 2);
  if (event.has_free_food) score += 4;
  return Math.min(100, Math.round(score));
}

export function explainMatch(event: any, profile: UserProfile): string {
  const cat = event.event_category ?? "";
  const clubName = event.club_name ?? "";
  const reasons: string[] = [];
  if (profile.clubs.some(c => c.toLowerCase() === clubName.toLowerCase())) {
    reasons.push(`you're a member of ${clubName}`);
  } else {
    for (const group of CLUB_GROUPS) {
      const userClubs = profile.clubs.filter(c => group.includes(c));
      if (userClubs.length > 0 && group.includes(clubName)) {
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
  const catStyle = CATEGORY_STYLE[event.event_category] ?? { bg: "rgba(255,255,255,0.07)", color: "#9CA3AF" };
  // Past events: hide RSVP. forceReadOnly overrides date check (e.g. events with no date that are still past).
  const isPast = forceReadOnly || (event.date ? new Date(event.date + "T23:59:59") < new Date() : false);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "85vh", overflowY: "auto", padding: "24px" }}>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
          <ClubAvatar clubId={event.club_id} clubName={event.club_name} index={0} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ color: "#fff", fontWeight: 600, fontSize: "18px", lineHeight: 1.3, margin: "0 0 2px" }}>{event.event_name}</h2>
            <p style={{ color: "#9CA3AF", fontSize: "14px", margin: 0 }}>{event.club_name}</p>
          </div>
          <button onClick={onClose} style={{ color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontSize: "20px", padding: "2px", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
          <span style={{ color: "#E5E7EB", fontSize: "14px" }}>
            📅 {event.date ? format(new Date(event.date + "T00:00:00"), "EEEE, MMMM d") : "Date TBD"}
            {event.start_time ? ` at ${fmt12(event.start_time.slice(0, 5))}` : ""}
            {event.end_time ? ` – ${fmt12(event.end_time.slice(0, 5))}` : ""}
          </span>
          {event.campus_location && (
            <span style={{ color: "#E5E7EB", fontSize: "14px" }}>📍 {event.campus_location}{event.event_room ? `, ${event.event_room}` : ""}</span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
          {event.event_category && <span style={{ backgroundColor: catStyle.bg, color: catStyle.color, fontSize: "12px", padding: "3px 10px", borderRadius: "6px", fontWeight: 500, textTransform: "capitalize" as const }}>{event.event_category}</span>}
          {event.has_free_food && <span style={{ backgroundColor: "rgba(230,126,34,0.2)", color: "#F39C12", fontSize: "12px", padding: "3px 10px", borderRadius: "6px" }}>Free Food</span>}
          {event.virtual && <span style={{ backgroundColor: "rgba(155,89,182,0.2)", color: "#BB8FCE", fontSize: "12px", padding: "3px 10px", borderRadius: "6px" }}>Virtual</span>}
          {event.is_open_to_public && <span style={{ backgroundColor: "rgba(52,152,219,0.15)", color: "#5DADE2", fontSize: "12px", padding: "3px 10px", borderRadius: "6px" }}>Open to Public</span>}
        </div>

        {event.caption && (
          <p style={{ color: "#9CA3AF", fontSize: "13px", lineHeight: 1.6, borderLeft: "2px solid rgba(255,255,255,0.1)", paddingLeft: "12px", marginBottom: "16px" }}>
            {event.caption.slice(0, 120).trimEnd()}…
          </p>
        )}

        {score >= 70 && (
          <div style={{ backgroundColor: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.2)", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <span style={{ color: "#2ECC71", fontSize: "15px" }}>✦</span>
            <div>
              <p style={{ color: "#2ECC71", fontSize: "12px", fontWeight: 600, margin: "0 0 4px" }}>Strong Match</p>
              <p style={{ color: "#A9DFBF", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>{explainMatch(event, profile)}</p>
            </div>
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <p style={{ color: "#6B7280", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 10px" }}>
            {attendees?.count ?? 0} {isPast ? "Attended" : "Going"}
          </p>
          {attendees && attendees.preview.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {attendees.preview.map((p, i) => {
                const isConn = connectionIds.has(p.user_id);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", backgroundColor: isConn ? "rgba(46,204,113,0.15)" : "rgba(255,255,255,0.07)", border: `1px solid ${isConn ? "rgba(46,204,113,0.3)" : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600, color: isConn ? "#2ECC71" : "#9CA3AF", flexShrink: 0 }}>
                      {p.user_name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ color: "#E5E7EB", fontSize: "14px" }}>{p.user_name}</span>
                    {p.user_major && <span style={{ color: "#9CA3AF", fontSize: "12px" }}>· {p.user_major}</span>}
                    {isConn && <span style={{ color: "#2ECC71", fontSize: "11px", marginLeft: "2px" }}>connection</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "#6B7280", fontSize: "13px", margin: 0 }}>
              {isPast ? "No attendance data recorded for this event." : "No one has RSVP'd yet — be the first!"}
            </p>
          )}
        </div>

        {onRsvpToggle && !isPast && (
          <button onClick={() => onRsvpToggle(event.event_id)} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: `1px solid ${isGoing ? "#2ECC71" : "rgba(255,255,255,0.15)"}`, backgroundColor: isGoing ? "rgba(46,204,113,0.12)" : "rgba(255,255,255,0.05)", color: isGoing ? "#2ECC71" : "#E5E7EB", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
            {isGoing ? "✓ You're going!" : "Are you going?"}
          </button>
        )}

      </div>
    </div>
  );
}
