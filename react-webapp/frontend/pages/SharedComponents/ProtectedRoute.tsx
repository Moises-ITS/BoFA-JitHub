import { Navigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { ReactNode } from "react"

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, needsProfileSetup } = useAuth()

  if (loading) return null

  if (needsProfileSetup) return <Navigate to="/setup" replace />

  if (!user) return <Navigate to="/" replace />

  return <>{children}</>
}
