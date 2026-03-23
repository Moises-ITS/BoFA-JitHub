import { SignUp, useAuth as useClerkAuth } from "@clerk/clerk-react"
import { Link } from "react-router-dom"
import "./auth.css"

export default function SignupPage() {
  const { isLoaded } = useClerkAuth()

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--clerk">
        <div className="auth-header">
          <span className="auth-eyebrow">NJIT Student OS</span>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">
            Join JitHub to discover campus events, student organizations,
            career opportunities, and the people around you.
          </p>
        </div>

        <div className="auth-shell-links">
          <Link to="/">Back to home</Link>
          <Link to="/login">Already have an account? Sign in</Link>
        </div>

        <div className="auth-clerk-shell">
          {!isLoaded ? (
            <div className="auth-clerk-placeholder" aria-live="polite">
              <div className="auth-clerk-spinner" />
              <p>Loading sign up...</p>
            </div>
          ) : (
            <SignUp
              routing="path"
              path="/signup"
              forceRedirectUrl="/home"
              signInUrl="/login"
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
