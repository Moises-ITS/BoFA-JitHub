import { useEffect, useState } from "react"
import { SignIn, useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import "./auth.css"

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useClerkAuth()
  const { signOut } = useClerk()
  const { user, loading, loginCustom } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Which sign-in UI to show is decided by the ROUTE, never by `user.userType`.
  // On this page `user` is null by definition (nobody is signed in yet), so
  // branching on it sent every visitor — students included — to the custom
  // password form, and /api/auth/login-custom only accepts guests/professors.
  // startsWith, not endsWith: Clerk owns sub-paths under /login/student
  // (…/factor-one, …/sso-callback) and must keep rendering on all of them.
  const isStudent = pathname.startsWith("/login/student")
  const isProfessor = pathname.startsWith("/login/professor")
  const role = isProfessor ? "professor" : "guest"
  const roleName = isProfessor ? "Professor" : "Guest"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (user && (user.userType === "guest" || user.userType === "professor")) {
      navigate("/home", { replace: true })
      return
    }

    if (!isLoaded || loading) return

    // Already fully authenticated student → go straight to app
    if (isSignedIn && user) {
      navigate("/home", { replace: true })
      return
    }
  }, [isLoaded, isSignedIn, loading, user, signOut, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setFormLoading(true)
    try {
      await loginCustom(email, password)
      navigate("/home", { replace: true })
    } catch (err: any) {
      setError(err?.message || "Invalid email or password")
    } finally {
      setFormLoading(false)
    }
  }

  // Render Clerk for Student
  if (isStudent) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--clerk">
          <div className="auth-header">
            <span className="auth-eyebrow">NJIT Student OS</span>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">
              Sign in as a student to access the graph network and campus activities.
            </p>
          </div>

          <div className="auth-shell-links">
            <Link to="/">Back to home</Link>
            <Link to="/signup/student">Need an account? Sign up</Link>
          </div>

          <div className="auth-clerk-shell">
            {!isLoaded ? (
              <div className="auth-clerk-placeholder" aria-live="polite">
                <div className="auth-clerk-spinner" />
                <p>Loading sign in...</p>
              </div>
            ) : (
              <SignIn
                routing="path"
                path="/login/student"
                forceRedirectUrl="/home"
                signUpUrl="/signup/student"
                fallbackRedirectUrl="/home"
                appearance={{
                  variables: {
                    colorPrimary: "#D71920",
                    colorBackground: "#111624",
                    colorText: "#F3F6FB",
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render Custom form for Professor and Guest

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-eyebrow">NJIT JitHub</span>
          <h1 className="auth-title">{roleName} Sign In</h1>
          <p className="auth-subtitle">
            Enter your credentials to access your JitHub dashboard.
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="e.g. name@njit.edu"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>

          <button type="submit" className="auth-btn-primary" disabled={formLoading}>
            {formLoading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="auth-shell-links" style={{ marginTop: "24px" }}>
          <Link to="/">Back to home</Link>
          <Link to={`/signup/${role}`}>Create an account</Link>
        </div>
      </div>
    </div>
  )
}
