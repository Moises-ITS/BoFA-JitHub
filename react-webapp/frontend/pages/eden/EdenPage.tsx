import { Link, Navigate } from "react-router-dom"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useAuth } from "@/context/AuthContext"
import { ForecastTab, WhatIfTab, AttendanceTab } from "./EdenTabs"

import { API_BASE_URL as API } from "@/lib/api"

// ── Bloomberg-terminal palette ────────────────────────────────────────────
const C = {
  BG: "#07090f",
  BG_ELEV: "#0b1220",
  PANEL: "rgba(14,22,38,0.62)",
  PANEL_2: "rgba(18,28,48,0.78)",
  BORDER: "rgba(185,215,255,0.08)",
  BORDER_2: "rgba(185,215,255,0.14)",
  FG: "#d9e7ff",
  FG_DIM: "rgba(217,231,255,0.72)",
  MUTED: "rgba(185,215,255,0.42)",
  AMBER: "#f7b955",
  AMBER_DIM: "rgba(247,185,85,0.55)",
  CYAN: "#4ec9e0",
  GREEN: "#66d19e",
  RED: "#ff6b6b",
  MONO: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
  SANS: "'Inter', system-ui, sans-serif",
}

const PAGES = [
  { id: "overview", num: "F1", label: "Overview" },
  { id: "forecast", num: "F2", label: "Forecast" },
  { id: "whatif",   num: "F3", label: "What-If" },
  { id: "attendance", num: "F4", label: "Attendance" },
] as const
type PageId = typeof PAGES[number]["id"]

// ── Backend types ─────────────────────────────────────────────────────────
type DashboardResponse = {
  club: { club_id: number; name: string; abbr: string }
  semester: { label: string; week: number; of: number }
  kpis: {
    past_events: number
    upcoming_events: number
    avg_engagement: number
    engagement_mom_pct: number
    upcoming_rsvps: number
    rsvp_delta_7d: number
    avg_attendance: number
    attendance_capture_pct: number
    free_food_lift_pct: number
    anomalies: number
  }
  engagement_90d: Array<{ date: string; value: number }>
  attendance_90d: Array<{ date: string; value: number }>
  anomalies: Array<{
    event_id: number
    event_name: string
    date: string
    type: "SURGE" | "DIP"
    z_sigma: number
    score: number
    mu: number
  }>
  top_past_events: Array<{
    rank: number
    event_id: number
    event_name: string
    category: string | null
    score: number
    date: string
  }>
  heatmap: number[][]
  upcoming_pipeline: Array<{
    event_id: number
    event_name: string
    date: string
    start_time: string | null
    category: string | null
    predicted: number | null
    rsvps: number
  }>
}

// ── Hooks ─────────────────────────────────────────────────────────────────
function useProtectedJson<T>(url: string | null, token: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!url || !token) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true); setErr(null)
    fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
        return r.json() as Promise<T>
      })
      .then(setData)
      .catch(e => { if (e.name !== "AbortError") setErr(String(e.message ?? e)) })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [url, token])

  return { data, err, loading }
}

