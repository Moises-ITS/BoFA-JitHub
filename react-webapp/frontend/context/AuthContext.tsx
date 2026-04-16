import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react"
import { useAuth as useClerkAuth, useClerk, useUser } from "@clerk/clerk-react"

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

function toNetworkError(err: unknown, fallback: string) {
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return new Error(fallback)
  }
  return err instanceof Error ? err : new Error(fallback)
}

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth()
  const { signOut } = useClerk()
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser()

  const [user,              setUser]      = useState<User | null>(null)
  const [token,             setToken]     = useState<string | null>(null)
  const [loading,           setLoading]   = useState(true)
  const [needsProfileSetup, setNeedsSetup] = useState(false)
  const autoSynced = useRef(false)
  const getSessionToken = useCallback(
    (fresh = false) => getToken(fresh ? { skipCache: true } : undefined),
    [getToken]
  )

  // Resolve Clerk session → our profile (auto-creates on first login, no setup form)
  useEffect(() => {
    if (!isLoaded || !clerkUserLoaded) return
    if (!isSignedIn) {
      setUser(null); setToken(null); setLoading(false); setNeedsSetup(false)
      autoSynced.current = false
      return
    }
    getSessionToken(true).then(async (t) => {
      if (!t) { setLoading(false); return }
      setToken(t)
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        if (res.ok) {
          setUser(await res.json()); setNeedsSetup(false)
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
                setToken(t); setUser(await syncRes.json()); setNeedsSetup(false); return
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
    try {
      const res = await fetch(`${API}/api/auth/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? "Sync failed")
      setToken(t); setUser(result); setNeedsSetup(false)
    } catch (err) {
      throw toNetworkError(err, "Couldn't reach the auth backend on http://localhost:3001.")
    }
  }, [getSessionToken])

  const updateProfile = useCallback(async (data: ProfileUpdate) => {
    const t = await getSessionToken(true)
    if (!t) throw new Error("Not authenticated")
    try {
      const res = await fetch(`${API}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(data),
      })
      const updated = await res.json()
      if (!res.ok) throw new Error(updated.error ?? "Update failed")
      setToken(t)
      setUser(updated)
    } catch (err) {
      throw toNetworkError(err, "Couldn't reach the auth backend on http://localhost:3001.")
    }
  }, [getSessionToken])

  function logout() { setLoading(true); signOut(); setUser(null); setToken(null); setNeedsSetup(false) }
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
