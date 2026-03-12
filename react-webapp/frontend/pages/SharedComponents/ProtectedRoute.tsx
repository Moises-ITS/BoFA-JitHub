import { Navigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { ReactNode } from "react"

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null  // or a spinner

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
