import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--bg-canvas)",
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: "3px solid var(--border-default)",
          borderTop: "3px solid var(--brand-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
