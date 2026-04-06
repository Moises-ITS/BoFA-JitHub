import { useState, FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import "./auth.css"

const API = import.meta.env.VITE_API_URL ?? ""

type Step = "email" | "code"

export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [step, setStep]         = useState<Step>("email")
  const [email, setEmail]       = useState("")
  const [code, setCode]         = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Request failed"); return }
      setStep("code")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/verify-reset-code`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Invalid code"); return }
      navigate("/reset-password", { state: { resetToken: data.resetToken } })
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">
          {step === "email"
            ? "Enter your NJIT email to receive a reset code."
            : `A 6-digit code was sent to ${email}.`}
        </p>

        <div className="auth-steps">
          {(["email", "code"] as Step[]).map((s, i) => {
            const idx = ["email", "code"].indexOf(step)
            const cls = i < idx ? "done" : i === idx ? "active" : ""
            return (
              <div key={s} className={`auth-step ${cls}`}>
                <div className="auth-step-num">{i < idx ? "✓" : i + 1}</div>
                <div className="auth-step-label">{s === "email" ? "Email" : "Code"}</div>
              </div>
            )
          })}
        </div>

        {error && <div className="auth-error">{error}</div>}

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="yourucid@njit.edu"
              />
            </label>
            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {loading ? "Sending…" : "Send reset code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="auth-form">
            <label>
              6-digit code
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                placeholder="123456"
              />
            </label>
            <div className="auth-nav">
              <button type="button" className="auth-btn-secondary" onClick={() => { setStep("email"); setCode(""); setError("") }}>
                Back
              </button>
              <button type="submit" className="auth-btn-primary" disabled={loading || code.length !== 6}>
                {loading ? "Verifying…" : "Verify code"}
              </button>
            </div>
          </form>
        )}

        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
