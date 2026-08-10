import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "motion/react"
import { useAuth } from "@/context/AuthContext"

var pills = ["Graph Networking", "Opportunity Discovery", "Campus Connect"]

export default function LandingPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [showSelectModal, setShowSelectModal] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login")


  useEffect(() => {
    if (!loading && user) {
      navigate("/home", { replace: true })
    }
  }, [user, loading, navigate])

  const handleRoleSelect = (role: "student" | "professor" | "guest") => {
    setShowSelectModal(false)
    if (role === "student") {
      navigate(authMode === "login" ? "/login/student" : "/signup/student")
    } else if (role === "professor") {
      navigate(authMode === "login" ? "/login/professor" : "/signup/professor")
    } else {
      navigate(authMode === "login" ? "/login/guest" : "/signup/guest")
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--hero-gradient)",
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
        background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(215,25,32,0.18) 0%, transparent 70%)",
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
            background: "var(--brand-gradient)",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-brand)",
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
            background: "linear-gradient(135deg, var(--text-primary) 40%, var(--text-muted))",
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
            color: "var(--text-secondary)",
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
                border: "1px solid var(--border-default)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--text-muted)",
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
          <button
            onClick={() => {
              setAuthMode("login")
              setShowSelectModal(true)
            }}
            style={{
              padding: "12px 32px",
              borderRadius: 10,
              background: "var(--brand-gradient)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
              border: "none",
              cursor: "pointer",
              boxShadow: "var(--shadow-brand)",
              transition: "opacity 0.2s",
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setAuthMode("signup")
              setShowSelectModal(true)
            }}
            style={{
              padding: "12px 32px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            Create Account
          </button>
        </motion.div>
      </div>

      {/* Role Selection Modal */}
      <AnimatePresence>
        {showSelectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSelectModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(9, 11, 16, 0.8)",
              backdropFilter: "blur(12px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(540px, 90vw)",
                background: "rgba(17, 22, 36, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 24,
                padding: "32px",
                boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                position: "relative",
                fontFamily: "'Inter', sans-serif",
                color: "#F3F6FB",
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowSelectModal(false)}
                style={{
                  position: "absolute",
                  top: "24px",
                  right: "24px",
                  background: "transparent",
                  border: "none",
                  color: "#8993A5",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                &times;
              </button>

              <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}>
                {authMode === "login" ? "Sign In" : "Create Account"}
              </h2>
              <p style={{ color: "#8993A5", fontSize: "0.9rem", marginBottom: "28px" }}>
                Select your profile role below to proceed.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Student Option */}
                <div
                  onClick={() => handleRoleSelect("student")}
                  className="role-card"
                  style={{
                    padding: "20px",
                    borderRadius: 16,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 6px 0", color: "#F3F6FB" }}>Student</h3>
                  <p style={{ fontSize: "0.85rem", color: "#8993A5", margin: 0, lineHeight: 1.4 }}>
                    Use your NJIT account to sign in. Full access to graph networking, clubs, and events.
                  </p>
                </div>

                {/* Professor Option */}
                <div
                  onClick={() => handleRoleSelect("professor")}
                  className="role-card"
                  style={{
                    padding: "20px",
                    borderRadius: 16,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 6px 0", color: "#F3F6FB" }}>Professor</h3>
                  <p style={{ fontSize: "0.85rem", color: "#8993A5", margin: 0, lineHeight: 1.4 }}>
                    Basic credentials and profile setup. Showcase your department and academic interests.
                  </p>
                </div>

                {/* Guest Option */}
                <div
                  onClick={() => handleRoleSelect("guest")}
                  className="role-card"
                  style={{
                    padding: "20px",
                    borderRadius: 16,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 6px 0", color: "#F3F6FB" }}>Guest</h3>
                  <p style={{ fontSize: "0.85rem", color: "#8993A5", margin: 0, lineHeight: 1.4 }}>
                    Explore the campus network as a guest. Only name, email, and password required.
                  </p>
                </div>
              </div>

              {/* Add styles for hover effects directly in the document */}
              <style>{`
                .role-card:hover {
                  background: rgba(255, 255, 255, 0.07) !important;
                  border-color: rgba(215, 25, 32, 0.4) !important;
                  transform: translateY(-2px);
                }
              `}</style>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

