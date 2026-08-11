/**
 * OrgCard — one tile in the directory grid. Purely presentational: every piece
 * of state it renders is owned by OrganizationsPage.
 *
 * The avatar is the canonical ClubAvatar from pages/events/components. It is
 * imported, never copied — that component already got de-duplicated once after
 * existing in three places, and its `/club_pics/{club_id}.jpg` + emoji-onError
 * behaviour is exactly AC 28.
 */
import { motion } from "motion/react"
import { ClubAvatar } from "../../events/components/ClubAvatar"
import { StarButton } from "./StarButton"
import type { Organization } from "../types/organizations"

const TYPE_LABEL: Record<Organization["type"], string> = {
  club: "Club",
  sorority: "Sorority",
  fraternity: "Fraternity",
}

const TYPE_STYLE: Record<Organization["type"], { bg: string; color: string }> = {
  club: { bg: "var(--accent-orgs-soft)", color: "var(--accent-orgs)" },
  sorority: { bg: "rgba(215,25,32,0.12)", color: "#f0a7ab" },
  fraternity: { bg: "rgba(122,132,240,0.12)", color: "var(--accent-networking)" },
}

export function OrgCard({
  org,
  index,
  starred,
  starCount,
  starPending,
  onToggleStar,
  onSelect,
}: {
  org: Organization
  /** Position in the rendered list — only feeds ClubAvatar's emoji fallback. */
  index: number
  starred: boolean
  starCount: number
  starPending: boolean
  onToggleStar: () => void
  onSelect: () => void
}) {
  const badge = TYPE_STYLE[org.type] ?? TYPE_STYLE.club
  // The full name is redundant when display_name is just the same string; only
  // show it as a subtitle when it actually adds information.
  const showFullName = org.display_name.trim().toLowerCase() !== org.name.trim().toLowerCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      whileHover={{ y: -3 }}
      role="button"
      tabIndex={0}
      aria-label={`View ${org.display_name}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className="flex h-full cursor-pointer flex-col rounded-xl p-4 transition-all"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <ClubAvatar clubId={org.club_id} clubName={org.display_name} index={index} />
        <StarButton
          starred={starred}
          count={starCount}
          disabled={starPending}
          onToggle={onToggleStar}
          label={org.display_name}
        />
      </div>

      <h3 className="mb-1 text-sm font-semibold text-white" style={{ lineHeight: 1.35 }}>
        {org.display_name}
      </h3>
      {showFullName && (
        <p className="mb-2 truncate text-xs" style={{ color: "var(--text-muted)" }}>
          {org.name}
        </p>
      )}

      {/* AC 27's sibling case: no bio means no description block anywhere, not a
          placeholder implying the data is broken. */}
      {org.bio && (
        <p
          className="mb-3 text-xs"
          style={{
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {org.bio}
        </p>
      )}

      <div className="mt-auto pt-2">
        <span
          className="rounded-md px-2 py-1 text-[11px] font-medium"
          style={{ backgroundColor: badge.bg, color: badge.color }}
        >
          {TYPE_LABEL[org.type] ?? org.type}
        </span>
      </div>
    </motion.div>
  )
}
