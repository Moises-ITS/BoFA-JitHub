import { createContext, useContext, useState, useEffect, ReactNode } from "react"

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

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
}

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (data: SignupData) => Promise<void>
  logout: () => void
  updateProfile: (data: ProfileUpdate) => Promise<void>
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<User | null>(null)
  const [token, setToken]   = useState<string | null>(() => localStorage.getItem("token"))
  const [loading, setLoading] = useState(true)

  // On mount, validate the stored token
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((u: User) => setUser(u))
      .catch(() => {
        localStorage.removeItem("token")
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Login failed")
    localStorage.setItem("token", data.token)
    setToken(data.token)
    setUser(data.user)
  }

  async function signup(signupData: SignupData) {
    const res = await fetch(`${API}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Signup failed")
    localStorage.setItem("token", data.token)
    setToken(data.token)
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
  }

  async function updateProfile(data: ProfileUpdate) {
    const res = await fetch(`${API}/api/auth/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    const updated = await res.json()
    if (!res.ok) throw new Error(updated.error ?? "Update failed")
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
