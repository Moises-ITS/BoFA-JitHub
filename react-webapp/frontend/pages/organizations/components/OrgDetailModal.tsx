/**
 * OrgDetailModal — the organization popup.
 *
 * WHY THIS DUPLICATES EventDetailModal'S STYLE VALUES INSTEAD OF IMPORTING IT
 * ---------------------------------------------------------------------------
 * The visual template below (overlay, panel, header row, description rule,
 * person list) is copied deliberately from
 * pages/events/components/EventDetailModal.tsx so the two modals look identical.
 * It does NOT import or extend that component, because EventDetailModal is
 * event-shaped to its core: it calls matchScore(), reads event.date /
 * event.caption / event.collaborators, and renders RSVP. Extracting a shared
 * shell would mean editing a file three pages already render — real regression
 * risk against "the Events page behaves exactly as before" for zero benefit
 * here. The coupling that matters (the design tokens) is shared; the coupling
 * that would hurt (the component tree) is not.
 *
 * The avatar IS imported from the canonical ClubAvatar — that one is genuinely
 * shared, and copying it would be a fourth copy of a component that was
 * de-duplicated on purpose.
 *
 * AC 31: this renders as a sibling overlay on the still-mounted page, NOT as a
 * nested route. Closing it therefore restores scroll, search text, and the type
 * filter for free, because none of that state ever unmounted.
 */
import { ClubAvatar } from "../../events/components/ClubAvatar"
import { StarButton } from "./StarButton"
import type { Organization, OrganizationDetail } from "../types/organizations"

const TYPE_LABEL: Record<Organization["type"], string> = {
  club: "Club",
  sorority: "Sorority",
  fraternity: "Fraternity",
}

export function OrgDetailModal({
  org,
  detail,
  detailLoading,
  detailError,
  starred,
  starCount,
  starPending,
  onToggleStar,
  onClose,
}: {
  /** The list entry — always present, so the modal paints instantly on click. */
  org: Organization
  /** The authenticated fetch, which adds `connections`. Null until it lands. */
  detail: OrganizationDetail | null
  detailLoading: boolean
  detailError: string | null
  starred: boolean
  starCount: number
  starPending: boolean
  onToggleStar: () => void
  onClose: () => void
}) {
  // Prefer the richer detail payload once it arrives, but never block on it.
  const bio = detail?.bio ?? org.bio
  const connections = detail?.connections ?? []
  const showFullName = org.display_name.trim().toLowerCase() !== org.name.trim().toLowerCase()

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={org.display_name}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
          <ClubAvatar clubId={org.club_id} clubName={org.display_name} index={0} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ color: "#fff", fontWeight: 600, fontSize: "18px", lineHeight: 1.3, margin: "0 0 2px" }}>
              {org.display_name}
            </h2>
            {showFullName && (
              <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: 0 }}>{org.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "20px",
              padding: "2px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
          <span
            style={{
              backgroundColor: "var(--accent-orgs-soft)",
              color: "var(--accent-orgs)",
              fontSize: "12px",
              padding: "3px 10px",
              borderRadius: "6px",
              fontWeight: 500,
            }}
          >
            {TYPE_LABEL[org.type] ?? org.type}
          </span>
          {org.instagram_handle && (
            <span
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                color: "var(--text-muted)",
                fontSize: "12px",
                padding: "3px 10px",
                borderRadius: "6px",
              }}
            >
              @{org.instagram_handle.replace(/^@/, "")}
            </span>
          )}
        </div>

        {/* AC 27: an org with no bio simply has no description block. No "No
            description available" placeholder — that reads as broken data. */}
        {bio && (
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
            {bio}
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <p
            style={{
              color: "var(--text-subtle)",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
              margin: "0 0 10px",
            }}
          >
            Connections Involved
          </p>

          {detailLoading ? (
            <p style={{ color: "var(--text-subtle)", fontSize: "13px", margin: 0 }}>
              Loading connections…
            </p>
          ) : detailError ? (
            <p style={{ color: "var(--text-subtle)", fontSize: "13px", margin: 0 }}>{detailError}</p>
          ) : connections.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {connections.map((connection) => (
                <div key={connection.user_id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      backgroundColor: "var(--status-success-soft)",
                      border: "1px solid rgba(63,199,141,0.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--status-success)",
                      flexShrink: 0,
                    }}
                  >
                    {connection.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ color: "var(--text-primary)", fontSize: "14px" }}>{connection.name}</span>
                  {connection.major && (
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>· {connection.major}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // ONE string for AC 29 and AC 30 both. Resolution R2 is explicit:
            // do not distinguish "you have no connections" from "none of them
            // are here" — the user cannot act on the difference.
            <p style={{ color: "var(--text-subtle)", fontSize: "13px", margin: 0 }}>
              None of your connections are in this organization yet.
            </p>
          )}
        </div>

        {/* Same StarButton instance type as the card, fed the same page state —
            they cannot disagree (AC 26). */}
        <StarButton
          starred={starred}
          count={starCount}
          disabled={starPending}
          onToggle={onToggleStar}
          size="lg"
          label={org.display_name}
        />
      </div>
    </div>
  )
}
