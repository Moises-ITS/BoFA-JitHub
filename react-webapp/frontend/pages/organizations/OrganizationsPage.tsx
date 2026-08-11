/**
 * OrganizationsPage — the campus organization directory.
 *
 * STATE OWNERSHIP: this component owns EVERYTHING. OrgGrid, OrgCard, StarButton,
 * OrgFilterBar, and OrgDetailModal are all controlled and presentational. That is
 * the mechanism behind AC 26 — the grid card and the modal read the same
 * `starred` Set and the same `starCounts` map, so they are structurally incapable
 * of disagreeing about whether an org is starred.
 *
 * SEARCH AND FILTERING ARE SERVER-SIDE. The `q` parameter already matches the
 * canonical name, the display name, every duplicate spelling the dedup pass
 * folded in, the Instagram handle, and the ported acronym list. There is
 * deliberately no client-side alias table and no client-side filtering of the
 * loaded pages — a second implementation of "does this org match?" would drift
 * from the server's within a sprint.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { OrgFilterBar } from "./components/OrgFilterBar"
import { OrgGrid } from "./components/OrgGrid"
import { OrgDetailModal } from "./components/OrgDetailModal"
import { useInfiniteScroll } from "./hooks/useInfiniteScroll"
import {
  fetchMyStars,
  fetchOrganizationDetail,
  fetchOrganizations,
  setOrganizationStar,
} from "./api/organizationsApi"
import {
  ORG_PAGE_SIZE,
  type Organization,
  type OrganizationDetail,
  type OrgTypeFilter,
} from "./types/organizations"

/** How long the input sits still before a request goes out. */
const SEARCH_DEBOUNCE_MS = 250

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export default function OrganizationsPage() {
  const { token } = useAuth()

  // ── Directory data ────────────────────────────────────────────────────────
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Search + filter ───────────────────────────────────────────────────────
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<OrgTypeFilter>("all")

  // ── Stars ─────────────────────────────────────────────────────────────────
  const [starred, setStarred] = useState<Set<number>>(new Set())
  const [starCounts, setStarCounts] = useState<Record<number, number>>({})
  const [pendingStars, setPendingStars] = useState<Set<number>>(new Set())
  const [starError, setStarError] = useState<string | null>(null)

  // ── Detail modal ──────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Organization | null>(null)
  const [detail, setDetail] = useState<OrganizationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  /**
   * Request nonce. Responses can land out of order — a slow "Chess" request can
   * resolve after a fast "Chessx" one and repaint results for a query the user
   * has already moved past. Every fetch stamps itself; a response whose stamp is
   * no longer current is dropped. This, not the debounce, is what actually
   * satisfies AC 12.
   */
  const requestNonce = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const loadPage = useCallback(
    async (offset: number, q: string, type: OrgTypeFilter, replace: boolean) => {
      const nonce = ++requestNonce.current
      setLoading(true)
      setError(null)
      try {
        const response = await fetchOrganizations({ q, type, limit: ORG_PAGE_SIZE, offset })
        if (requestNonce.current !== nonce) return
        setOrgs((prev) => (replace ? response.organizations : [...prev, ...response.organizations]))
        setTotal(response.total)
        setHasMore(response.has_more)
        // Seed counts from the wire, but never clobber a value we already own —
        // an optimistic toggle (or a reconciled server count) must survive a
        // later page landing with the number this org had at serialisation time.
        setStarCounts((prev) => {
          const next = { ...prev }
          for (const org of response.organizations) {
            if (!(org.club_id in next)) next[org.club_id] = org.star_count
          }
          return next
        })
      } catch (err) {
        if (requestNonce.current !== nonce) return
        setError(errorMessage(err, "Could not load organizations right now."))
        // Stop the observer from retrying the same failing page forever.
        setHasMore(false)
        if (replace) {
          setOrgs([])
          setTotal(0)
        }
      } finally {
        if (requestNonce.current === nonce) setLoading(false)
      }
    },
    []
  )

  // A new search or a new type filter is a fresh list, not an append. Clearing
  // `orgs` here rather than when the response lands is what stops the previous
  // query's cards from lingering under the new one (AC 12).
  useEffect(() => {
    setOrgs([])
    setTotal(null)
    setHasMore(true)
    void loadPage(0, debouncedQuery, typeFilter, true)
  }, [debouncedQuery, typeFilter, loadPage])

  const handleLoadMore = useCallback(() => {
    if (loading || !hasMore) return
    // `orgs.length` IS the correct offset: the server sorts by name ASC on every
    // page, which is exactly the stability offset pagination requires.
    void loadPage(orgs.length, debouncedQuery, typeFilter, false)
  }, [loading, hasMore, orgs.length, debouncedQuery, typeFilter, loadPage])

  const sentinelRef = useInfiniteScroll({
    onLoadMore: handleLoadMore,
    enabled: !loading && hasMore,
  })

  // Starred ids come from the server, never from localStorage — that is what
  // makes a star survive a reload (AC 23) and appear on a second device (AC 24).
  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchMyStars(token)
      .then((clubIds) => {
        if (cancelled) return
        setStarred(new Set(clubIds))
      })
      .catch(() => {
        // A failed my-stars read means every org renders unlit. Annoying, not
        // broken, and the counts are still correct — not worth an error banner
        // that would sit above a working directory.
      })
    return () => {
      cancelled = true
    }
  }, [token])

  // Detail needs auth (it carries the caller's connections), so it is a separate
  // fetch from the public list. The modal opens immediately on the list entry and
  // fills in connections when this lands — no blocking spinner over the whole
  // panel.
  useEffect(() => {
    const clubId = selected?.club_id
    if (!clubId) {
      setDetail(null)
      setDetailError(null)
      setDetailLoading(false)
      return
    }
    if (!token) {
      setDetail(null)
      setDetailLoading(false)
      setDetailError("Sign in to see which of your connections are involved.")
      return
    }

    let cancelled = false
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    fetchOrganizationDetail(clubId, token)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
      })
      .catch((err) => {
        if (cancelled) return
        setDetailError(errorMessage(err, "Could not load this organization's details."))
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selected?.club_id, token])

  /**
   * Optimistic star toggle (AC 20, 21, 22).
   *
   * Flip locally, write, then reconcile against the server's authoritative
   * count. On failure restore BOTH the lit state and the count — leaving a lit
   * star for a write that never saved is the exact failure AC 22 forbids.
   */
  const toggleStar = useCallback(
    async (clubId: number) => {
      if (!token) {
        setStarError("Sign in to star organizations.")
        return
      }
      // The write endpoint is rate-limited, and both verbs are idempotent, so the
      // useful guard is "one in-flight write per org" rather than a debounce.
      if (pendingStars.has(clubId)) return

      const wasStarred = starred.has(clubId)
      const previousCount = starCounts[clubId] ?? 0

      setStarError(null)
      setStarred((prev) => {
        const next = new Set(prev)
        if (wasStarred) next.delete(clubId)
        else next.add(clubId)
        return next
      })
      setStarCounts((prev) => ({
        ...prev,
        [clubId]: Math.max(0, previousCount + (wasStarred ? -1 : 1)),
      }))
      setPendingStars((prev) => new Set(prev).add(clubId))

      try {
        const result = await setOrganizationStar(clubId, !wasStarred, token)
        // The returned club_id MAY DIFFER from the one we sent: writes
        // canonicalise onto the surviving row of a dedup group. Reconcile both
        // ids so a duplicate row can never show a different count or lit state
        // than its canonical twin.
        setStarCounts((prev) => ({
          ...prev,
          [clubId]: result.star_count,
          [result.club_id]: result.star_count,
        }))
        if (result.club_id !== clubId) {
          setStarred((prev) => {
            const next = new Set(prev)
            if (wasStarred) next.delete(result.club_id)
            else next.add(result.club_id)
            return next
          })
        }
      } catch (err) {
        setStarred((prev) => {
          const next = new Set(prev)
          if (wasStarred) next.add(clubId)
          else next.delete(clubId)
          return next
        })
        setStarCounts((prev) => ({ ...prev, [clubId]: previousCount }))
        setStarError(errorMessage(err, "Could not save your star. Please try again."))
      } finally {
        setPendingStars((prev) => {
          const next = new Set(prev)
          next.delete(clubId)
          return next
        })
      }
    },
    [token, pendingStars, starred, starCounts]
  )

  const showEmptyState = !loading && !error && orgs.length === 0

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="mb-1 text-3xl font-semibold">
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--brand-gradient)" }}
            >
              Organizations
            </span>
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Every club, sorority, and fraternity on campus.
          </p>
        </div>

        <OrgFilterBar
          query={query}
          onQueryChange={setQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          resultCount={total}
        />

        {/* Inline dismissible banner, not window.alert: a modal alert would steal
            focus and lose the user's scroll position, which AC 20 protects. */}
        {starError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: "var(--status-error-soft)",
              border: "1px solid rgba(243,111,111,0.3)",
              color: "var(--status-error)",
            }}
          >
            <span>{starError}</span>
            <button
              type="button"
              onClick={() => setStarError(null)}
              aria-label="Dismiss"
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: "var(--status-error-soft)",
              border: "1px solid rgba(243,111,111,0.3)",
              color: "var(--status-error)",
            }}
          >
            {error}
          </div>
        )}

        {loading && orgs.length === 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={`org-skeleton-${index}`}
                className="animate-pulse rounded-xl p-4"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
              >
                <div
                  className="mb-3 h-10 w-10 rounded-lg"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                />
                <div className="mb-2 h-4 rounded" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                <div
                  className="h-3 w-2/3 rounded"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                />
              </div>
            ))}
          </div>
        )}

        {showEmptyState && (
          <div className="py-16 text-center" style={{ color: "var(--text-muted)" }}>
            <p className="mb-3 text-4xl">🔍</p>
            <p className="font-medium text-white">No organizations found</p>
            <p className="mt-1 text-sm">
              {query.trim() || typeFilter !== "all"
                ? "Try a different search or filter."
                : "Check back soon."}
            </p>
          </div>
        )}

        {orgs.length > 0 && (
          <OrgGrid
            organizations={orgs}
            starred={starred}
            starCounts={starCounts}
            pendingStars={pendingStars}
            hasMore={hasMore}
            loadingMore={loading}
            sentinelRef={sentinelRef}
            onToggleStar={toggleStar}
            onSelect={setSelected}
          />
        )}
      </div>

      {/* Sibling overlay on a still-mounted page — never a nested route. Closing
          it restores scroll, search text, and filter for free (AC 31). */}
      {selected && (
        <OrgDetailModal
          org={selected}
          detail={detail}
          detailLoading={detailLoading}
          detailError={detailError}
          starred={starred.has(selected.club_id)}
          starCount={starCounts[selected.club_id] ?? selected.star_count}
          starPending={pendingStars.has(selected.club_id)}
          onToggleStar={() => void toggleStar(selected.club_id)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
