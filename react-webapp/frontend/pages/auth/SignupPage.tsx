import { SignUp } from "@clerk/clerk-react"
import "./auth.css"

export default function SignupPage() {
  return (
    <div className="auth-page">
      <div className="auth-card auth-card--clerk">
        <div className="auth-header">
          <span className="auth-eyebrow">NJIT Student OS</span>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">
            Join JitHub to discover campus events, student organizations, research,
            career opportunities, and the people around you.
          </p>
        </div>

        <div className="auth-clerk-shell">
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
