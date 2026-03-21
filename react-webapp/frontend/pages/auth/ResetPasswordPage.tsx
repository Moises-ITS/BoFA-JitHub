import { useState, FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import "./auth.css"

const API = import.meta.env.VITE_API_URL ?? ""

export default function ResetPasswordPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const resetToken: string | undefined = (location.state as { resetToken?: string })?.resetToken

  const [password, setPassword]     = useState("")
  const [confirm, setConfirm]       = useState("")
  const [error, setError]           = useState("")
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(false)

  if (!resetToken) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Link expired</h1>
          <p className="auth-subtitle">Please start the password reset process again.</p>
          <p className="auth-switch"><Link to="/forgot-password">Reset password</Link></p>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    if (password !== confirm) { setError("Passwords do not match"); return }
    if (password.length < 8)  { setError("Password must be at least 8 characters"); return }
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ resetToken, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Reset failed"); return }
      setSuccess(true)
      setTimeout(() => navigate("/login"), 1800)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Set new password</h1>
        <p className="auth-subtitle">Choose a strong password for your account.</p>

        {error   && <div className="auth-error">{error}</div>}
        {success && (
          <div style={{ color: "#22c55e", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Password updated! Redirecting to sign in…
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                minLength={8}
                placeholder="At least 8 characters"
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Repeat password"
              />
            </label>
            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Update password"}
            </button>
          </form>
        )}

        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
