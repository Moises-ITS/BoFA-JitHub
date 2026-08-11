/**
 * StarButton — the star control, rendered IDENTICALLY by the grid card and the
 * detail modal.
 *
 * It holds ZERO state. Both call sites read the same `starred` Set and the same
 * count map from OrganizationsPage, which is what makes AC 26 ("toggling in one
 * place updates the other") structurally guaranteed rather than something that
 * has to be kept in sync by hand.
 *
 * `aria-pressed` — not a CSS class — is the machine-readable lit/unlit signal
 * (AC 19), so screen readers and the component tests agree on the same source of
 * truth.
 */
import { Star } from "lucide-react"

export function StarButton({
  starred,
  count,
  onToggle,
  disabled = false,
  size = "sm",
  label,
}: {
  starred: boolean
  count: number
  onToggle: () => void
  /** True while a write for this org is in flight — prevents double-submits
   *  against the 120-writes/15-min rate limit. */
  disabled?: boolean
  size?: "sm" | "lg"
  /** Org name, folded into the accessible name so multiple stars are distinguishable. */
  label?: string
}) {
  const iconSize = size === "lg" ? 18 : 16

  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={`${starred ? "Unstar" : "Star"}${label ? ` ${label}` : ""}`}
      disabled={disabled}
      onClick={(e) => {
        // Stops the click bubbling to the card, which would open the detail
        // modal — AC 20 requires starring "without navigating away".
        e.stopPropagation()
        if (disabled) return
        onToggle()
      }}
      className="flex items-center gap-1.5 rounded-lg transition-colors"
      style={{
        padding: size === "lg" ? "8px 12px" : "5px 8px",
        border: `1px solid ${starred ? "rgba(245,197,66,0.32)" : "var(--border-default)"}`,
        backgroundColor: starred ? "rgba(245,197,66,0.12)" : "rgba(255,255,255,0.04)",
        color: starred ? "#f5c542" : "var(--text-muted)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        fontSize: size === "lg" ? "14px" : "12px",
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      <Star
        width={iconSize}
        height={iconSize}
        // fill is what actually reads as "lit" at a glance; the colour alone is
        // too subtle at 16px.
        fill={starred ? "#f5c542" : "none"}
        aria-hidden="true"
      />
      <span>{count}</span>
    </button>
  )
}
