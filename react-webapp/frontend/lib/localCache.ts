/**
 * localCache.ts — one localStorage JSON cache implementation.
 *
 * WHY: this exact pattern (read key → JSON.parse in a try/catch → validate
 * shape → optionally expire by timestamp; write key → JSON.stringify in a
 * try/catch) was hand-rolled independently in AuthContext (cached user) and
 * Home (overview cache), each with its own subtle differences. Cache code is
 * boring and should be boring EVERYWHERE — one implementation means one place
 * to fix quota handling, corruption handling, and TTL logic.
 *
 * DESIGN NOTES:
 * - `validate` exists because localStorage outlives deployments: a cache
 *   written by last month's build may not match this month's shape. A failed
 *   validation reads as "no cache", never as a crash.
 * - Every storage call is wrapped: localStorage throws in private-browsing
 *   modes and when the quota is full. Caches are UX niceties — they must
 *   degrade to "no cache", never take a page down.
 * - TTL is stored INSIDE the envelope (cachedAt) so expiry survives reloads.
 */

interface CacheEnvelope<T> {
  cachedAt: number
  value: T
}

export function readJsonCache<T>(
  key: string,
  options?: {
    /** Max age in ms; entries older than this read as null. Omit for no expiry. */
    ttlMs?: number
    /** Shape guard run against the stored value; return false to discard. */
    validate?: (value: unknown) => boolean
  }
): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const envelope = JSON.parse(raw) as Partial<CacheEnvelope<T>>
    if (!envelope || typeof envelope.cachedAt !== "number" || envelope.value === undefined) {
      return null
    }
    if (options?.ttlMs !== undefined && Date.now() - envelope.cachedAt > options.ttlMs) {
      return null
    }
    if (options?.validate && !options.validate(envelope.value)) {
      return null
    }
    return envelope.value
  } catch {
    // Corrupted JSON (half-written by a crashed tab) — treat as no cache.
    return null
  }
}

export function writeJsonCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    const envelope: CacheEnvelope<T> = { cachedAt: Date.now(), value }
    window.localStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    // Quota full / private browsing — silently degrade to "no cache".
  }
}

export function removeCache(key: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing sensible to do; the key either doesn't exist or storage is unavailable.
  }
}
