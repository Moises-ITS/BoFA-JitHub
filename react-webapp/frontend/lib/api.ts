/**
 * lib/api.ts — the single source of truth for backend origins and the shared
 * authenticated-fetch helper.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Before this module, `const API = import.meta.env.VITE_API_URL ?? "<port>"` was
 * copy-pasted into 20+ files — and the hardcoded fallbacks DISAGREED with each
 * other (5175, 3001, and "" for the very same backend; 5175 was the frontend's
 * own Vite dev port at the time, so that fallback pointed API calls back at the
 * frontend). One typo'd port meant one silently broken page, discoverable only
 * by clicking through the app. Centralizing the origin means there is exactly
 * one place to be right.
 *
 * WHAT TALKS TO WHAT
 * ------------------
 * - API_BASE_URL        → the Express backend (auth, profiles, graph, opportunities).
 *                         Dev default: http://localhost:3001 (see backend src/index.ts).
 * - EVENTS_API_BASE_URL → club events, RSVPs, heatmap data. Now the SAME Express
 *                         backend, under its /api prefix.
 * In production API_BASE_URL is injected at build time via the Vercel env var
 * VITE_API_URL; the localhost fallback only ever applies on a developer machine
 * running `vite` without a .env.local.
 */

/** Express backend origin (auth, profiles, graph, opportunities). */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001"

/**
 * Base for the events/RSVP/clubs endpoints.
 *
 * These used to live in a separate FastAPI service ("EDEN") on port 8000, read
 * from VITE_EVENTS_API_URL. That service talked to the same Postgres this
 * backend already uses, was never deployed, and — because VITE_EVENTS_API_URL
 * was set in no environment — every build silently pointed the Events page at
 * http://localhost:8000. Deriving the base from API_BASE_URL means there is now
 * exactly ONE origin to configure, and no way for the events half of the app to
 * be pointed somewhere the rest of it isn't.
 */
export const EVENTS_API_BASE_URL: string = `${API_BASE_URL}/api`

/**
 * Every request gives up after this long instead of hanging a spinner forever.
 * 10s is deliberately generous: it tolerates a cold-started backend (Railway
 * spins down idle instances) while still failing fast enough that a student on
 * flaky campus wifi sees a retry UI instead of an eternally-loading page.
 */
export const REQUEST_TIMEOUT_MS = 10_000

/** Shape of our backend's error responses: `{ error: "..." }`, optionally with a machine-readable `code`. */
export interface ApiErrorBody {
  error?: string
  code?: string
}

/**
 * Thin fetch wrapper for authenticated calls to OUR backend. Centralizes the
 * four things every call site needs and used to duplicate by hand:
 *  1. Prefixing the backend origin
 *  2. Attaching the Bearer token + JSON content-type headers
 *  3. Aborting after REQUEST_TIMEOUT_MS instead of hanging indefinitely
 *  4. Parsing the JSON body defensively (error responses may have no body)
 *
 * DESIGN CHOICE: returns the raw { ok, status, data } trio rather than throwing
 * on non-2xx. Callers decide what a status means — e.g. AuthContext treats a
 * 403 PROFILE_REQUIRED as an expected, handled branch (first-login
 * provisioning), not an exception. A throwing wrapper would force every caller
 * into try/catch for flows that aren't errors at all.
 */
export async function apiFetch<T>(
  path: string,
  token?: string | null,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = {}
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return jsonFetch<T>(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  })
}

/**
 * Same envelope as apiFetch, but for the events/RSVP/clubs endpoints.
 *
 * The token is optional because the feed is public: browsing events, clubs, and
 * attendee counts needs no session. Writes (submitting an event, RSVPing) DO —
 * pass the token for those and the server attributes the write to that student.
 */
export async function eventsFetch<T>(
  path: string,
  token?: string | null,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  return jsonFetch<T>(`${EVENTS_API_BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  })
}

/** Bearer header object for the rare call that can't use apiFetch (e.g. SSE streams that need the raw Response). */
export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

/** Shared engine behind apiFetch/edenFetch — one timeout policy, one JSON-parsing policy. */
async function jsonFetch<T>(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: controller.signal,
    })
    // .catch(() => ({})) guards against empty/non-JSON bodies (e.g. a 204, or a
    // proxy error page) so callers never have to defend against a parse throw.
    const data = (await res.json().catch(() => ({}))) as T
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Thrown by `withTimeout` when the wrapped promise outlives its deadline. */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not settle within ${ms}ms`)
    this.name = "TimeoutError"
  }
}

/**
 * Deadline for promises whose transport we DON'T own — clerk-js, mainly.
 *
 * jsonFetch above enforces REQUEST_TIMEOUT_MS with an AbortController, which
 * only works because it owns the fetch. An SDK call hands us a bare promise, so
 * the best we can do is race it. The distinction matters: this does NOT cancel
 * the underlying request, it only guarantees the CALLER settles — which is the
 * whole point. A hung SDK call previously surfaced as a button spinning forever
 * with no error and nothing logged (the production change-password bug); now it
 * surfaces as a TimeoutError the UI can render.
 *
 * Callers pass their own `ms` when the operation can legitimately outlive a
 * network round trip (e.g. a flow that parks on a Clerk-owned modal waiting for
 * the user to type). Default is the same 10s the rest of the app uses.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = REQUEST_TIMEOUT_MS,
  label = "request"
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}
