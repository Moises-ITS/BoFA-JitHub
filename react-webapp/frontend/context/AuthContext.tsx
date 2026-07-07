/**
 * AuthContext — bridges Clerk's session/identity layer to our own Postgres-backed
 * student profile ("User" below is OUR row, not Clerk's user object).
 *
 * Why we need a bridge at all: Clerk tells us WHO is signed in (email, Clerk user id,
 * session token) but knows nothing about NJIT-specific profile data (major, GPA, clubs,
 * etc.). On first sign-in we auto-provision a matching row in our `users` table
 * ("sync"), then every page reads/writes profile data through OUR backend, authenticated
 * with a short-lived Clerk session token attached as a Bearer header.
 *
 * Scale note: this runs in every signed-in tab for the whole student body (~2000+
 * users). Two things that matter most at that scale are (1) not hammering Clerk's
 * token endpoint more than necessary, and (2) not leaving dangling network requests
 * that resolve out of order and clobber fresher state — both are called out inline
 * below where they're handled.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { useAuth as useClerkAuth, useClerk, useUser } from "@clerk/clerk-react"

/** Backend origin. Falls back to the local dev server when the env var isn't injected (e.g. running `vite` without a .env). */
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5175"

/** localStorage key for the "last known profile" cache — see readCachedUser() for why this exists. */
const USER_CACHE_KEY = "jithub.cached-user"

/**
 * Clerk session tokens are short-lived (default ~60s). We proactively fetch a fresh
 * one slightly before that so an in-flight API call never gets caught holding an
 * expired token. This is a *background* refresh — it does not gate the UI.
 */
const TOKEN_REFRESH_INTERVAL_MS = 50_000

/** Network calls to our backend give up after this long rather than hanging a spinner forever (flaky campus wifi, cold-started backend, etc.). */
const REQUEST_TIMEOUT_MS = 10_000

/** Our profile row, as returned by GET /api/auth/me (see backend formatUser()). */
export interface User {
  id: string
  name: string
  email: string
  major: string
  gpa: number | null
  graduationYear: number
  bio: string | null
  clubs: string[]
  companies: string[]
  interests: string[]
  linkedinUrl: string | null
  skills: string[]
  looking_for: string[]
  year: string | null
  is_eboard?: boolean
  eboard_club_id?: number | null
}

/** Payload for PUT /api/auth/profile — an existing user editing their own profile. graduationYear is required here (see backend route). */
export interface ProfileUpdate {
  gpa: number | null
  major: string
  graduationYear: number
  bio: string
  clubs: string[]
  companies: string[]
  interests: string[]
  linkedinUrl?: string | null
  skills: string[]
  looking_for: string[]
  year: string | null
}

/**
 * Legacy shape kept for compatibility with existing callers/tests. Clerk owns
 * sign-up now, so `password` is unused by this context (see signup() stub below)
 * but the field stays so nothing importing this type breaks.
 */
export interface SignupData {
  name: string
  email: string
  password: string
  major: string
  gpa: number | null
  graduationYear: number
  bio: string
  clubs: string[]
  companies: string[]
  interests: string[]
  linkedinUrl?: string | null
  skills: string[]
  looking_for: string[]
  year: string | null
}

/**
 * Payload for POST /api/auth/sync — provisions or re-links a profile row for a
 * Clerk-authenticated user. graduationYear is `number | null` because a brand-new
 * student (auto-synced right after their first sign-in, before they've filled out
 * anything) genuinely has no graduation year yet; the backend's toNullableInt()
 * accepts null here, unlike the stricter PUT /api/auth/profile route.
 */
