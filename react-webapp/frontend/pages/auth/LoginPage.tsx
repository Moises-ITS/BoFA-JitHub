import { useEffect } from "react"
import { SignIn, useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react"
import { Link } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useClerkAuth()
  const { signOut } = useClerk()
  const { user, loading } = useAuth()

  // If already signed in with Clerk but no DB profile (stale session from a
  // failed setup attempt), sign out so the login form actually shows.
  useEffect(() => {
    if (isLoaded && isSignedIn && !loading && !user) {
      void signOut()
    }
  }, [isLoaded, isSignedIn, loading, signOut, user])

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