// ── Topbar ────────────────────────────────────────────────────────────────
function Topbar({ clubAbbr, handle, initials }: { clubAbbr: string; handle: string; initials: string }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const ts = time.toISOString().replace("T", " ").slice(0, 19) + " UTC"
  return (
    <div className="eden-topbar">
      <Link to="/home" className="eden-tb-home" title="Return to home">◂ HOME</Link>
      <div className="eden-tb-div" />
      <div className="eden-tb-logo"><span className="eden-sq" /> EDEN <span className="eden-tb-ver">v0.8.2 · α</span></div>
      <div className="eden-tb-div" />
      <div className="eden-tb-status"><span className="eden-led" /> FASTAPI · 200 OK</div>
      <div className="eden-tb-div" />
      <div className="eden-tb-status"><span className="eden-led" style={{ background: C.CYAN, boxShadow: `0 0 6px ${C.CYAN}` }} /> SIMULATOR · 2k trials</div>
      <div style={{ flex: 1 }} />
      <div className="eden-tb-right">
        <span className="eden-tb-org-badge">E-BOARD · {clubAbbr}</span>
        <span className="eden-tb-clock">{ts}</span>
        <div className="eden-tb-user"><span className="eden-av">{initials}</span> {handle}</div>
      </div>
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────
function Nav({ page, setPage, semester }: { page: PageId; setPage: (p: PageId) => void; semester?: { label: string; week: number; of: number } }) {
  return (
    <div className="eden-nav">
      {PAGES.map(p => (
        <div key={p.id} className={"eden-nav-item" + (page === p.id ? " active" : "")} onClick={() => setPage(p.id)}>
          <span className="eden-num">{p.num}</span> {p.label}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div className="eden-nav-meta">
        SEM · {semester?.label ?? "SPR 2026"} · WK {semester?.week ?? "-"}/{semester?.of ?? "-"}
      </div>
    </div>
  )
}

// ── KPI ───────────────────────────────────────────────────────────────────
function Kpi({ label, value, delta, deltaDir, spark }: {
  label: string; value: string; delta?: string; deltaDir?: "up" | "down" | "flat"; spark?: number[]
}) {
  return (
    <div className="eden-kpi">
      <div className="eden-kpi-label">{label}</div>
      <div className="eden-kpi-value">{value}</div>
      {delta && <div className={`eden-kpi-delta eden-${deltaDir ?? "flat"}`}>{delta}</div>}
      {spark && spark.length > 1 && <Spark series={spark} />}
    </div>
  )
}

// ── Charts (inline SVG) ───────────────────────────────────────────────────
function Spark({ series }: { series: number[] }) {
  const w = 60, h = 22
  const min = Math.min(...series), max = Math.max(...series)
  const span = max - min || 1
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - ((v - min) / span) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  return (
    <svg className="eden-kpi-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={C.AMBER} strokeWidth={1} />
    </svg>
  )
}

function LineChart({ series }: { series: Array<{ date: string; value: number }> }) {
  const W = 600, H = 220
  const pad = { l: 36, r: 12, t: 12, b: 22 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  if (series.length === 0) return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} />

  const min = Math.min(...series.map(p => p.value), 0)
  const max = Math.max(...series.map(p => p.value), 1)
  const span = max - min || 1

  const x = (i: number) => pad.l + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw)
  const y = (v: number) => pad.t + ih - ((v - min) / span) * ih

  const linePts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")
  const area = `${pad.l},${pad.t + ih} ${linePts} ${(pad.l + iw).toFixed(1)},${pad.t + ih}`

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => min + t * span)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="eden-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.AMBER} stopOpacity={0.32} />
          <stop offset="100%" stopColor={C.AMBER} stopOpacity={0} />
        </linearGradient>
      </defs>
      {yTicks.map((tv, i) => (
        <g key={i}>
          <line x1={pad.l} x2={pad.l + iw} y1={y(tv)} y2={y(tv)} stroke={C.BORDER} strokeWidth={0.5} />
          <text x={pad.l - 6} y={y(tv) + 3} fill={C.MUTED} fontSize={9} fontFamily={C.MONO} textAnchor="end">
            {tv.toFixed(2)}
          </text>
        </g>
      ))}
      <polygon points={area} fill="url(#eden-chart-fill)" />
      <polyline points={linePts} fill="none" stroke={C.AMBER} strokeWidth={1.4} />
      {series.length <= 60 && series.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={1.6} fill={C.AMBER} />
      ))}
    </svg>
  )
}