export interface SyncData {
  email: string
  name: string
  major: string
  gpa: number | null
  graduationYear: number | null
  bio: string
  clubs: string[]
  companies: string[]
  interests: string[]
  linkedinUrl?: string | null
}

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  needsProfileSetup: boolean
  authError: boolean
  retryAuth: () => void
  login: (email: string, password: string) => Promise<void>
  signup: (data: SignupData) => Promise<void>
  logout: () => void
  updateProfile: (data: ProfileUpdate) => Promise<void>
  syncProfile: (data: SyncData) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Shape returned by our error responses, e.g. `{ error: "..." }` or `{ error: "...", code: "PROFILE_REQUIRED" }`. */
interface ApiErrorBody {
  error?: string
  code?: string
}

/**
 * Reads the last-known profile out of localStorage so returning students see their
 * own name/avatar instantly instead of a blank loading screen while we re-validate
 * the session with the backend. This is a cache for perceived performance only —
 * it is never trusted as an auth decision (the real session check always runs
 * afterward in the effect below).
 *
 * Design note re: shared lab computers — we deliberately never cache the Clerk
 * session token here, only the (non-secret) profile fields already visible in the
 * UI. Worst case a stale name flashes for a moment before the real fetch resolves
 * or the cache is rejected below.
 */
function readCachedUser(): User | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isPlausibleUser(parsed) ? parsed : null
  } catch {
    // Corrupted JSON (e.g. a half-written value from a crashed tab) — treat as no cache.
    return null
  }
}

/**
 * Minimal shape guard for cached data. This intentionally does NOT do full schema
 * validation (e.g. via zod) — it only protects against the cache being garbage left
 * over from a previous app version whose User shape has since changed, which would
 * otherwise render as `undefined.toUpperCase()`-style crashes deep in a page.
 */
function isPlausibleUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<User>).id === "string" &&
    typeof (value as Partial<User>).email === "string"
  )
}

/**
 * Thin fetch wrapper shared by every authenticated call to our backend. Centralizes
 * the four things every call site needs and previously duplicated by hand:
 *  1. Prefixing the backend origin
 *  2. Attaching the Bearer token + JSON content-type header
 *  3. Aborting the request after REQUEST_TIMEOUT_MS instead of hanging indefinitely
 *  4. Parsing the JSON body defensively (some error responses may have no body)
 *
 * Returns the raw ok/status/data trio rather than throwing on non-2xx — callers
 * decide what a given status code means (e.g. 403 PROFILE_REQUIRED is an expected,
 * handled case, not an exception).
 */
