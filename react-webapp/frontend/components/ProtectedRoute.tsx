import { Navigate, Outlet } from "react-router-dom"
import { useAuth as useClerkAuth } from "@clerk/clerk-react"
import { useAuth } from "../context/AuthContext"

export default function ProtectedRoute() {
  const { user, loading, needsProfileSetup } = useAuth()
  const { isSignedIn, isLoaded } = useClerkAuth()

  // Wait for both Clerk and our context to finish loading
  if (!isLoaded || loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0f1117",
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: "3px solid #2d2d2d",
          borderTop: "3px solid #C0392B",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Not signed in with Clerk at all → landing page
  if (!isSignedIn) return <Navigate to="/" replace />

  // Clerk session exists but no profile in DB yet → profile setup
  if (needsProfileSetup || !user) return <Navigate to="/setup" replace />

  return <Outlet />
}
