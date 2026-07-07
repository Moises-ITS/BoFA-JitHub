/**
 * lib/api.ts — the single source of truth for backend origins and the shared
 * authenticated-fetch helper.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Before this module, `const API = import.meta.env.VITE_API_URL ?? "<port>"` was
 * copy-pasted into 20+ files — and the hardcoded fallbacks DISAGREED with each
 * other (5175, 3001, and "" for the very same backend; 5175 is actually the
 * frontend's own Vite dev port, so that fallback pointed API calls back at the
 * frontend). One typo'd port meant one silently broken page, discoverable only
 * by clicking through the app. Centralizing the origin means there is exactly
 * one place to be right.
 *
 * WHAT TALKS TO WHAT
 * ------------------
 * - API_BASE_URL       → the Express backend (auth, profiles, graph, opportunities).
 *                        Dev default: http://localhost:3001 (see backend src/index.ts).
 * - EDEN_API_BASE_URL  → the EDEN FastAPI service (club events, RSVP, heatmap data).
 *                        Dev default: http://localhost:8000 (FastAPI's default).
 * In production both are injected at build time via Vercel env vars
 * (VITE_API_URL / VITE_EVENTS_API_URL); the localhost fallbacks only ever apply
 * on a developer machine running `vite` without a .env.local.
 */

/** Express backend origin (auth, profiles, graph, opportunities). */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001"

/** EDEN FastAPI origin (club events, RSVPs, attendance heatmaps). */
export const EDEN_API_BASE_URL: string =
  import.meta.env.VITE_EVENTS_API_URL ?? "http://localhost:8000"

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
  token: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  return jsonFetch<T>(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  })
}

/**
 * Same envelope as apiFetch, but for the EDEN FastAPI service (events, RSVPs,
 * trending clubs). No Bearer header — those endpoints are public today; if
 * EDEN ever grows auth, add it HERE once instead of at every call site.
 */
export async function edenFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  return jsonFetch<T>(`${EDEN_API_BASE_URL}${path}`, init)
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
