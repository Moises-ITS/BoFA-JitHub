/**
 * useJitiQuota.ts — owns the Jiti daily-quota state ({used, limit, remaining,
 * resetAt}) for the chat widget.
 *
 * Doubles as the feature-flag check: GET /api/jiti/status is fetched once,
 * on mount (once a token exists), and a 404 means the feature is off
 * server-side — JitiWidget reads `phase === "unavailable"` to render
 * nothing at all (fail closed, no launcher button). Any OTHER failure fails
 * OPEN with a conservative default (5/day) so a transient backend hiccup
 * doesn't hide the widget entirely; POST /api/jiti/chat remains the real,
 * authoritative gate on every send regardless.
 *
 * Cross-tab sync: after a successful send (in this tab or another), the
 * latest {used, remaining, resetAt} is mirrored to localStorage via
 * writeJsonCache (lib/localCache.ts). The native `storage` event fires in
 * every OTHER tab when that write happens, so they update their counter
 * with zero network calls. GET /api/jiti/status stays the source of truth
 * for a FRESH mount — the cache is only ever pushed into other tabs, never
 * read to seed this hook's own initial state.
 */
import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { writeJsonCache } from "@/lib/localCache"

const QUOTA_CACHE_KEY = "jithub.jiti-quota-cache"

/** Only used when the status endpoint fails for a reason OTHER than 404
 *  (network hiccup, 500, etc). Matches the product's 5/day cap; the chat
 *  endpoint itself is the real enforcement point regardless of this guess. */
const FALLBACK_LIMIT = 5

export type JitiQuotaPhase = "loading" | "unavailable" | "ready"

export interface JitiQuotaState {
  phase: JitiQuotaPhase
  used: number
  limit: number
  remaining: number
  resetAt: string | null
  /** Call after a successful (200) POST /api/jiti/chat. */
  applySendResult: (remainingToday: number, resetAt: string) => void
  /** Call after a 429 QUOTA_EXCEEDED POST /api/jiti/chat response. */
  applyQuotaExceeded: (used: number, limit: number, resetAt: string) => void
}

interface StatusResponse {
  used: number
  limit: number
  remaining: number
  resetAt: string
}

interface ReadyState {
  phase: "ready"
  used: number
  limit: number
  remaining: number
  resetAt: string | null
}

type InternalState = { phase: "loading" } | { phase: "unavailable" } | ReadyState

interface QuotaCachePayload {
  used: number
  remaining: number
  resetAt: string | null
}

function isQuotaCachePayload(value: unknown): value is QuotaCachePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<QuotaCachePayload>).used === "number" &&
    typeof (value as Partial<QuotaCachePayload>).remaining === "number"
  )
}

export function useJitiQuota(token: string | null): JitiQuotaState {
  const [state, setState] = useState<InternalState>({ phase: "loading" })

  // Feature-flag check + initial quota fetch — runs exactly once per mount
  // (once a token is available). Opening the panel does NOT re-fetch; the
  // panel just renders whatever this effect already resolved.
  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function loadStatus() {
      try {
        const { ok, status, data } = await apiFetch<StatusResponse>("/api/jiti/status", token)
        if (cancelled) return
        if (status === 404) {
          setState({ phase: "unavailable" })
          return
        }
        if (ok) {
          setState({
            phase: "ready",
            used: data.used,
            limit: data.limit,
            remaining: data.remaining,
            resetAt: data.resetAt,
          })
          return
        }
        setState({ phase: "ready", used: 0, limit: FALLBACK_LIMIT, remaining: FALLBACK_LIMIT, resetAt: null })
      } catch {
        if (!cancelled) {
          setState({ phase: "ready", used: 0, limit: FALLBACK_LIMIT, remaining: FALLBACK_LIMIT, resetAt: null })
        }
      }
    }

    loadStatus()
    return () => {
      cancelled = true
    }
  }, [token])

  // Cross-tab sync: another tab's successful send writes QUOTA_CACHE_KEY;
  // the native storage event lets THIS tab pick it up with no fetch.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== QUOTA_CACHE_KEY || !event.newValue) return
      try {
        const envelope = JSON.parse(event.newValue) as { value?: unknown }
        if (!isQuotaCachePayload(envelope.value)) return
        const payload = envelope.value
        setState((prev) => (prev.phase === "ready" ? { ...prev, ...payload } : prev))
      } catch {
        // Corrupted payload from another tab (half-written write) — ignore.
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const applySendResult = useCallback((remainingToday: number, resetAt: string) => {
    setState((prev) => {
      if (prev.phase !== "ready") return prev
      const remaining = Math.max(0, remainingToday)
      const used = Math.max(0, prev.limit - remaining)
      writeJsonCache<QuotaCachePayload>(QUOTA_CACHE_KEY, { used, remaining, resetAt })
      return { phase: "ready", used, limit: prev.limit, remaining, resetAt }
    })
  }, [])

  const applyQuotaExceeded = useCallback((used: number, limit: number, resetAt: string) => {
    setState((prev) => {
      if (prev.phase !== "ready") return prev
      const nextLimit = limit || prev.limit
      const nextUsed = Math.max(0, used)
      const remaining = Math.max(0, nextLimit - nextUsed)
      return { phase: "ready", used: nextUsed, limit: nextLimit, remaining, resetAt }
    })
  }, [])

  if (state.phase !== "ready") {
    return {
      phase: state.phase,
      used: 0,
      limit: FALLBACK_LIMIT,
      remaining: FALLBACK_LIMIT,
      resetAt: null,
      applySendResult,
      applyQuotaExceeded,
    }
  }

  return { ...state, applySendResult, applyQuotaExceeded }
}
