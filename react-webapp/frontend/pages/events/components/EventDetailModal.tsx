/**
 * EventDetailModal — the event popup, and ONLY the event popup.
 *
 * This file used to also export the scoring engine (affinity tables,
 * matchScore/explainMatch), formatting helpers (fmt12, CATEGORY_STYLE, ...),
 * and the ClubAvatar component — which broke React Fast Refresh for the three
 * pages importing it and hid the recommendation engine inside "a modal".
 * Those now live in ../utils/eventScoring, ../utils/eventFormatting, and
 * ./ClubAvatar. Import from there, not from here.
 */
import { format } from "date-fns";
import { CATEGORY_STYLE, fmt12, getEventCategories } from "../utils/eventFormatting";
import { matchScore, explainMatch, type UserProfile } from "../utils/eventScoring";
import { ClubAvatar } from "./ClubAvatar";

// Re-exported so existing `import type { UserProfile } from ".../EventDetailModal"`
// call sites keep compiling; the canonical home is eventScoring.
export type { UserProfile };

export interface AttendeeInfo { count: number; preview: { user_id: string; user_name: string; user_major: string }[] }

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

        {/* AttendanceForm removed: it submits to /api/eden/*, which is only
            mounted when the parked EDEN feature is enabled (ENABLE_EDEN=true
            on the backend) — in production today every submission silently
            404s. Restore this render when EDEN ships in v2:
              {isPast && event.date && event.club_id != null && (
                <AttendanceForm eventId={event.event_id} clubId={event.club_id} eventDate={event.date} />
              )}
            The component itself is parked at ./AttendanceForm.tsx. */}

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
