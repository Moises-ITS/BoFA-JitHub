import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react"
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
  const autoSynced = useRef(false)
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

  // Resolve Clerk session → our profile (auto-creates on first login, no setup form)
  useEffect(() => {
    if (!isLoaded || !clerkUserLoaded) return
    if (!isSignedIn) {
      setUser(null); setToken(null); setLoading(false); setNeedsSetup(false)
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
    getSessionToken(true).then(async (t) => {
      if (!t) { setLoading(false); return }
      setToken(t)
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        if (res.ok) {
          const fetchedUser = await res.json()
          cachedUserRef.current = fetchedUser
          setUser(fetchedUser); setNeedsSetup(false)
        } else if (res.status === 403) {
          const body = await res.json()
          if (body.code === "PROFILE_REQUIRED" && !autoSynced.current) {
            autoSynced.current = true
            const email = clerkUser?.primaryEmailAddress?.emailAddress ?? ""
            const name  = clerkUser?.fullName ?? clerkUser?.firstName ?? "NJIT Student"
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
              if (syncRes.ok) {
                const syncedUser = await syncRes.json()
                cachedUserRef.current = syncedUser
                setToken(t); setUser(syncedUser); setNeedsSetup(false); return
              }
            }
            setNeedsSetup(true)
          }
        }
      } catch { /* network error — leave user null */ }
      finally { setLoading(false) }
    })
  }, [isSignedIn, isLoaded, clerkUserLoaded]) // eslint-disable-line

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

  function logout() {
    cachedUserRef.current = null
    setLoading(true); signOut(); setUser(null); setToken(null); setNeedsSetup(false)
  }
  async function login() { throw new Error("Use Clerk SignIn component") }
  async function signup() { throw new Error("Use Clerk SignUp component") }

  return (
    <AuthContext.Provider value={{
      user, token, loading, needsProfileSetup,
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
