import { Navigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

export default function EdenPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading EDEN…</div>
  }
  if (!user?.is_eboard) {
    return <Navigate to="/home" replace />
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07090f",
        color: "#d9e1ec",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        display: "grid",
        gridTemplateRows: "40px 28px 1fr 22px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "#0a0e17",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#f7b955", fontWeight: 700, letterSpacing: "0.12em" }}>EDEN</span>
          <span style={{ color: "#4a5568", fontSize: 11 }}>Event Data Engagement Network</span>
        </div>
        <div style={{ color: "#4a5568", fontSize: 11 }}>
          Club: <span style={{ color: "#4ec9e0" }}>#{user.eboard_club_id ?? "—"}</span>
        </div>
      </header>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 18,
          fontSize: 11,
          color: "#4a5568",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "#0a0e17",
        }}
      >
        {["F1 Overview", "F2 Forecast", "F3 Event", "F4 Compare", "F5 What-if", "F6 Graph", "F7 Audience"].map(t => (
          <span key={t} style={{ opacity: 0.5 }}>{t}</span>
        ))}
      </nav>

      <main
        style={{
          padding: 24,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            padding: 16,
            background: "rgba(10, 14, 23, 0.6)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 12, color: "#f7b955", letterSpacing: "0.1em" }}>
            STATUS
          </h3>
          <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: "#d9e1ec" }}>
            Phase 1 is live: attendance capture. Every past event in your club now shows
            a headcount form on its detail view. Enter numbers as events happen and the
            forecast engine will have data to train on.
          </p>
        </section>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            padding: 16,
            background: "rgba(10, 14, 23, 0.6)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 12, color: "#4ec9e0", letterSpacing: "0.1em" }}>
            NEXT
          </h3>
          <ul style={{ marginTop: 12, fontSize: 13, lineHeight: 1.8, color: "#d9e1ec", paddingLeft: 16 }}>
            <li>Overview tab with turnout %, trend, anomaly monitor</li>
            <li>Monte Carlo forecast for upcoming events</li>
            <li>Audience breakdown by major / interest</li>
            <li>What-if simulator (food, day-of-week, category)</li>
          </ul>
        </section>

        <section
          style={{
            gridColumn: "span 2",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            padding: 16,
            background: "rgba(10, 14, 23, 0.6)",
            color: "#4a5568",
            fontSize: 12,
          }}
        >
          Attendance entry &rarr; <span style={{ color: "#66d19e" }}>open an event on /events and scroll down</span>
        </section>
      </main>

      <footer
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          fontSize: 10,
          color: "#4a5568",
          background: "#0a0e17",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        EDEN // e-board only // data in → forecasts next
      </footer>
    </div>
  )
}
