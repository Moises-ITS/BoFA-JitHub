import { useEffect, useState } from "react"
import { SignUp, useAuth as useClerkAuth } from "@clerk/clerk-react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import "./auth.css"

export default function SignupPage() {
  const { isLoaded } = useClerkAuth()
  const { user, signupCustom } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // startsWith, not endsWith: Clerk's <SignUp routing="path"> owns sub-paths
  // under /signup/student (…/verify-email-address, …/continue). With endsWith,
  // the moment Clerk advanced to email verification this flipped to false and
  // swapped the Clerk component out for the guest form mid-signup.
  const isStudent = pathname.startsWith("/signup/student")
  const isProfessor = pathname.startsWith("/signup/professor")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [department, setDepartment] = useState("")
  const [interest, setInterest] = useState("")

  const [error, setError] = useState("")
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (user && (user.userType === "guest" || user.userType === "professor")) {
      navigate("/home", { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setFormLoading(true)
    try {
      const payload: any = {
        name,
        email,
        password,
        userType: isProfessor ? "professor" : "guest",
      }
      if (isProfessor) {
        payload.department = department
        payload.interest = interest
      }
      await signupCustom(payload)
      navigate("/home", { replace: true })
    } catch (err: any) {
      setError(err?.message || "Registration failed")
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
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">
              Join JitHub as a student to discover campus events, student organizations, and career opportunities.
            </p>
          </div>

          <div className="auth-shell-links">
            <Link to="/">Back to home</Link>
            <Link to="/login/student">Already have an account? Sign in</Link>
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
                path="/signup/student"
                forceRedirectUrl="/home"
                signInUrl="/login/student"
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

  const roleName = isProfessor ? "Professor" : "Guest"
  const loginLink = isProfessor ? "/login/professor" : "/login/guest"

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-eyebrow">NJIT JitHub</span>
          <h1 className="auth-title">Create {roleName} Account</h1>
          <p className="auth-subtitle">
            Enter your details to create a basic JitHub account.
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Full Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. John Doe"
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
              placeholder="Min 8 characters"
            />
          </label>

          {isProfessor && (
            <>
              <label>
                Department
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  placeholder="e.g. Computer Science"
                />
              </label>
              <label>
                Primary Academic Interest
                <input
                  type="text"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  required
                  placeholder="e.g. Artificial Intelligence"
                />
              </label>
            </>
          )}

          <button type="submit" className="auth-btn-primary" disabled={formLoading}>
            {formLoading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-shell-links" style={{ marginTop: "24px" }}>
          <Link to="/">Back to home</Link>
          <Link to={loginLink}>Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  )
}
