import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { useAuth as useClerkAuth, useClerk, useUser } from "@clerk/clerk-react"

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001"
const USER_CACHE_KEY = "jithub.cached-user"

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

export interface SyncData {
  email: string
  name: string
  major: string
  gpa: number | null
  graduationYear: number
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

function readCachedUser(): User | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY)
    return raw ? JSON.parse(raw) as User : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth()
  const { signOut } = useClerk()
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser()
  const cachedUserRef = useRef<User | null>(readCachedUser())

  const [user,              setUser]      = useState<User | null>(cachedUserRef.current)
  const [token,             setToken]     = useState<string | null>(null)
  const [loading,           setLoading]   = useState(true)
  const [needsProfileSetup, setNeedsSetup] = useState(false)
  const [authError,         setAuthError] = useState(false)
  const autoSynced = useRef(false)
  const retryCount = useRef(0)
  const getSessionToken = useCallback(
    (fresh = false) => getToken(fresh ? { skipCache: true } : undefined),
    [getToken]
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (user) {
        window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
      } else {
        window.localStorage.removeItem(USER_CACHE_KEY)
      }
    } catch {
      /* ignore storage issues */
    }
  }, [user])
  const retryAuth = useCallback(() => {
    retryCount.current += 1
    setAuthError(false)
    setLoading(true)
    autoSynced.current = false
  }, [])

  // Resolve Clerk session → our profile (auto-creates on first login, no setup form)
  useEffect(() => {
    console.log("[AUTH] effect triggered — isLoaded:", isLoaded, "clerkUserLoaded:", clerkUserLoaded, "isSignedIn:", isSignedIn)
    if (!isLoaded || !clerkUserLoaded) {
      console.log("[AUTH] waiting for Clerk to load, returning early")
      return
    }
    if (!isSignedIn) {
      console.log("[AUTH] not signed in, clearing state")
      setUser(null); setToken(null); setLoading(false); setNeedsSetup(false); setAuthError(false)
      autoSynced.current = false
      cachedUserRef.current = null
      return
    }
    const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? ""
    const cachedUser = cachedUserRef.current
    if (cachedUser && clerkEmail && cachedUser.email === clerkEmail) {
      setUser(cachedUser)
      setNeedsSetup(false)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setAuthError(false)
    console.log("[AUTH] signed in, fetching session token...")
    getSessionToken(true).then(async (t) => {
      console.log("[AUTH] getToken result:", t ? `token (${t.length} chars, starts: ${t.slice(0,20)}...)` : "NULL")
      if (!t) { console.log("[AUTH] no token — stopping"); setLoading(false); return }
      setToken(t)
      try {
        console.log("[AUTH] calling GET", `${API}/api/auth/me`)
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        console.log("[AUTH] /me response status:", res.status)
        if (res.ok) {
          const data = await res.json()
          console.log("[AUTH] /me OK — user:", data?.name, data?.email)
          setUser(data); setNeedsSetup(false)
        } else if (res.status === 403) {
          const body = await res.json()
          console.log("[AUTH] /me 403 body:", body)
          if (body.code === "PROFILE_REQUIRED" && !autoSynced.current) {
            autoSynced.current = true
            const email = clerkUser?.primaryEmailAddress?.emailAddress ?? ""
            const name  = clerkUser?.fullName ?? clerkUser?.firstName ?? "NJIT Student"
            console.log("[AUTH] auto-syncing new user — email:", email, "name:", name)
            if (email) {
              const syncRes = await fetch(`${API}/api/auth/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
                body: JSON.stringify({
                  email, name,
                  major: "", gpa: null, graduationYear: null,
                  bio: "", clubs: [], companies: [], interests: [], linkedinUrl: null,
                }),
              })
              console.log("[AUTH] /sync response status:", syncRes.status)
              if (syncRes.ok) {
                const syncedUser = await syncRes.json()
                cachedUserRef.current = syncedUser
                setToken(t); setUser(syncedUser); setNeedsSetup(false); return
                const syncData = await syncRes.json()
                console.log("[AUTH] /sync OK — user:", syncData?.name)
                setToken(t); setUser(syncData); setNeedsSetup(false); return
              } else {
                const syncErr = await syncRes.json().catch(() => ({}))
                console.error("[AUTH] /sync failed:", syncRes.status, syncErr)
              }
            } else {
              console.warn("[AUTH] no email available from Clerk user object")
            }
            setNeedsSetup(true)
          }
        } else {
          const errBody = await res.json().catch(() => ({}))
          console.error("[AUTH] /me unexpected status:", res.status, errBody)
          setAuthError(true)
        }
      } catch (err) {
        console.error("[AUTH] network error hitting backend:", err)
        setAuthError(true)
      }
      finally { setLoading(false) }
    })
  }, [isSignedIn, isLoaded, clerkUserLoaded, retryCount.current]) // eslint-disable-line

  // Keep token fresh (Clerk default expiry = 60s)
  useEffect(() => {
    if (!isSignedIn) return
    const id = setInterval(async () => {
      const t = await getSessionToken(true)
      if (t) setToken(t)
    }, 50_000)
    return () => clearInterval(id)
  }, [isSignedIn]) // eslint-disable-line

  const syncProfile = useCallback(async (data: SyncData) => {
    const t = await getSessionToken(true)
    if (!t) throw new Error("Not authenticated")
    const res = await fetch(`${API}/api/auth/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error ?? "Sync failed")
    cachedUserRef.current = result
    setToken(t); setUser(result); setNeedsSetup(false)
  }, [getSessionToken])

  const updateProfile = useCallback(async (data: ProfileUpdate) => {
    const t = await getSessionToken(true)
    if (!t) throw new Error("Not authenticated")
    const res = await fetch(`${API}/api/auth/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(data),
    })
    const updated = await res.json()
    if (!res.ok) throw new Error(updated.error ?? "Update failed")
    cachedUserRef.current = updated
    setToken(t)
    setUser(updated)
  }, [getSessionToken])

  function logout() { setLoading(true); signOut(); setUser(null); setToken(null); setNeedsSetup(false); setAuthError(false) }
  async function login() { throw new Error("Use Clerk SignIn component") }
  async function signup() { throw new Error("Use Clerk SignUp component") }

  return (
    <AuthContext.Provider value={{
      user, token, loading, needsProfileSetup, authError, retryAuth,
      login, signup, logout, updateProfile, syncProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