function Heatmap({ matrix }: { matrix: number[][] }) {
  const max = Math.max(1, ...matrix.flat())
  const rows = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
  // matrix is indexed by SQL DOW: 0=Sun..6=Sat. We want Mon..Sun order:
  const order = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div className="eden-heatmap">
      <div className="eden-heatmap-grid" style={{ gridTemplateColumns: `28px repeat(24, 1fr)` }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="eden-heatmap-col-label">{h % 3 === 0 ? `${h}` : ""}</div>
        ))}
        {order.map((d, i) => (
          <>
            <div key={`l-${i}`} className="eden-heatmap-row-label">{rows[i]}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const v = matrix[d]?.[h] ?? 0
              const opacity = v === 0 ? 0.04 : 0.12 + (v / max) * 0.78
              return (
                <div
                  key={`c-${d}-${h}`}
                  className="eden-heatmap-cell"
                  style={{ background: `rgba(247,185,85,${opacity})` }}
                  title={`${rows[i]} ${h}:00 — ${v}`}
                />
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────
function OverviewTab({ token }: { token: string | null }) {
  const dashboard = useProtectedJson<DashboardResponse>(
    token ? `${API}/api/eden/dashboard` : null, token
  )

  if (dashboard.loading && !dashboard.data) {
    return <StateMsg label="Loading club dashboard…" />
  }
  if (dashboard.err || !dashboard.data) {
    return <StateMsg label={dashboard.err ?? "Could not reach EDEN backend."} tone={C.RED} />
  }
  const d = dashboard.data
  const attendanceSpark = d.attendance_90d.slice(-20).map(p => p.value)
  const safeSpark = attendanceSpark.length > 1 ? attendanceSpark : [0, 0, 0]

  return (
    <>
      <div className="eden-kpi-row eden-kpi-row-5">
        <Kpi
          label="Past Events"
          value={String(d.kpis.past_events)}
          delta={`+${d.kpis.upcoming_events} upcoming`}
          deltaDir="up"
          spark={safeSpark}
        />
        <Kpi
          label="Avg Attendance"
          value={d.kpis.avg_attendance > 0 ? d.kpis.avg_attendance.toFixed(0) : "—"}
          delta={`${d.kpis.attendance_capture_pct.toFixed(0)}% captured`}
          deltaDir={d.kpis.attendance_capture_pct >= 70 ? "up" : "down"}
          spark={safeSpark.map(v => Math.max(0, v * 0.9))}
        />
        <Kpi
          label="Upcoming RSVPs"
          value={String(d.kpis.upcoming_rsvps)}
          delta={`${d.kpis.rsvp_delta_7d >= 0 ? "+" : ""}${d.kpis.rsvp_delta_7d} this week`}
          deltaDir={d.kpis.rsvp_delta_7d >= 0 ? "up" : "down"}
          spark={safeSpark.map(v => v * 0.8 + 0.3)}
        />
        <Kpi
          label="Free-Food Boost"
          value={`${d.kpis.free_food_lift_pct >= 0 ? "+" : ""}${d.kpis.free_food_lift_pct.toFixed(0)}%`}
          delta="on engagement"
          deltaDir={d.kpis.free_food_lift_pct >= 0 ? "up" : "down"}
          spark={safeSpark.map(v => v * 1.2)}
        />
        <Kpi
          label="Surprises (60d)"
          value={String(d.kpis.anomalies)}
          delta={d.kpis.anomalies > 0 ? "review queue" : "all stable"}
          deltaDir={d.kpis.anomalies > 0 ? "up" : "flat"}
          spark={safeSpark.map(v => Math.abs(v - 1))}
        />
      </div>

      <div className="eden-grid eden-grid-5-7" style={{ marginBottom: 10 }}>
        <Panel
          title="Club Attendance · 90d"
          meta={d.attendance_90d.length > 0 ? `${d.attendance_90d.length} data points` : "no attendance captured yet"}
          legend={[{ color: C.AMBER, label: "avg headcount per event" }]}
        >
          <div style={{ padding: 4 }}>
            <LineChart series={d.attendance_90d} />
          </div>
        </Panel>
        <Panel title="Biggest Surprises" meta={`${d.anomalies.length} alerts · events that under- or over-performed`}>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {d.anomalies.length === 0 && <div className="eden-anom eden-dim">No surprises detected.</div>}
            {d.anomalies.map(a => (
              <div key={a.event_id} className="eden-anom">
                <span className={`eden-tag eden-tag-${a.type === "SURGE" ? "surge" : "dip"}`}>{a.type === "SURGE" ? "OVER" : "UNDER"}</span>
                <span className="eden-anom-name">{a.event_name}</span>
                <span className="eden-anom-desc">engagement {a.score.toFixed(2)} vs club average {a.mu.toFixed(2)} · {a.date}</span>
                <span className="eden-anom-z">{a.z_sigma.toFixed(1)}× typical</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="eden-grid eden-grid-5-7" style={{ marginBottom: 10 }}>
        <Panel title="Top Past Events · This Club" meta="ranked by engagement score">
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            <table className="eden-table">
              <thead><tr><th>#</th><th>Event</th><th>Cat</th><th className="eden-r">Score</th><th className="eden-r">Date</th></tr></thead>
              <tbody>
                {d.top_past_events.length === 0 && (
                  <tr><td colSpan={5} className="eden-dim" style={{ padding: 14 }}>No past events yet.</td></tr>
                )}
                {d.top_past_events.map((e, i) => (
                  <tr key={e.event_id}>
                    <td className="eden-dim">{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ color: C.FG }}>{e.event_name}</td>
                    <td><span className="eden-chip">{e.category ?? "—"}</span></td>
                    <td className="eden-r eden-up">{e.score.toFixed(2)}</td>
                    <td className="eden-r eden-dim">{e.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div>
          <Panel title="Day × Hour Heatmap" meta="historical event density · 180d">
            <div style={{ padding: 8 }}>
              <Heatmap matrix={d.heatmap} />
            </div>
          </Panel>
          <div style={{ height: 10 }} />
          <Panel title="Upcoming Pipeline" meta={`next ${d.upcoming_pipeline.length} events`}>
            <table className="eden-table">
              <tbody>
                {d.upcoming_pipeline.length === 0 && (
                  <tr><td colSpan={4} className="eden-dim" style={{ padding: 14 }}>No upcoming events scheduled.</td></tr>
                )}
                {d.upcoming_pipeline.slice(0, 5).map(e => (
                  <tr key={e.event_id}>
                    <td style={{ color: C.FG }}>{e.event_name}</td>
                    <td className="eden-dim">{e.category ?? "—"}</td>
                    <td className="eden-r">
                      <span className="eden-chip" style={{ color: C.CYAN, borderColor: "rgba(78,201,224,0.4)" }}>
                        Est {e.predicted != null ? e.predicted.toFixed(2) : "—"}
                      </span>
                    </td>
                    <td className="eden-r eden-dim">{e.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────
export function Panel({ title, meta, legend, children }: {
  title: string; meta?: string; legend?: Array<{ color: string; label: string }>; children: ReactNode
}) {
  return (
    <section className="eden-panel">
      <div className="eden-panel-hdr">
        <h3><span className="eden-prefix">›</span>{title}</h3>
        {legend && legend.length > 0 ? (
          <div className="eden-legend">
            {legend.map((l, i) => (
              <div key={i} className="eden-legend-item">
                <div className="eden-legend-dot" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        ) : meta ? <div className="eden-panel-meta">{meta}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function StateMsg({ label, tone = C.MUTED }: { label: string; tone?: string }) {
  return (
    <div className="eden-panel">
      <div style={{ padding: 18, fontFamily: C.MONO, fontSize: 11, color: tone }}>{label}</div>
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────
function Footer({ d }: { d: DashboardResponse | null }) {
  return (
    <div className="eden-statusbar">
      <div className="eden-sb-seg"><b>EVENTS</b> {d ? d.kpis.past_events + d.kpis.upcoming_events : "—"}</div>
      <div className="eden-sb-seg"><b>UPCOMING</b> {d?.kpis.upcoming_events ?? "—"}</div>
      <div className="eden-sb-seg"><b>AVG ATTENDANCE</b>{" "}
        <span className={d && d.kpis.attendance_capture_pct >= 70 ? "eden-up" : "eden-down"}>
          {d && d.kpis.avg_attendance > 0 ? d.kpis.avg_attendance.toFixed(0) : "—"}
        </span>
      </div>
      <div className="eden-sb-seg"><b>RSVP TOTAL</b> {d?.kpis.upcoming_rsvps ?? "—"}</div>
      <div className="eden-sb-seg"><b>CAPTURE</b> {d ? `${d.kpis.attendance_capture_pct.toFixed(0)}%` : "—"}</div>
      <div style={{ flex: 1 }} />
      <div className="eden-sb-seg eden-dim">F1–F4 · PAGES · esc · CLOSE</div>
    </div>
  )
}

// ── App root ──────────────────────────────────────────────────────────────
export default function EdenPage() {
  const { user, token, loading: authLoading } = useAuth()
  const [page, setPage] = useState<PageId>("overview")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      const map: Record<string, PageId> = {
        F1: "overview", F2: "forecast", F3: "whatif", F4: "attendance",
        Digit1: "overview", Digit2: "forecast", Digit3: "whatif", Digit4: "attendance",
      }
      const next = map[e.code] ?? map[e.key]
      if (!next) return
      e.preventDefault()
      setPage(next)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const dashboard = useProtectedJson<DashboardResponse>(
    token && user?.is_eboard ? `${API}/api/eden/dashboard` : null,
    token
  )

  const handle = useMemo(() => (user?.email ?? "eboard").split("@")[0], [user])
  const initials = useMemo(() => {
    const parts = handle.split(/[._-]+/).filter(Boolean).slice(0, 2)
    const txt = parts.map(p => p[0]?.toUpperCase() ?? "").join("")
    return txt || handle.slice(0, 2).toUpperCase()
  }, [handle])

  const clubAbbr = dashboard.data?.club.abbr
    ?? (user?.eboard_club_id != null ? `CLUB ${user.eboard_club_id}` : "UNLINKED")

  const scopedSetPage = useCallback((p: PageId) => setPage(p), [])

  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh", background: C.BG, color: C.MUTED,
        fontFamily: C.MONO, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        Loading EDEN terminal…
      </div>
    )
  }
  if (!user?.is_eboard) {
    return <Navigate to="/home" replace />
  }

  return (
    <>
      <EdenStyles />
      <div className="eden-shell">
        <Topbar clubAbbr={clubAbbr} handle={handle} initials={initials} />
        <Nav page={page} setPage={scopedSetPage} semester={dashboard.data?.semester} />
        <div className="eden-main">
          {page === "overview" && <OverviewTab token={token} />}
          {page === "forecast" && <ForecastTab token={token} />}
          {page === "whatif" && <WhatIfTab token={token} />}
          {page === "attendance" && <AttendanceTab token={token} clubId={user.eboard_club_id ?? null} />}
        </div>
        <Footer d={dashboard.data} />
      </div>
    </>
  )
}

// ── Style block ───────────────────────────────────────────────────────────
function EdenStyles() {
  return (
    <style>{`
      .eden-shell {
        display: grid;
        grid-template-rows: 40px 28px 1fr 22px;
        height: 100dvh;
        background: ${C.BG};
        color: ${C.FG};
        font-family: ${C.SANS};
        font-size: 13px;
      }

      /* Topbar */
      .eden-topbar { display: flex; align-items: center; padding: 0 14px; background: ${C.BG_ELEV}; border-bottom: 1px solid ${C.BORDER}; gap: 14px; font-family: ${C.MONO}; font-size: 11px; }
      .eden-tb-home { color: ${C.MUTED}; text-decoration: none; letter-spacing: 0.16em; font-size: 10px; padding: 3px 8px; border: 1px solid ${C.BORDER_2}; border-radius: 2px; transition: all 0.12s; }
      .eden-tb-home:hover { color: ${C.AMBER}; border-color: ${C.AMBER_DIM}; background: rgba(247,185,85,0.06); }
      .eden-tb-logo { display: flex; align-items: center; gap: 8px; font-weight: 600; letter-spacing: 0.18em; color: ${C.AMBER}; }
      .eden-sq { width: 10px; height: 10px; background: ${C.AMBER}; box-shadow: 0 0 8px ${C.AMBER}; }
      .eden-tb-ver { color: ${C.MUTED}; font-size: 10px; letter-spacing: 0.1em; }
      .eden-tb-div { width: 1px; height: 16px; background: ${C.BORDER_2}; }
      .eden-tb-status { display: flex; align-items: center; gap: 6px; font-size: 10px; color: ${C.FG_DIM}; letter-spacing: 0.08em; }
      .eden-tb-status .eden-led { width: 6px; height: 6px; border-radius: 50%; background: ${C.GREEN}; box-shadow: 0 0 6px ${C.GREEN}; animation: edenPulse 2s infinite; }
      @keyframes edenPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      .eden-tb-right { display: flex; align-items: center; gap: 12px; }
      .eden-tb-org-badge { padding: 2px 7px; background: rgba(247,185,85,0.1); border: 1px solid rgba(247,185,85,0.3); color: ${C.AMBER}; font-size: 9px; letter-spacing: 0.18em; border-radius: 2px; }
      .eden-tb-clock { color: ${C.FG_DIM}; font-variant-numeric: tabular-nums; }
      .eden-tb-user { display: flex; align-items: center; gap: 6px; font-size: 10px; color: ${C.FG_DIM}; }
      .eden-av { width: 18px; height: 18px; border-radius: 50%; background: linear-gradient(135deg, ${C.AMBER}, ${C.CYAN}); color: ${C.BG}; font-weight: 700; font-size: 9px; display: flex; align-items: center; justify-content: center; font-family: ${C.SANS}; }

      /* Nav */
      .eden-nav { display: flex; align-items: stretch; background: ${C.BG}; border-bottom: 1px solid ${C.BORDER}; padding: 0 8px; font-family: ${C.MONO}; font-size: 10px; }
      .eden-nav-item { display: flex; align-items: center; gap: 6px; padding: 0 14px; color: ${C.MUTED}; text-transform: uppercase; letter-spacing: 0.14em; cursor: pointer; border-right: 1px solid ${C.BORDER}; position: relative; user-select: none; }
      .eden-nav-item:first-child { border-left: 1px solid ${C.BORDER}; }
      .eden-nav-item:hover { color: ${C.FG_DIM}; background: rgba(185,215,255,0.025); }
      .eden-nav-item.active { color: ${C.AMBER}; background: rgba(247,185,85,0.06); }
      .eden-nav-item.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: ${C.AMBER}; }
      .eden-num { color: ${C.MUTED}; font-size: 9px; opacity: 0.6; }
      .eden-nav-item.active .eden-num { color: ${C.AMBER_DIM}; opacity: 1; }
      .eden-nav-meta { padding: 0 12px; color: ${C.MUTED}; font-size: 10px; letter-spacing: 0.08em; display: flex; align-items: center; gap: 8px; }

      /* Statusbar */
      .eden-statusbar { display: flex; align-items: center; padding: 0 12px; background: ${C.BG_ELEV}; border-top: 1px solid ${C.BORDER}; font-family: ${C.MONO}; font-size: 10px; color: ${C.MUTED}; gap: 14px; }
      .eden-sb-seg { display: flex; align-items: center; gap: 4px; }
      .eden-sb-seg b { color: ${C.FG_DIM}; font-weight: 500; }
      .eden-up { color: ${C.GREEN}; }
      .eden-down { color: ${C.RED}; }
      .eden-flat { color: ${C.MUTED}; }
      .eden-dim { color: ${C.MUTED}; }

      /* Main */
      .eden-main {
        overflow: auto; padding: 14px;
        background:
          radial-gradient(ellipse 80% 60% at 20% 0%, rgba(247,185,85,0.03), transparent 60%),
          radial-gradient(ellipse 80% 60% at 80% 100%, rgba(78,201,224,0.02), transparent 60%),
          ${C.BG};
      }
      .eden-main::-webkit-scrollbar { width: 8px; height: 8px; }
      .eden-main::-webkit-scrollbar-track { background: transparent; }
      .eden-main::-webkit-scrollbar-thumb { background: ${C.BORDER_2}; border-radius: 4px; }
      .eden-main::-webkit-scrollbar-thumb:hover { background: ${C.AMBER_DIM}; }

      /* Panel */
      .eden-panel { background: ${C.PANEL}; border: 1px solid ${C.BORDER}; border-radius: 3px; overflow: hidden; }
      .eden-panel-hdr { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid ${C.BORDER}; background: ${C.PANEL_2}; }
      .eden-panel-hdr h3 { font-family: ${C.MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: ${C.FG_DIM}; margin: 0; }
      .eden-prefix { color: ${C.AMBER}; margin-right: 6px; }
      .eden-panel-meta { font-family: ${C.MONO}; font-size: 9px; color: ${C.MUTED}; letter-spacing: 0.12em; }

      /* KPIs */
      .eden-kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 14px; }
      .eden-kpi-row-5 { grid-template-columns: repeat(5, 1fr); }
      .eden-kpi { background: ${C.PANEL}; border: 1px solid ${C.BORDER}; border-radius: 3px; padding: 10px 14px; position: relative; overflow: hidden; }
      .eden-kpi::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: ${C.AMBER}; opacity: 0.5; }
      .eden-kpi-label { font-family: ${C.MONO}; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: ${C.MUTED}; }
      .eden-kpi-value { font-family: ${C.MONO}; font-size: 22px; font-weight: 600; color: ${C.FG}; margin-top: 4px; font-variant-numeric: tabular-nums; }
      .eden-kpi-delta { font-family: ${C.MONO}; font-size: 10px; margin-top: 2px; }
      .eden-kpi-spark { position: absolute; right: 10px; top: 10px; width: 60px; height: 22px; opacity: 0.7; }

      /* Grids */
      .eden-grid { display: grid; gap: 10px; }
      .eden-grid-2 { grid-template-columns: 1fr 1fr; }
      .eden-grid-3 { grid-template-columns: repeat(3, 1fr); }
      .eden-grid-5-7 { grid-template-columns: 5fr 7fr; }

      /* Tables */
      .eden-table { width: 100%; border-collapse: collapse; font-family: ${C.MONO}; font-size: 11px; }
      .eden-table th { text-align: left; padding: 8px 12px; color: ${C.MUTED}; font-weight: 500; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; border-bottom: 1px solid ${C.BORDER}; background: ${C.PANEL_2}; position: sticky; top: 0; }
      .eden-table td { padding: 7px 12px; border-bottom: 1px solid ${C.BORDER}; color: ${C.FG_DIM}; font-variant-numeric: tabular-nums; }
      .eden-table tr { cursor: pointer; transition: background 0.12s; }
      .eden-table tr:hover td { background: rgba(247,185,85,0.04); color: ${C.FG}; }
      .eden-table tr.selected td { background: rgba(247,185,85,0.08); color: ${C.FG}; }
      .eden-table .eden-r { text-align: right; }
      .eden-r { text-align: right; }
      .eden-chip { display: inline-block; padding: 1px 7px; border-radius: 2px; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; border: 1px solid ${C.BORDER_2}; color: ${C.MUTED}; }

      /* Anomaly rows */
      .eden-anom { display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid ${C.BORDER}; font-family: ${C.MONO}; font-size: 11px; gap: 10px; }
      .eden-anom:hover { background: rgba(185,215,255,0.03); }
      .eden-tag { padding: 2px 7px; border-radius: 2px; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600; }
      .eden-tag-surge { color: ${C.GREEN}; background: rgba(102,209,158,0.1); border: 1px solid rgba(102,209,158,0.3); }
      .eden-tag-dip { color: ${C.RED}; background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); }
      .eden-anom-name { color: ${C.FG}; min-width: 100px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .eden-anom-desc { color: ${C.MUTED}; flex: 1; font-size: 10px; }
      .eden-anom-z { color: ${C.FG_DIM}; font-variant-numeric: tabular-nums; }

      /* Heatmap */
      .eden-heatmap { font-family: ${C.MONO}; font-size: 9px; color: ${C.MUTED}; }
      .eden-heatmap-grid { display: grid; gap: 2px; }
      .eden-heatmap-row-label { display: flex; align-items: center; padding-right: 6px; }
      .eden-heatmap-col-label { font-size: 8px; text-align: center; color: ${C.MUTED}; opacity: 0.6; }
      .eden-heatmap-cell { aspect-ratio: 1.2; border: 1px solid rgba(0,0,0,0.2); border-radius: 1px; }

      /* Legend */
      .eden-legend { display: flex; gap: 14px; font-family: ${C.MONO}; font-size: 10px; color: ${C.MUTED}; }
      .eden-legend-item { display: flex; align-items: center; gap: 5px; }
      .eden-legend-dot { width: 8px; height: 2px; }

      /* MC stats grid (forecast/whatif) */
      .eden-mc-stats { display: grid; gap: 8px; padding: 12px; border-bottom: 1px solid ${C.BORDER}; }
      .eden-mc-stat .eden-l { font-family: ${C.MONO}; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: ${C.MUTED}; }
      .eden-mc-stat .eden-v { font-family: ${C.MONO}; font-size: 16px; color: ${C.FG}; font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; }

      /* Bar rows */
      .eden-bar-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-family: ${C.MONO}; font-size: 10px; }
      .eden-bar-row .eden-lbl { width: 110px; color: ${C.FG_DIM}; }
      .eden-bar-row .eden-bar { flex: 1; height: 10px; background: rgba(185,215,255,0.05); position: relative; overflow: hidden; border-radius: 1px; }
      .eden-bar-row .eden-bar .eden-fill { position: absolute; left: 0; top: 0; bottom: 0; opacity: 0.78; }
      .eden-bar-row .eden-val { width: 56px; text-align: right; color: ${C.MUTED}; }

      /* Forms */
      .eden-input, .eden-select, .eden-textarea {
        background: rgba(0,0,0,0.3); border: 1px solid ${C.BORDER_2}; color: ${C.FG};
        padding: 6px 8px; border-radius: 2px; font-family: ${C.MONO}; font-size: 11px;
      }
      .eden-input:focus, .eden-select:focus, .eden-textarea:focus { outline: none; border-color: ${C.AMBER}; }
      .eden-button { background: rgba(247,185,85,0.08); border: 1px solid ${C.AMBER_DIM}; color: ${C.AMBER}; padding: 6px 12px; font-family: ${C.MONO}; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border-radius: 2px; }
      .eden-button:hover { background: rgba(247,185,85,0.16); }
      .eden-button:disabled { opacity: 0.4; cursor: not-allowed; }
      .eden-label { font-family: ${C.MONO}; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: ${C.MUTED}; }

      /* Picker list */
      .eden-picker { max-height: calc(100dvh - 220px); overflow-y: auto; }
    `}</style>
  )
}
