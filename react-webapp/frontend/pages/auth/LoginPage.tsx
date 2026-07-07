import { useEffect } from "react"
import { SignIn, useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import "./auth.css"

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useClerkAuth()
  const { signOut } = useClerk()
  const { user, loading, needsProfileSetup, authError } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoaded || loading) return

    // Already fully authenticated → go straight to app
    if (isSignedIn && user) {
      navigate("/home", { replace: true })
      return
    }
  }, [isLoaded, isSignedIn, loading, user, signOut])
  return (
    <div className="auth-page">
      <div className="auth-card auth-card--clerk">
        <div className="auth-header">
          <span className="auth-eyebrow">NJIT Student OS</span>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">
            Sign in to JitHub and jump back into events, organizations,
            and campus opportunities.
          </p>
        </div>

        <div className="auth-shell-links">
          <Link to="/">Back to home</Link>
          <Link to="/signup">Need an account? Sign up</Link>
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
              path="/login"
              forceRedirectUrl="/home"
              signUpUrl="/signup"
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
