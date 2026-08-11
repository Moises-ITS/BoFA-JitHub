// ─────────────────────────────────────────────────────────────────────────────
// OrgGrid.test.tsx
//
// Proves:
//  - a full 24-org batch renders 24 cards (Resolution R5's page size)
//  - the responsive column classes are 1 / 2 / 4 (Decision 7, AC 5-7)
//  - the lazy-load sentinel exists only while more pages remain (AC 9)
//  - an intersection fires onLoadMore exactly once per event, and never while
//    the hook is disabled (a request already in flight, or nothing left to load)
//  - each card shows its own star state, sourced from the page's maps (AC 18/19)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { OrgGrid } from "./OrgGrid"
import { useInfiniteScroll } from "../hooks/useInfiniteScroll"
import type { Organization } from "../types/organizations"

// jsdom does not implement IntersectionObserver, so the hook's real code path is
// unreachable without this. Stubbed PER FILE rather than in test-setup.ts: that
// setup file is shared by every test in the repo, and quietly handing all of them
// a fake browser API is exactly the kind of change that makes an unrelated suite
// pass for the wrong reason.
let intersectionCallbacks: IntersectionObserverCallback[] = []
let disconnectCount = 0

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallbacks.push(callback)
  }
  observe() {}
  unobserve() {}
  disconnect() {
    disconnectCount += 1
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

/** Fire the most recently created observer's callback. */
function triggerIntersection(isIntersecting: boolean, entryCount = 1) {
  const callback = intersectionCallbacks[intersectionCallbacks.length - 1]
  const entries = Array.from({ length: entryCount }, () => ({ isIntersecting })) as
    unknown as IntersectionObserverEntry[]
  callback(entries, {} as IntersectionObserver)
}

function makeOrgs(count: number): Organization[] {
  return Array.from({ length: count }, (_, i) => ({
    club_id: i + 1,
    name: `Organization ${i + 1}`,
    display_name: `Organization ${i + 1}`,
    bio: null,
    type: "club" as const,
    instagram_handle: null,
    logo_url: `/club_pics/${i + 1}.jpg`,
    star_count: 0,
  }))
}

function Harness({
  organizations,
  hasMore = true,
  enabled = true,
  onLoadMore = () => {},
  starred = new Set<number>(),
  starCounts = {} as Record<number, number>,
}: {
  organizations: Organization[]
  hasMore?: boolean
  enabled?: boolean
  onLoadMore?: () => void
  starred?: Set<number>
  starCounts?: Record<number, number>
}) {
  const sentinelRef = useInfiniteScroll({ onLoadMore, enabled })
  return (
    <OrgGrid
      organizations={organizations}
      starred={starred}
      starCounts={starCounts}
      pendingStars={new Set()}
      hasMore={hasMore}
      loadingMore={false}
      sentinelRef={sentinelRef}
      onToggleStar={() => {}}
      onSelect={() => {}}
    />
  )
}

describe("OrgGrid", () => {
  beforeEach(() => {
    intersectionCallbacks = []
    disconnectCount = 0
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders one card per organization for a full 24-org batch", () => {
    render(<Harness organizations={makeOrgs(24)} />)

    expect(screen.getAllByRole("button", { name: /^View Organization/ })).toHaveLength(24)
  })

  it("uses 1 / 2 / 4 responsive columns", () => {
    render(<Harness organizations={makeOrgs(4)} />)

    const grid = screen.getByTestId("org-grid")
    expect(grid.className).toContain("grid-cols-1")
    expect(grid.className).toContain("md:grid-cols-2")
    expect(grid.className).toContain("lg:grid-cols-4")
  })

  it("renders the sentinel while more pages remain", () => {
    render(<Harness organizations={makeOrgs(24)} hasMore />)

    expect(screen.getByTestId("org-grid-sentinel")).toBeInTheDocument()
  })

  it("omits the sentinel once every matching organization has been shown", () => {
    render(<Harness organizations={makeOrgs(3)} hasMore={false} />)

    expect(screen.queryByTestId("org-grid-sentinel")).not.toBeInTheDocument()
  })

  it("calls onLoadMore exactly once for one intersection event, even with several entries", () => {
    const onLoadMore = vi.fn()
    render(<Harness organizations={makeOrgs(24)} onLoadMore={onLoadMore} />)

    triggerIntersection(true, 3)

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it("ignores an entry that is not intersecting", () => {
    const onLoadMore = vi.fn()
    render(<Harness organizations={makeOrgs(24)} onLoadMore={onLoadMore} />)

    triggerIntersection(false)

    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it("does not fire while disabled — a request is already in flight", () => {
    const onLoadMore = vi.fn()
    render(<Harness organizations={makeOrgs(24)} onLoadMore={onLoadMore} enabled={false} />)

    triggerIntersection(true)

    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it("disconnects its observer on unmount", () => {
    const { unmount } = render(<Harness organizations={makeOrgs(24)} />)

    unmount()

    expect(disconnectCount).toBeGreaterThan(0)
  })

  it("gives each card its own lit state and count from the page's maps", () => {
    render(
      <Harness
        organizations={makeOrgs(2)}
        starred={new Set([2])}
        starCounts={{ 1: 4, 2: 9 }}
      />
    )

    expect(screen.getByRole("button", { name: "Star Organization 1" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(screen.getByRole("button", { name: "Unstar Organization 2" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("9")).toBeInTheDocument()
  })

  it("opens the detail view when a card is clicked", () => {
    const onSelect = vi.fn()
    const orgs = makeOrgs(1)
    const sentinelNoop = () => {}
    render(
      <OrgGrid
        organizations={orgs}
        starred={new Set()}
        starCounts={{}}
        pendingStars={new Set()}
        hasMore={false}
        loadingMore={false}
        sentinelRef={sentinelNoop}
        onToggleStar={() => {}}
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "View Organization 1" }))

    expect(onSelect).toHaveBeenCalledWith(orgs[0])
  })
})
