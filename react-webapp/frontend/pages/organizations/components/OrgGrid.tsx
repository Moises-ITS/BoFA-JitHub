/**
 * OrgGrid — the responsive directory grid plus the lazy-load sentinel.
 *
 * Columns are 1 / 2 / 4 (mobile / tablet / desktop) per Decision 7, using the
 * same Tailwind breakpoint idiom the Events page uses so the two pages share a
 * layout rhythm.
 *
 * Stateless. The sentinel's ref comes from the page's useInfiniteScroll hook, so
 * this component knows nothing about IntersectionObserver.
 */
import { OrgCard } from "./OrgCard"
import type { Organization } from "../types/organizations"

export function OrgGrid({
  organizations,
  starred,
  starCounts,
  pendingStars,
  hasMore,
  loadingMore,
  sentinelRef,
  onToggleStar,
  onSelect,
}: {
  organizations: Organization[]
  starred: Set<number>
  starCounts: Record<number, number>
  pendingStars: Set<number>
  hasMore: boolean
  loadingMore: boolean
  sentinelRef: (node: HTMLElement | null) => void
  onToggleStar: (clubId: number) => void
  onSelect: (org: Organization) => void
}) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="org-grid">
        {organizations.map((org, index) => (
          <OrgCard
            key={org.club_id}
            org={org}
            index={index}
            starred={starred.has(org.club_id)}
            // The page's live count wins over the value the list response was
            // serialised with, so an optimistic toggle shows instantly and a
            // later page fetch cannot resurrect a stale number.
            starCount={starCounts[org.club_id] ?? org.star_count}
            starPending={pendingStars.has(org.club_id)}
            onToggleStar={() => onToggleStar(org.club_id)}
            onSelect={() => onSelect(org)}
          />
        ))}
      </div>

      {/* Sentinel: rendered only while more pages exist, so once the directory is
          exhausted there is nothing left for the observer to watch. */}
      {hasMore && (
        <div
          ref={sentinelRef}
          data-testid="org-grid-sentinel"
          aria-hidden="true"
          style={{ height: "1px" }}
        />
      )}

      {loadingMore && (
        <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Loading more organizations…
        </p>
      )}
    </div>
  )
}
