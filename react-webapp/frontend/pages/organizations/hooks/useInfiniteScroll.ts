/**
 * useInfiniteScroll — IntersectionObserver-driven "load the next batch".
 *
 * NEW INFRASTRUCTURE, flagged deliberately: nothing else in this repo uses
 * IntersectionObserver. Kept to one small hook so the dependency is auditable.
 *
 * Returns a CALLBACK ref to attach to a sentinel element rendered after the last
 * grid item. A callback ref, not `useRef` + `useEffect`: the sentinel unmounts
 * and remounts as the list re-renders, and the ref/effect pairing silently loses
 * its observer when that happens — the classic "loads page 2, then never again"
 * bug.
 */
import { useCallback, useEffect, useRef } from "react"

export function useInfiniteScroll(opts: {
  onLoadMore: () => void
  /** False while a request is in flight, or once hasMore is false. */
  enabled: boolean
  /** Prefetch distance — how early to fire before the sentinel is on screen. */
  rootMargin?: string
}): (node: HTMLElement | null) => void {
  const { onLoadMore, enabled, rootMargin = "400px" } = opts

  // The callback lives in a ref so a re-render with a new closure does NOT tear
  // down and rebuild the observer. Rebuilding on every state change makes the
  // observer fire again the instant it re-attaches to a still-visible sentinel,
  // which is how infinite scroll turns into an infinite fetch loop.
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const observerRef = useRef<IntersectionObserver | null>(null)

  // Disconnect on unmount. Without this the observer outlives the page and keeps
  // a reference to a detached node.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [])

  return useCallback(
    (node: HTMLElement | null) => {
      // Always drop the previous observer first — a ref callback fires with null
      // on detach and with the new node on attach, and leaking the old one would
      // double-fire onLoadMore.
      observerRef.current?.disconnect()
      observerRef.current = null

      if (!node) return

      // jsdom does not implement IntersectionObserver. Without this guard every
      // component test that mounts the grid throws on mount. Degrading to a
      // no-op is correct: the page still renders, it just never auto-paginates.
      if (typeof IntersectionObserver === "undefined") return

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && enabledRef.current) {
              onLoadMoreRef.current()
              break
            }
          }
        },
        { threshold: 0, rootMargin }
      )
      observer.observe(node)
      observerRef.current = observer
    },
    // `enabled` IS a dependency on purpose, even though the observer reads it
    // through a ref. IntersectionObserver only reports *transitions*: if the
    // sentinel was already on screen while a request was in flight, flipping
    // `enabled` back to true produces no new entry and pagination dead-ends.
    // Changing this callback's identity makes React detach and re-attach the
    // sentinel, which re-evaluates intersection immediately. `onLoadMore` stays
    // out of the deps — that one changes every render and would rebuild the
    // observer constantly.
    [rootMargin, enabled]
  )
}
