import { useEffect } from "react"
import { SignIn, useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react"
import { useAuth } from "../../context/AuthContext"
import "./auth.css"

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useClerkAuth()
  const { signOut } = useClerk()
  const { user, loading } = useAuth()

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
            Sign in to JitHub and jump back into events, organizations, research,
            and campus opportunities.
          </p>
        </div>

        <div className="auth-clerk-shell">
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
              elements: {
                rootBox: "auth-clerk-shell",
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
