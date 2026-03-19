import { useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "motion/react"
import { useAuth } from "../../context/AuthContext"

const pills = ["Graph Networking", "Opportunity Discovery", "Campus Connect"]

export default function LandingPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      navigate("/home", { replace: true })
    }
  }, [user, loading, navigate])

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f1117",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Radial glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(192,57,43,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ textAlign: "center", position: "relative", zIndex: 1, padding: "0 24px" }}>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 32 }}
        >
          <div style={{
            display: "inline-flex",
            width: 72,
            height: 72,
            borderRadius: 20,
            background: "linear-gradient(135deg, #C0392B, #E67E22)",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 40px rgba(192,57,43,0.4)",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 22 }}>JH</span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4rem)",
            fontWeight: 700,
            marginBottom: 16,
            background: "linear-gradient(135deg, #ffffff 40%, #9CA3AF)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1.1,
          }}
        >
          JitHub
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          style={{
            fontSize: "1.25rem",
            color: "#9CA3AF",
            marginBottom: 40,
          }}
        >
          Your NJIT network, visualized.
        </motion.p>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 10,
            marginBottom: 48,
          }}
        >
          {pills.map((pill) => (
            <span
              key={pill}
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#9CA3AF",
                fontSize: "0.85rem",
              }}
            >
              {pill}
            </span>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}
        >
          <Link
            to="/login"
            style={{
              padding: "12px 32px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #C0392B, #E74C3C)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(192,57,43,0.35)",
              transition: "opacity 0.2s",
            }}
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            style={{
              padding: "12px 32px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
              textDecoration: "none",
              transition: "background 0.2s",
            }}
          >
            Create Account
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
