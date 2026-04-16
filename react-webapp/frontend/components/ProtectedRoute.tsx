import { Navigate, Outlet } from "react-router-dom"
import { useAuth as useClerkAuth } from "@clerk/clerk-react"
import { useAuth } from "../context/AuthContext"

const spinnerStyle: React.CSSProperties = {
  width: 32, height: 32,
  border: "3px solid var(--border-default)",
  borderTop: "3px solid var(--brand-primary)",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
}

const centerStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  gap: 16, height: "100vh",
  background: "var(--bg-canvas)",
  color: "var(--text-muted)",
  fontFamily: "Inter, system-ui, sans-serif",
}

export default function ProtectedRoute() {
  const { user, loading, needsProfileSetup, authError, retryAuth } = useAuth()
  const { isSignedIn, isLoaded } = useClerkAuth()

  // Wait for both Clerk and our context to finish loading
  if (!isLoaded || loading) {
    return (
      <div style={centerStyle}>
        <div style={spinnerStyle} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Not signed in with Clerk at all → landing page
  if (!isSignedIn) return <Navigate to="/" replace />

  // Clerk session exists but backend explicitly said no profile → profile setup
  if (needsProfileSetup) return <Navigate to="/setup" replace />

  // Signed in with Clerk but backend unreachable / returned error → show retry
  if (!user) {
    if (authError) {
      return (
        <div style={centerStyle}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 15, margin: 0 }}>Unable to reach the server.</p>
          <button
            onClick={retryAuth}
            style={{
              padding: "10px 24px", borderRadius: 8, cursor: "pointer",
              background: "var(--brand-primary, #D71920)", color: "#fff",
              border: "none", fontSize: 14, fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    // Still waiting (authError not set yet, just null user) — keep spinner
    return (
      <div style={centerStyle}>
        <div style={spinnerStyle} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return <Outlet />
}