async function apiFetch<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
      signal: controller.signal,
    })
    // .catch(() => ({})) guards against empty/non-JSON bodies (e.g. a 204 or a proxy error page).
    const data = (await res.json().catch(() => ({}))) as T
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timeoutId)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth()
  const { signOut } = useClerk()
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser()

  // Seeded once from localStorage on mount so the first render already has
  // something to show. Never re-read after mount; the effect below is the single
  // source of truth going forward.
  const cachedUserRef = useRef<User | null>(readCachedUser())

  const [user, setUser] = useState<User | null>(cachedUserRef.current)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsProfileSetup, setNeedsSetup] = useState(false)
  const [authError, setAuthError] = useState(false)

  // Plain state (not a ref) so bumping it is guaranteed to re-trigger the
  // session-resolution effect below via its dependency array. A ref's `.current`
  // mutation alone doesn't reliably signal "please rerun this effect" — using
  // state here is the idiomatic, unambiguous way to expose a manual "retry" trigger.
  const [retryNonce, setRetryNonce] = useState(0)

  // Guards against auto-syncing more than once per mount even if the effect below
  // re-runs (e.g. due to a retry) before the first sync attempt has resolved.
  const autoSyncAttempted = useRef(false)

  /**
   * Wrapper around Clerk's getToken(). `forceRefresh: true` bypasses Clerk's own
   * short-lived token cache and is reserved for the two places that actually need
   * a guaranteed-fresh token: the initial session check and the periodic
   * background refresh. Everyday calls (profile edits, etc.) use the cheap path
   * and let Clerk decide whether its cached token is still valid — with ~2000
   * concurrent students, defaulting every call to force-refresh would multiply
   * load on Clerk's token endpoint for no real benefit.
   */
  const getSessionToken = useCallback(
    (forceRefresh = false) => getToken(forceRefresh ? { skipCache: true } : undefined),
    [getToken]
  )

  // Mirror the resolved profile into localStorage so the next page load (or tab)
  // can paint instantly from cache. Clearing it on logout/sign-out prevents a
  // signed-out user's last-known profile from lingering in devtools-visible
  // storage on a shared machine.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (user) {
        window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
      } else {
        window.localStorage.removeItem(USER_CACHE_KEY)
      }
    } catch {
      // Storage can throw in private-browsing modes or when the quota is full;
      // the cache is a pure UX nicety, so we silently degrade to "no cache".
    }
  }, [user])

  /** Exposed to the UI so an "Auth failed — retry" button can re-run session resolution without a full page reload. */
  const retryAuth = useCallback(() => {
    setRetryNonce((n) => n + 1)
    setAuthError(false)
    setLoading(true)
    autoSyncAttempted.current = false
  }, [])

  /**
   * POST /api/auth/sync — provisions (or re-links) the caller's profile row.
   * Exposed to the UI for the manual profile-setup form, and reused internally
   * below for the automatic first-login sync, so the request/error-handling logic
   * only lives in one place.
   */
  const syncProfile = useCallback(
    async (data: SyncData) => {
      const t = await getSessionToken(true)
      if (!t) throw new Error("Not authenticated")
      const { ok, data: result } = await apiFetch<User & ApiErrorBody>(
        "/api/auth/sync",
        t,
        { method: "POST", body: JSON.stringify(data) }
      )
      if (!ok) throw new Error(result.error ?? "Sync failed")
      cachedUserRef.current = result
      setToken(t)
      setUser(result)
      setNeedsSetup(false)
    },
    [getSessionToken]
  )

  /** PUT /api/auth/profile — an existing user editing their own profile. */
  const updateProfile = useCallback(
    async (data: ProfileUpdate) => {
      const t = await getSessionToken()
      if (!t) throw new Error("Not authenticated")
      const { ok, data: result } = await apiFetch<User & ApiErrorBody>(
        "/api/auth/profile",
        t,
        { method: "PUT", body: JSON.stringify(data) }
      )
      if (!ok) throw new Error(result.error ?? "Update failed")
      cachedUserRef.current = result
      setToken(t)
      setUser(result)
    },
    [getSessionToken]
  )

  /**
   * Core session-resolution effect: whenever Clerk's sign-in state settles, resolve
   * it against OUR backend (GET /api/auth/me), auto-provisioning a profile row via
   * syncProfile() on a brand-new user's first login.
   *
   * Race-condition guard: this effect can re-run before a previous run's fetch has
   * resolved (fast sign-in/sign-out, or a manual retry). Without guarding, an old,
   * slow-to-resolve request could land AFTER a newer one and overwrite fresher
   * state with stale data. `cancelled` is flipped in the cleanup function and
   * checked before every state update that follows an `await`, so a superseded run
   * becomes a no-op instead of corrupting state.
   */
  useEffect(() => {
    let cancelled = false

    async function resolveSession() {
      if (!isLoaded || !clerkUserLoaded) return // Clerk hasn't finished loading yet; wait for the next effect run.

      if (!isSignedIn) {
        setUser(null)
        setToken(null)
        setLoading(false)
        setNeedsSetup(false)
        setAuthError(false)
        autoSyncAttempted.current = false
        cachedUserRef.current = null
        return
      }

      const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? ""
      const cachedUser = cachedUserRef.current

      // If the cache matches the currently-signed-in email, show it immediately
      // and keep validating in the background rather than blanking the UI.
      // A mismatch (different student on a shared machine, or account switch)
      // must NOT show someone else's cached profile, so we fall through to loading.
      if (cachedUser && clerkEmail && cachedUser.email === clerkEmail) {
        setUser(cachedUser)
        setNeedsSetup(false)
        setLoading(false)
      } else {
        setLoading(true)
      }
      setAuthError(false)

      const freshToken = await getSessionToken(true)
      if (cancelled) return
      if (!freshToken) {
        setLoading(false)
        return
      }
      setToken(freshToken)

      try {
        const { ok, status, data } = await apiFetch<User & ApiErrorBody>("/api/auth/me", freshToken)
        if (cancelled) return

        if (ok) {
          cachedUserRef.current = data
          setUser(data)
          setNeedsSetup(false)
        } else if (status === 403 && data.code === "PROFILE_REQUIRED" && !autoSyncAttempted.current) {
          // First-ever sign-in for this student: no profile row yet. Auto-create a
          // minimal one from what Clerk already knows so they land straight in the
          // app instead of a manual "create your account" form; they fill in the
          // rest (major, clubs, etc.) later via the normal profile edit flow.
          autoSyncAttempted.current = true
          const email = clerkUser?.primaryEmailAddress?.emailAddress ?? ""
          const name = clerkUser?.fullName ?? clerkUser?.firstName ?? "NJIT Student"
          if (email) {
            try {
              await syncProfile({
                email,
                name,
                major: "",
                gpa: null,
                graduationYear: null,
                bio: "",
                clubs: [],
                companies: [],
                interests: [],
                linkedinUrl: null,
              })
              if (cancelled) return
            } catch {
              // Sync failed (e.g. transient backend error) — fall back to asking
              // the student to complete setup manually rather than looping forever.
              if (!cancelled) setNeedsSetup(true)
            }
          } else {
            // Clerk didn't give us an email to work with (shouldn't happen for an
            // @njit.edu-restricted app, but fail safe into the manual setup form).
            if (!cancelled) setNeedsSetup(true)
          }
        } else if (!cancelled) {
          setAuthError(true)
        }
      } catch {
        // Network failure, timeout (see apiFetch's AbortController), or unexpected
        // parse error — surface as a retryable auth error rather than crashing.
        if (!cancelled) setAuthError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    resolveSession()
    return () => {
      cancelled = true
    }
    // retryNonce is intentionally in the dependency list purely to force a re-run
    // on manual retry; its value is never read inside the effect.
  }, [isSignedIn, isLoaded, clerkUserLoaded, retryNonce, getSessionToken, syncProfile, clerkUser])

  // Background token refresh. Clerk session tokens expire quickly (~60s default),
  // so we proactively rotate the token we hand to API calls before that happens.
  // Skipped while the tab is hidden — with ~2000 students potentially leaving
  // tabs open in the background, this avoids paying Clerk-token-refresh cost for
  // tabs nobody is looking at.
  useEffect(() => {
    if (!isSignedIn) return
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      try {
        const freshToken = await getSessionToken(true)
        if (freshToken) setToken(freshToken)
      } catch {
        // Best-effort refresh; a single failed tick just leaves the previous
        // token in place until the next interval or the next API call fails.
      }
    }, TOKEN_REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isSignedIn, getSessionToken])

  /** Clears local state immediately for a snappy UI, then tells Clerk to end the session. */
  function logout() {
    setLoading(true)
    setUser(null)
    setToken(null)
    setNeedsSetup(false)
    setAuthError(false)
    void signOut()
  }

  // Clerk's hosted <SignIn>/<SignUp> components own the actual credential flow;
  // these two stay as explicit, loud failures so a future contributor who wires a
  // custom form up to them gets an immediate error instead of a silent no-op.
  async function login(): Promise<void> {
    throw new Error("Use Clerk's <SignIn> component instead of AuthContext.login")
  }
  async function signup(): Promise<void> {
    throw new Error("Use Clerk's <SignUp> component instead of AuthContext.signup")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        needsProfileSetup,
        authError,
        retryAuth,
        login,
        signup,
        logout,
        updateProfile,
        syncProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
