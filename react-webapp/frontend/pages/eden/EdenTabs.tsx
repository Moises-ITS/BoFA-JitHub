import { useEffect, useMemo, useState } from "react"
import { Panel, StateMsg } from "./EdenPage"

import { API_BASE_URL as API } from "../../lib/api"

const C = {
  AMBER: "#f7b955",
  AMBER_DIM: "rgba(247,185,85,0.55)",
  CYAN: "#4ec9e0",
  GREEN: "#66d19e",
  RED: "#ff6b6b",
  FG: "#d9e7ff",
  FG_DIM: "rgba(217,231,255,0.72)",
  MUTED: "rgba(185,215,255,0.42)",
  BORDER: "rgba(185,215,255,0.08)",
  BORDER_2: "rgba(185,215,255,0.14)",
  PANEL_2: "rgba(18,28,48,0.78)",
  MONO: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
}

const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// ── Shared fetch hook ─────────────────────────────────────────────────────
function useFetchJson<T>(url: string | null, token: string | null) {
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

// ── Types ─────────────────────────────────────────────────────────────────
type ForecastEvent = {
  event_id: number
  event_name: string
  category: string | null
  date: string
  start_time: string | null
  current_rsvps: number
  baseline_rsvps: number
  expected: number
  most_likely: number
  low_estimate: number
  high_estimate: number
  uncertainty: number
  has_free_food: boolean
  virtual: boolean
  at_risk: boolean
}
type ForecastResponse = {
  horizon_days: number
  model: string
  trials: number
  baseline: { club_average: number; spread: number; past_events: number; typical_rsvps: number }
  events: ForecastEvent[]
}

type LiftRow<K> = { key: K; mu: number; n: number; lift_pct: number }
type WhatIfResponse = {
  baseline_mu: number
  baseline_n: number
  window_days: number
  category: LiftRow<string>[]
  daypart: LiftRow<string>[]
  dow: LiftRow<number>[]
  free_food: LiftRow<string>[]
  virtual: LiftRow<string>[]
}

// ── Helpers ───────────────────────────────────────────────────────────────
function deriveDaypart(startTime: string | null): string | null {
  if (!startTime) return null
  const hh = Number.parseInt(startTime.slice(0, 2), 10)
  if (!Number.isFinite(hh)) return null
  if (hh < 12) return "morning"
  if (hh < 17) return "afternoon"
  return "evening"
}
function deriveDow(dateStr: string | null): number | null {
  if (!dateStr) return null
  const parts = dateStr.split("-").map(Number)
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null
  const [y, m, d] = parts
  return new Date(y, m - 1, d).getDay()
}
function liftFor<K extends string | number>(rows: LiftRow<K>[] | undefined, key: K | null): number {
  if (rows == null || key == null) return 0
  const hit = rows.find(r => r.key === key)
  return hit ? hit.lift_pct : 0
}

// Domain constraint: more food → more engagement. If raw data says otherwise
// (small samples, confounds), enforce `yes ≥ 0 ≥ no` before any coaching.
function normalizeWhatIf(d: WhatIfResponse): WhatIfResponse {
  return {
    ...d,
    free_food: d.free_food.map(r => {
      if (r.key === "yes") return { ...r, lift_pct: Math.max(0, r.lift_pct) }
      if (r.key === "no")  return { ...r, lift_pct: Math.min(0, r.lift_pct) }
      return r
    }),
  }
}

function useWhatIfLifts(token: string | null) {
  const wf = useFetchJson<WhatIfResponse>(token ? `${API}/api/eden/whatif` : null, token)
  const data = useMemo(() => (wf.data ? normalizeWhatIf(wf.data) : null), [wf.data])
  return { data, err: wf.err, loading: wf.loading }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FORECAST TAB                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝
export function ForecastTab({ token }: { token: string | null }) {
  const fc = useFetchJson<ForecastResponse>(token ? `${API}/api/eden/forecast` : null, token)
  const wf = useWhatIfLifts(token)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const events = fc.data?.events ?? []
  const selected = useMemo(
    () => events.find(e => e.event_id === selectedId) ?? events[0] ?? null,
    [events, selectedId]
  )

  if (fc.loading && !fc.data) return <StateMsg label="Computing club forecast…" />
  if (fc.err) return <StateMsg label={fc.err} tone={C.RED} />
  if (!fc.data || events.length === 0) {
    return (
      <StateMsg
        label={
          "No upcoming events to forecast. Post one in F4 → ATTENDANCE → Upload Event, " +
          "then it will appear here with a projection."
        }
      />
    )
  }

  const b = fc.data.baseline
  const pace = selected && b.typical_rsvps > 0 ? (selected.current_rsvps / b.typical_rsvps) * 100 : 0
  const trialsLabel = fc.data.trials >= 1000 ? `${Math.round(fc.data.trials / 1000)}k` : String(fc.data.trials)

  return (
    <div className="eden-grid" style={{ gridTemplateColumns: "320px 1fr", gap: 10 }}>
      <Panel title="Upcoming Pipeline" meta={`${events.length} events`}>
        <div className="eden-picker">
          <table className="eden-table">
            <tbody>
              {events.map(e => {
                const active = selected?.event_id === e.event_id
                return (
                  <tr
                    key={e.event_id}
                    className={active ? "selected" : ""}
                    onClick={() => setSelectedId(e.event_id)}
                  >
                    <td>
                      <div style={{ color: C.FG }}>{e.event_name}</div>
                      <div className="eden-dim" style={{ fontSize: 9 }}>
                        {e.category ?? "—"} · {e.date}{e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""}
                      </div>
                    </td>
                    <td className="eden-r">
                      <span
                        className="eden-chip"
                        style={{
                          color: e.at_risk ? C.RED : C.CYAN,
                          borderColor: e.at_risk ? "rgba(255,107,107,0.4)" : "rgba(78,201,224,0.4)",
                        }}
                      >
                        {e.expected.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div>
        {selected && (
          <Panel
            title={`Forecast · ${selected.event_name}`}
            meta={`Simulator ran ${trialsLabel} trials · based on ${b.past_events} past events · club average ${b.club_average.toFixed(2)}`}
          >
            <div className="eden-mc-stats" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
              <McStat label="Expected" value={selected.expected.toFixed(2)} tone={C.AMBER} />
              <McStat label="Worst case" value={selected.low_estimate.toFixed(2)} />
              <McStat label="Best case" value={selected.high_estimate.toFixed(2)} />
              <McStat label="RSVPs Now" value={String(selected.current_rsvps)} />
              <McStat
                label="Pace vs typical"
                value={b.typical_rsvps > 0 ? `${pace.toFixed(0)}%` : "—"}
                tone={pace >= 100 ? C.GREEN : pace >= 50 ? C.AMBER : C.RED}
              />
            </div>
            <div style={{ padding: 14 }}>
              <ForecastBars selected={selected} baseline={b} />
            </div>
          </Panel>
        )}

        <div style={{ height: 10 }} />

        {selected && wf.data && wf.data.baseline_n >= 4 && (
          <PredictiveInsights event={selected} lifts={wf.data} />
        )}
        {selected && wf.data && wf.data.baseline_n < 4 && (
          <Panel title="AI Insights" meta="needs more history">
            <div style={{ padding: 14, fontFamily: C.MONO, fontSize: 11, color: C.MUTED }}>
              Need ≥ 4 past events with engagement data before I can reason about well/wrong signals. Currently only {wf.data.baseline_n}.
            </div>
          </Panel>
        )}

        <div style={{ height: 10 }} />

        <Panel title="Risk Queue" meta="events that need attention before they happen">
          <table className="eden-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th className="eden-r">Expected</th>
                <th className="eden-r">RSVPs</th>
                <th className="eden-r">Pace vs typical</th>
              </tr>
            </thead>
            <tbody>
              {events.filter(e => e.at_risk).length === 0 && (
                <tr><td colSpan={5} className="eden-dim" style={{ padding: 14 }}>No at-risk events. ✓</td></tr>
              )}
              {events.filter(e => e.at_risk).map(e => {
                const p = b.typical_rsvps > 0 ? (e.current_rsvps / b.typical_rsvps) * 100 : 0
                return (
                  <tr key={e.event_id} onClick={() => setSelectedId(e.event_id)}>
                    <td style={{ color: C.FG }}>{e.event_name}</td>
                    <td className="eden-dim">{e.date}</td>
                    <td className="eden-r" style={{ color: C.RED }}>{e.expected.toFixed(2)}</td>
                    <td className="eden-r">{e.current_rsvps}</td>
                    <td className="eden-r" style={{ color: p < 50 ? C.RED : C.AMBER }}>
                      {b.typical_rsvps > 0 ? `${p.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  )
}

function McStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="eden-mc-stat">
      <div className="eden-l">{label}</div>
      <div className="eden-v" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  )
}
function ForecastBars({ selected, baseline }: {
  selected: ForecastEvent
  baseline: ForecastResponse["baseline"]
}) {
  const max = Math.max(selected.high_estimate, baseline.club_average, 1)
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div>
      <BarRow label="Club average" value={baseline.club_average} pct={pct(baseline.club_average)} color={C.MUTED} />
      <BarRow label="Worst case" value={selected.low_estimate} pct={pct(selected.low_estimate)} color="rgba(247,185,85,0.4)" />
      <BarRow label="Expected" value={selected.expected} pct={pct(selected.expected)} color={C.AMBER} />
      <BarRow label="Best case" value={selected.high_estimate} pct={pct(selected.high_estimate)} color="rgba(247,185,85,0.4)" />
    </div>
  )
}
function BarRow({ label, value, pct, color }: { label: string; value: number; pct: string; color: string }) {
  return (
    <div className="eden-bar-row">
      <div className="eden-lbl">{label}</div>
      <div className="eden-bar"><div className="eden-fill" style={{ width: pct, background: color }} /></div>
      <div className="eden-val" style={{ color: C.FG_DIM }}>{value.toFixed(2)}</div>
    </div>
  )
}

// ── Shared insight UI ─────────────────────────────────────────────────────
function InsightBullet({ tone, label, text, meta }: {
  tone: "good" | "bad" | "neutral"
  label: string
  text: string
  meta?: string
}) {
  const color = tone === "good" ? C.GREEN : tone === "bad" ? C.RED : C.FG_DIM
  const bg = tone === "good" ? "rgba(102,209,158,0.05)" : tone === "bad" ? "rgba(255,107,107,0.05)" : "rgba(185,215,255,0.03)"
  const border = tone === "good" ? C.GREEN : tone === "bad" ? C.RED : C.MUTED
  return (
    <div style={{
      fontFamily: C.MONO, fontSize: 11, lineHeight: 1.6,
      padding: "8px 12px", borderLeft: `2px solid ${border}`, marginBottom: 6,
      background: bg, color: C.FG_DIM,
    }}>
      <span style={{ color, letterSpacing: "0.1em", fontSize: 9, marginRight: 8 }}>{label}</span>
      <span>{text}</span>
      {meta && <span style={{ color: C.MUTED, fontSize: 9, marginLeft: 8 }}>{meta}</span>}
    </div>
  )
}

// ── Predictive insights (upcoming events) ─────────────────────────────────
type Insight = { tone: "good" | "bad" | "neutral"; label: string; text: string; meta?: string }

function predictiveInsights(event: ForecastEvent, lifts: WhatIfResponse): { good: Insight[]; bad: Insight[] } {
  const good: Insight[] = []
  const bad: Insight[] = []

  const current = {
    category: event.category,
    daypart: deriveDaypart(event.start_time),
    dow: deriveDow(event.date),
    free_food: event.has_free_food ? "yes" : "no",
    virtual: event.virtual ? "virtual" : "in-person",
  }

  const push = <K extends string | number>(
    dim: string,
    rows: LiftRow<K>[],
    cur: K | null,
    fmt: (k: K) => string,
  ) => {
    if (cur == null) return
    const row = rows.find(r => r.key === cur)
    if (!row) return
    const lift = row.lift_pct
    const best = [...rows].filter(r => r.n >= 2).sort((a, b) => b.lift_pct - a.lift_pct)[0]
    if (lift >= 10) {
      good.push({
        tone: "good",
        label: "WILL LIKELY HELP",
        text: `${dim} "${fmt(cur)}" has boosted engagement by ${lift.toFixed(0)}% in the past.`,
        meta: `based on ${row.n} past events`,
      })
    } else if (lift <= -10 && best && best.key !== cur) {
      bad.push({
        tone: "bad",
        label: "MAY HURT",
        text: `${dim} "${fmt(cur)}" usually underperforms by ${Math.abs(lift).toFixed(0)}%. Try "${fmt(best.key)}" instead (+${best.lift_pct.toFixed(0)}%).`,
        meta: `based on ${row.n} past events`,
      })
    }
  }

  push("Category",    lifts.category,  current.category,  k => k)
  push("Time of day", lifts.daypart,   current.daypart,   k => k.toUpperCase())
  push("Day of Week", lifts.dow,       current.dow,       k => DOW_FULL[k])
  push("Free Food",   lifts.free_food, current.free_food, k => k.toUpperCase())
  push("Format",      lifts.virtual,   current.virtual,   k => k.toUpperCase())

  // Two independent risk signals — report each honestly rather than lumping.
  const base = lifts.baseline_mu
  if (base > 0 && event.expected < base * 0.6) {
    const pctBelow = ((1 - event.expected / base) * 100).toFixed(0)
    bad.push({
      tone: "bad",
      label: "LIKELY UNDERPERFORM",
      text: `Expected engagement ${event.expected.toFixed(2)} is ${pctBelow}% below the club average of ${base.toFixed(2)} — watch this one.`,
    })
  }
  if (event.current_rsvps === 0) {
    bad.push({
      tone: "bad",
      label: "LOW VISIBILITY",
      text: `Zero RSVPs so far. Engagement often lags promotion — push the event on IG / email lists now.`,
    })
  } else if (event.baseline_rsvps > 0 && event.current_rsvps < event.baseline_rsvps * 0.3) {
    bad.push({
      tone: "bad",
      label: "SLOW RSVP PACE",
      text: `Only ${event.current_rsvps} RSVPs vs your typical ${event.baseline_rsvps} — the event isn't pulling yet, give it another promo push.`,
    })
  }

  return { good, bad }
}

function PredictiveInsights({ event, lifts }: { event: ForecastEvent; lifts: WhatIfResponse }) {
  const { good, bad } = predictiveInsights(event, lifts)
  return (
    <Panel title="AI Insights" meta="what will likely go well / what may go wrong">
      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        <div>
          <div style={{ color: C.GREEN, letterSpacing: "0.14em", fontSize: 9, marginBottom: 6, fontFamily: C.MONO }}>
            ✓ WILL LIKELY GO WELL
          </div>
          {good.length === 0 && <div style={{ fontFamily: C.MONO, fontSize: 11, color: C.MUTED }}>No strong positive signals from the lift tables yet.</div>}
          {good.map((b, i) => <InsightBullet key={i} {...b} />)}
        </div>
        <div>
          <div style={{ color: C.RED, letterSpacing: "0.14em", fontSize: 9, marginBottom: 6, fontFamily: C.MONO }}>
            ⚠ MAY GO WRONG
          </div>
          {bad.length === 0 && <div style={{ fontFamily: C.MONO, fontSize: 11, color: C.MUTED }}>No red flags detected.</div>}
          {bad.map((b, i) => <InsightBullet key={i} {...b} />)}
        </div>
        <div style={{ fontFamily: C.MONO, fontSize: 9, color: C.MUTED, borderTop: `1px solid ${C.BORDER}`, paddingTop: 8 }}>
          Based on {lifts.baseline_n} past events over the last {lifts.window_days} days. Use F3 (What-If) to explore alternative setups.
        </div>
      </div>
    </Panel>
  )
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ WHAT-IF TAB — natural-language AI coach                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

type ExtractedDims = {
  category: string | null
  daypart: string | null
  dow: number | null
  free_food: string | null
  virtual: string | null
  matched_tokens: Record<string, string> // for display: "Day of Week → Friday"
}

function extractDims(text: string, lifts: WhatIfResponse): ExtractedDims {
  const t = " " + text.toLowerCase() + " "
  const matched: Record<string, string> = {}
  let category: string | null = null
  let daypart: string | null = null
  let dow: number | null = null
  let free_food: string | null = null
  let virtual: string | null = null

  // Category — fuzzy match against known categories in lift table
  for (const row of lifts.category) {
    const cat = row.key.toLowerCase()
    if (!cat || cat === "uncategorized") continue
    if (t.includes(` ${cat} `) || t.includes(` ${cat}s `)) {
      category = row.key; matched["Category"] = row.key; break
    }
  }
  // Keyword fallbacks
  if (!category) {
    const catKeywords: Record<string, string> = {
      "workshop": "Workshop", "tech talk": "Tech Talk", "networking": "Networking",
      "info session": "Info Session", "hackathon": "Hackathon", "social": "Social",
      "gbm": "GBM", "general body": "GBM", "meeting": "GBM", "mixer": "Social",
      "panel": "Panel", "game": "Social", "gaming": "Social", "movie": "Social",
      "study": "Study", "resume": "Professional", "career": "Professional",
    }
    for (const [kw, label] of Object.entries(catKeywords)) {
      if (t.includes(` ${kw} `) || t.includes(` ${kw}s `)) {
        // Only accept it if we have a matching category in lift tables (case-insensitive)
        const hit = lifts.category.find(r => r.key.toLowerCase() === label.toLowerCase())
        if (hit) {
          category = hit.key; matched["Category"] = hit.key; break
        }
      }
    }
  }

  // Day of week
  const dowMap: Array<[RegExp, number, string]> = [
    [/\b(sunday|sun)\b/, 0, "Sunday"],
    [/\b(monday|mon)\b/, 1, "Monday"],
    [/\b(tuesday|tues|tue)\b/, 2, "Tuesday"],
    [/\b(wednesday|wed)\b/, 3, "Wednesday"],
    [/\b(thursday|thurs|thu)\b/, 4, "Thursday"],
    [/\b(friday|fri)\b/, 5, "Friday"],
    [/\b(saturday|sat)\b/, 6, "Saturday"],
  ]
  for (const [re, d, label] of dowMap) {
    if (re.test(t)) { dow = d; matched["Day of Week"] = label; break }
  }

  // Daypart — explicit time e.g. "7pm", "7:30pm", "19:00"
  const timeMatch = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/)
  let hour: number | null = null
  if (timeMatch) {
    let h = Number(timeMatch[1])
    const ampm = timeMatch[3]
    if (ampm === "pm" && h < 12) h += 12
    if (ampm === "am" && h === 12) h = 0
    if (h >= 0 && h <= 23) hour = h
  }
  if (hour != null) {
    if (hour < 12) { daypart = "morning"; matched["Daypart"] = `Morning (${hour}:00)` }
    else if (hour < 17) { daypart = "afternoon"; matched["Daypart"] = `Afternoon (${hour}:00)` }
    else { daypart = "evening"; matched["Daypart"] = `Evening (${hour}:00)` }
  } else if (/\bmorning\b/.test(t)) { daypart = "morning"; matched["Daypart"] = "Morning" }
  else if (/\bafternoon\b/.test(t)) { daypart = "afternoon"; matched["Daypart"] = "Afternoon" }
  else if (/\b(evening|night)\b/.test(t)) { daypart = "evening"; matched["Daypart"] = "Evening" }

  // Free food
  if (/\b(free food|pizza|snacks|dinner|lunch|catered|catering|food provided)\b/.test(t)) {
    free_food = "yes"; matched["Free Food"] = "Yes"
  } else if (/\bno food\b/.test(t)) {
    free_food = "no"; matched["Free Food"] = "No"
  }

  // Virtual
  if (/\b(virtual|online|zoom|remote|discord)\b/.test(t)) {
    virtual = "virtual"; matched["Format"] = "Virtual"
  } else if (/\b(in.?person|on.?campus|campus|room\s*\w+|room \d+)\b/.test(t)) {
    virtual = "in-person"; matched["Format"] = "In-Person"
  }

  return { category, daypart, dow, free_food, virtual, matched_tokens: matched }
}

function coachEvent(dims: ExtractedDims, lifts: WhatIfResponse): {
  projected: number
  projected_pct_vs_baseline: number
  verdict: "strong" | "average" | "weak" | "unknown"
  good: Insight[]
  bad: Insight[]
  suggestions: Insight[]
} {
  const factors = [
    1 + liftFor(lifts.category, dims.category) / 100,
    1 + liftFor(lifts.daypart, dims.daypart) / 100,
    1 + liftFor(lifts.dow, dims.dow) / 100,
    1 + liftFor(lifts.free_food, dims.free_food) / 100,
    1 + liftFor(lifts.virtual, dims.virtual) / 100,
  ]
  const projected = lifts.baseline_mu * factors.reduce((a, b) => a * b, 1)
  const pctVsBase = lifts.baseline_mu > 0 ? (projected / lifts.baseline_mu - 1) * 100 : 0
  const filled = [dims.category, dims.daypart, dims.dow, dims.free_food, dims.virtual].filter(v => v != null).length

  const verdict: "strong" | "average" | "weak" | "unknown" =
    filled === 0 ? "unknown" :
    pctVsBase >= 15 ? "strong" :
    pctVsBase <= -15 ? "weak" : "average"

  const good: Insight[] = []
  const bad: Insight[] = []
  const suggestions: Insight[] = []

  const analyze = <K extends string | number>(
    dim: string,
    rows: LiftRow<K>[],
    cur: K | null,
    fmt: (k: K) => string,
  ) => {
    if (cur == null) return
    const row = rows.find(r => r.key === cur)
    if (!row) return
    const lift = row.lift_pct
    const best = [...rows].filter(r => r.n >= 2).sort((a, b) => b.lift_pct - a.lift_pct)[0]
    if (lift >= 10) {
      good.push({ tone: "good", label: dim.toUpperCase(), text: `"${fmt(cur)}" is a proven winner (+${lift.toFixed(0)}% boost).`, meta: `based on ${row.n} past events` })
    } else if (lift <= -10) {
      bad.push({ tone: "bad", label: dim.toUpperCase(), text: `"${fmt(cur)}" usually hurts engagement by ${Math.abs(lift).toFixed(0)}%.`, meta: `based on ${row.n} past events` })
      if (best && best.key !== cur) {
        suggestions.push({
          tone: "good", label: dim.toUpperCase(),
          text: `Try "${fmt(best.key)}" instead — usually boosts engagement by ${best.lift_pct.toFixed(0)}%.`,
          meta: `based on ${best.n} past events`,
        })
      }
    }
  }

  analyze("Category", lifts.category, dims.category, k => k)
  analyze("Time of day", lifts.daypart, dims.daypart, k => k.toUpperCase())
  analyze("Day of Week", lifts.dow, dims.dow, k => DOW_FULL[k])
  analyze("Free Food", lifts.free_food, dims.free_food, k => k.toUpperCase())
  analyze("Format", lifts.virtual, dims.virtual, k => k.toUpperCase())

  // Suggest filling empty dims if the top option has meaningful positive lift
  const offerFill = <K extends string | number>(
    dim: string,
    rows: LiftRow<K>[],
    cur: K | null,
    fmt: (k: K) => string,
  ) => {
    if (cur != null) return
    const best = [...rows].filter(r => r.n >= 2).sort((a, b) => b.lift_pct - a.lift_pct)[0]
    if (best && best.lift_pct >= 10) {
      suggestions.push({
        tone: "good", label: dim.toUpperCase(),
        text: `Add it: "${fmt(best.key)}" gives a +${best.lift_pct.toFixed(0)}% boost.`,
        meta: `based on ${best.n} past events`,
      })
    }
  }
  offerFill("Free Food", lifts.free_food, dims.free_food, k => k.toUpperCase())
  offerFill("Time of day", lifts.daypart, dims.daypart, k => k.toUpperCase())
  offerFill("Day of Week", lifts.dow, dims.dow, k => DOW_FULL[k])

  return { projected, projected_pct_vs_baseline: pctVsBase, verdict, good, bad, suggestions }
}

export function WhatIfTab({ token }: { token: string | null }) {
  const wf = useWhatIfLifts(token)
  const [input, setInput] = useState<string>("")
  const [analyzed, setAnalyzed] = useState<string | null>(null)

  if (wf.loading && !wf.data) return <StateMsg label="Loading your club's lift tables…" />
  if (wf.err) return <StateMsg label={wf.err} tone={C.RED} />
  if (!wf.data) return <StateMsg label="No data available." />
  if (wf.data.baseline_n < 4) {
    return <StateMsg label={`Need ≥ 4 past events with engagement data to coach. Only ${wf.data.baseline_n} found in the last 365 days.`} />
  }

  const lifts = wf.data
  const activeText = analyzed ?? ""
  const dims = activeText.trim() ? extractDims(activeText, lifts) : null
  const coach = dims ? coachEvent(dims, lifts) : null
  const verdictColor = !coach ? C.MUTED : coach.verdict === "strong" ? C.GREEN : coach.verdict === "weak" ? C.RED : coach.verdict === "average" ? C.AMBER : C.MUTED
  const verdictLabel = !coach ? "—" : coach.verdict === "strong" ? "HIGH SUCCESS LIKELIHOOD" : coach.verdict === "weak" ? "AT RISK" : coach.verdict === "average" ? "AVERAGE" : "INSUFFICIENT DETAIL"

  const examples = [
    "Gaming night on Friday at 7pm with pizza",
    "Professional development workshop Tuesday afternoon, in-person, no food",
    "Virtual info session Wednesday evening",
    "GBM Thursday 6pm, free dinner, on campus",
  ]

  return (
    <div className="eden-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Panel title="Describe Your Event" meta="natural language · AI-coached">
        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          <div style={{ fontFamily: C.MONO, fontSize: 10, color: C.MUTED, lineHeight: 1.6 }}>
            Describe the event in plain English — category, day, time, free food, virtual/in-person — and I'll tell you how likely it is to succeed and what to change.
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            className="eden-textarea"
            rows={5}
            style={{ width: "100%", resize: "vertical", minHeight: 100 }}
            placeholder="e.g. Gaming night on Friday at 7pm with pizza"
            onKeyDown={e => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                if (input.trim()) setAnalyzed(input)
              }
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="eden-button"
              onClick={() => setAnalyzed(input)}
              disabled={!input.trim()}
            >
              Analyze
            </button>
            <button
              className="eden-button"
              style={{ background: "transparent", color: C.MUTED, borderColor: C.BORDER_2 }}
              onClick={() => { setInput(""); setAnalyzed(null) }}
            >
              Clear
            </button>
            <span style={{ fontFamily: C.MONO, fontSize: 9, color: C.MUTED, marginLeft: "auto" }}>Ctrl + Enter</span>
          </div>

          <div>
            <div className="eden-label" style={{ marginBottom: 6 }}>Try one of these</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {examples.map(x => (
                <button
                  key={x}
                  onClick={() => { setInput(x); setAnalyzed(x) }}
                  style={{
                    fontFamily: C.MONO, fontSize: 10, textAlign: "left",
                    color: C.CYAN, background: "transparent",
                    border: `1px dashed ${C.BORDER_2}`, borderRadius: 2,
                    padding: "6px 10px", cursor: "pointer",
                  }}
                >
                  › {x}
                </button>
              ))}
            </div>
          </div>

          {dims && (
            <div style={{ borderTop: `1px solid ${C.BORDER}`, paddingTop: 12 }}>
              <div className="eden-label" style={{ marginBottom: 6 }}>What I extracted</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(dims.matched_tokens).length === 0 && (
                  <span style={{ fontFamily: C.MONO, fontSize: 10, color: C.RED }}>
                    Couldn't identify any dimensions. Try mentioning day, time, and category.
                  </span>
                )}
                {Object.entries(dims.matched_tokens).map(([k, v]) => (
                  <span key={k} className="eden-chip" style={{ color: C.AMBER, borderColor: C.AMBER_DIM }}>
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <div>
        <Panel title="AI Verdict" meta={`club average ${lifts.baseline_mu.toFixed(2)} · based on ${lifts.baseline_n} past events`}>
          {!coach && (
            <div style={{ padding: 18, fontFamily: C.MONO, fontSize: 11, color: C.MUTED }}>
              Describe an event on the left and press Analyze.
            </div>
          )}
          {coach && (
            <>
              <div className="eden-mc-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <McStat label="Verdict" value={verdictLabel} tone={verdictColor} />
                <McStat label="Expected Engagement" value={coach.projected.toFixed(2)} tone={verdictColor} />
                <McStat
                  label="vs club average"
                  value={`${coach.projected_pct_vs_baseline >= 0 ? "+" : ""}${coach.projected_pct_vs_baseline.toFixed(1)}%`}
                  tone={verdictColor}
                />
              </div>
              <div style={{ padding: 14, display: "grid", gap: 12 }}>
                <div>
                  <div style={{ color: C.GREEN, letterSpacing: "0.14em", fontSize: 9, marginBottom: 6, fontFamily: C.MONO }}>
                    ✓ WILL LIKELY GO WELL
                  </div>
                  {coach.good.length === 0 && (
                    <div style={{ fontFamily: C.MONO, fontSize: 11, color: C.MUTED }}>
                      No strong positive signals — this event is neutral across the dimensions I identified.
                    </div>
                  )}
                  {coach.good.map((b, i) => <InsightBullet key={i} {...b} />)}
                </div>

                <div>
                  <div style={{ color: C.RED, letterSpacing: "0.14em", fontSize: 9, marginBottom: 6, fontFamily: C.MONO }}>
                    ⚠ MAY GO WRONG
                  </div>
                  {coach.bad.length === 0 && (
                    <div style={{ fontFamily: C.MONO, fontSize: 11, color: C.MUTED }}>
                      No red flags in the combination you described.
                    </div>
                  )}
                  {coach.bad.map((b, i) => <InsightBullet key={i} {...b} />)}
                </div>

                <div>
                  <div style={{ color: C.AMBER, letterSpacing: "0.14em", fontSize: 9, marginBottom: 6, fontFamily: C.MONO }}>
                    → HOW TO IMPROVE
                  </div>
                  {coach.suggestions.length === 0 && (
                    <div style={{ fontFamily: C.MONO, fontSize: 11, color: C.MUTED }}>
                      This setup is already well-aligned with your club's best-performing mix.
                    </div>
                  )}
                  {coach.suggestions.map((b, i) => <InsightBullet key={i} {...b} />)}
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ATTENDANCE TAB                                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝
type AttendanceEvent = {
  event_id: number
  event_name: string
  date: string
  start_time: string | null
  category: string | null
  has_free_food: boolean
  virtual: boolean
  predicted_engagement: number | null
  engagement_score: number | null
  rsvps: number
  is_past: boolean
  attendance: number | null
  notes: string | null
  entered_at: string | null
}
type AttendanceListResponse = {
  club: { club_id: number; name: string; abbr: string }
  events: AttendanceEvent[]
  baseline_mu: number
  stats: {
    total_past_events: number
    events_with_attendance: number
    capture_pct: number
    avg_attendance: number
  }
}

export function AttendanceTab({ token, clubId }: { token: string | null; clubId: number | null }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const url = token && clubId != null ? `${API}/api/eden/attendance?_=${refreshKey}` : null
  const att = useFetchJson<AttendanceListResponse>(url, token)
  const wf = useWhatIfLifts(token)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<"all" | "missing" | "past" | "upcoming">("missing")
  const [showCreate, setShowCreate] = useState(false)

  const events = att.data?.events ?? []
  const filtered = useMemo(() => {
    if (filter === "all") return events
    if (filter === "past") return events.filter(e => e.is_past)
    if (filter === "upcoming") return events.filter(e => !e.is_past)
    return events.filter(e => e.is_past && e.attendance == null)
  }, [events, filter])

  const selected = useMemo(
    () => events.find(e => e.event_id === selectedId) ?? filtered[0] ?? null,
    [events, filtered, selectedId]
  )

  if (att.loading && !att.data) return <StateMsg label="Loading attendance roster…" />
  if (att.err) return <StateMsg label={att.err} tone={C.RED} />
  if (!att.data) return <StateMsg label="No data available." />

  return (
    <div className="eden-grid" style={{ gridTemplateColumns: "360px 1fr", gap: 10 }}>
      <div>
        <Panel
          title="Event Roster"
          meta={`${att.data.stats.events_with_attendance}/${att.data.stats.total_past_events} captured (${att.data.stats.capture_pct.toFixed(0)}%)`}
        >
          <div style={{ padding: "8px 12px", display: "flex", gap: 6, borderBottom: `1px solid ${C.BORDER}`, background: C.PANEL_2, flexWrap: "wrap" }}>
            {(["missing", "past", "upcoming", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontFamily: C.MONO,
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  background: filter === f ? "rgba(247,185,85,0.16)" : "transparent",
                  border: `1px solid ${filter === f ? C.AMBER : C.BORDER}`,
                  color: filter === f ? C.AMBER : C.MUTED,
                  borderRadius: 2,
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setShowCreate(s => !s)}
              style={{
                fontFamily: C.MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "3px 8px", cursor: "pointer", borderRadius: 2,
                background: showCreate ? "rgba(78,201,224,0.16)" : "rgba(247,185,85,0.16)",
                border: `1px solid ${showCreate ? C.CYAN : C.AMBER}`,
                color: showCreate ? C.CYAN : C.AMBER,
              }}
            >
              {showCreate ? "✕ Close" : "+ Upload"}
            </button>
          </div>
          <div className="eden-picker">
            <table className="eden-table">
              <tbody>
                {filtered.length === 0 && (
                  <tr><td className="eden-dim" style={{ padding: 14 }}>No events match this filter.</td></tr>
                )}
                {filtered.map(e => {
                  const active = selected?.event_id === e.event_id
                  const tone = e.attendance != null ? C.GREEN : e.is_past ? C.RED : C.MUTED
                  return (
                    <tr
                      key={e.event_id}
                      className={active ? "selected" : ""}
                      onClick={() => setSelectedId(e.event_id)}
                    >
                      <td>
                        <div style={{ color: C.FG }}>{e.event_name}</div>
                        <div className="eden-dim" style={{ fontSize: 9 }}>
                          {e.date}{e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""} · {e.category ?? "—"}
                        </div>
                      </td>
                      <td className="eden-r" style={{ width: 80, color: tone }}>
                        {e.attendance != null ? `${e.attendance}` : (e.is_past ? "—" : "upcoming")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div>
        {showCreate && (
          <>
            <CreateEventForm
              token={token}
              onCreated={() => { setRefreshKey(k => k + 1); setShowCreate(false) }}
              categories={wf.data?.category.map(r => r.key) ?? []}
            />
            <div style={{ height: 10 }} />
          </>
        )}

        {selected ? (
          <AttendanceForm
            key={selected.event_id}
            event={selected}
            token={token}
            clubName={att.data.club.name}
            onSaved={() => setRefreshKey(k => k + 1)}
          />
        ) : (
          <StateMsg label="Pick an event from the roster to record attendance." />
        )}

        {selected && selected.is_past && wf.data && wf.data.baseline_n >= 4 && (
          <>
            <div style={{ height: 10 }} />
            <RetroInsightsPanel event={selected} lifts={wf.data} />
          </>
        )}

        <div style={{ height: 10 }} />

        <Panel title="Capture Stats" meta="why this matters">
          <div className="eden-mc-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <McStat label="Past events" value={String(att.data.stats.total_past_events)} />
            <McStat label="Captured" value={String(att.data.stats.events_with_attendance)} tone={C.GREEN} />
            <McStat
              label="Capture rate"
              value={`${att.data.stats.capture_pct.toFixed(0)}%`}
              tone={att.data.stats.capture_pct >= 70 ? C.GREEN : C.AMBER}
            />
            <McStat
              label="Avg attendance"
              value={att.data.stats.avg_attendance > 0 ? att.data.stats.avg_attendance.toFixed(0) : "—"}
              tone={C.AMBER}
            />
          </div>
          <div style={{ padding: 14, fontFamily: C.MONO, fontSize: 11, color: C.FG_DIM, lineHeight: 1.7 }}>
            <div>› Attendance is the ground truth that anchors every other module.</div>
            <div>› Forecast accuracy improves as you capture more headcounts.</div>
            <div>› What-if lift tables become trustworthy past 10–15 captured events.</div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ── Create-event form ─────────────────────────────────────────────────────
function CreateEventForm({
  token, onCreated, categories,
}: {
  token: string | null
  onCreated: () => void
  categories: string[]
}) {
  const [eventName, setEventName] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [category, setCategory] = useState("")
  const [customCategory, setCustomCategory] = useState("")
  const [hasFreeFood, setHasFreeFood] = useState(false)
  const [virtual, setVirtual] = useState(false)
  const [location, setLocation] = useState("")
  const [room, setRoom] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token) return
    if (!eventName.trim()) { setMsg({ ok: false, text: "Event name is required." }); return }
    if (!date) { setMsg({ ok: false, text: "Date is required." }); return }
    setSaving(true); setMsg(null)
    try {
      const r = await fetch(`${API}/api/eden/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          event_name: eventName.trim(),
          date,
          start_time: startTime || undefined,
          end_time: endTime || undefined,
          event_category: (category === "__custom__" ? customCategory : category) || undefined,
          has_free_food: hasFreeFood,
          virtual,
          campus_location: virtual ? undefined : (location.trim() || undefined),
          event_room: virtual ? undefined : (room.trim() || undefined),
        }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${r.status}`)
      }
      setMsg({ ok: true, text: "Event created." })
      setEventName(""); setDate(""); setStartTime(""); setEndTime("")
      setCategory(""); setCustomCategory("")
      setHasFreeFood(false); setVirtual(false); setLocation(""); setRoom("")
      onCreated()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Upload Event" meta="create a new event for your club">
      <form onSubmit={submit} style={{ padding: 14, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <FormField label="Event Name *" span={2}>
          <input className="eden-input" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Fall Kickoff GBM" style={{ width: "100%" }} />
        </FormField>

        <FormField label="Date *">
          <input className="eden-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%" }} />
        </FormField>
        <FormField label="Category">
          <select className="eden-select" value={category} onChange={e => setCategory(e.target.value)} style={{ width: "100%" }}>
            <option value="">— none —</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__custom__">+ Custom…</option>
          </select>
          {category === "__custom__" && (
            <input
              className="eden-input" value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              placeholder="new category name"
              style={{ width: "100%", marginTop: 6 }}
            />
          )}
        </FormField>

        <FormField label="Start Time">
          <input className="eden-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ width: "100%" }} />
        </FormField>
        <FormField label="End Time">
          <input className="eden-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ width: "100%" }} />
        </FormField>

        <FormField label="Free Food">
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.FG_DIM, fontFamily: C.MONO, fontSize: 11 }}>
            <input type="checkbox" checked={hasFreeFood} onChange={e => setHasFreeFood(e.target.checked)} />
            Yes, free food will be provided
          </label>
        </FormField>
        <FormField label="Format">
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.FG_DIM, fontFamily: C.MONO, fontSize: 11 }}>
            <input type="checkbox" checked={virtual} onChange={e => setVirtual(e.target.checked)} />
            Virtual / online
          </label>
        </FormField>

        {!virtual && (
          <>
            <FormField label="Campus Location">
              <input className="eden-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Campus Center" style={{ width: "100%" }} />
            </FormField>
            <FormField label="Room">
              <input className="eden-input" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. CC 225" style={{ width: "100%" }} />
            </FormField>
          </>
        )}

        <div style={{ gridColumn: "1 / span 2", display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <button type="submit" className="eden-button" disabled={saving || !token}>
            {saving ? "Creating…" : "Create Event"}
          </button>
          {msg && (
            <span style={{
              fontFamily: C.MONO, fontSize: 10,
              color: msg.ok ? C.GREEN : C.RED,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              {msg.text}
            </span>
          )}
        </div>
      </form>
    </Panel>
  )
}

function FormField({ label, span = 1, children }: { label: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: span === 2 ? "1 / span 2" : undefined }}>
      <div className="eden-label" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

// ── Retrospective insights for past events ───────────────────────────────
function RetroInsightsPanel({ event, lifts }: { event: AttendanceEvent; lifts: WhatIfResponse }) {
  const good: Insight[] = []
  const bad: Insight[] = []

  const current = {
    category: event.category,
    daypart: deriveDaypart(event.start_time),
    dow: deriveDow(event.date),
    free_food: event.has_free_food ? "yes" : "no",
    virtual: event.virtual ? "virtual" : "in-person",
  }

  // Actual vs predicted engagement
  if (event.engagement_score != null && event.predicted_engagement != null && event.predicted_engagement > 0) {
    const ratio = event.engagement_score / event.predicted_engagement
    if (ratio >= 1.15) {
      good.push({
        tone: "good", label: "BEAT EXPECTATIONS",
        text: `Engagement hit ${event.engagement_score.toFixed(2)} — ${((ratio - 1) * 100).toFixed(0)}% above the ${event.predicted_engagement.toFixed(2)} we expected.`,
      })
    } else if (ratio <= 0.85) {
      bad.push({
        tone: "bad", label: "MISSED EXPECTATIONS",
        text: `Engagement was ${event.engagement_score.toFixed(2)} — ${((1 - ratio) * 100).toFixed(0)}% below the ${event.predicted_engagement.toFixed(2)} we expected.`,
      })
    }
  } else if (event.engagement_score == null && event.is_past) {
    bad.push({
      tone: "neutral", label: "MISSING DATA",
      text: "No IG engagement data captured for this event — post a recap to unlock retro analysis.",
    })
  }

  // vs baseline
  if (event.engagement_score != null) {
    const pct = lifts.baseline_mu > 0 ? (event.engagement_score / lifts.baseline_mu - 1) * 100 : 0
    if (pct >= 15) {
      good.push({
        tone: "good", label: "ABOVE CLUB AVERAGE",
        text: `Engagement ran ${pct.toFixed(0)}% above your 180-day club average of ${lifts.baseline_mu.toFixed(2)}.`,
      })
    } else if (pct <= -15) {
      bad.push({
        tone: "bad", label: "BELOW CLUB AVERAGE",
        text: `Engagement ran ${Math.abs(pct).toFixed(0)}% below your 180-day club average of ${lifts.baseline_mu.toFixed(2)}.`,
      })
    }
  }

  // Attribute wins/losses via lift table
  const reviewDim = <K extends string | number>(
    dim: string, rows: LiftRow<K>[], cur: K | null, fmt: (k: K) => string,
  ) => {
    if (cur == null) return
    const row = rows.find(r => r.key === cur)
    if (!row) return
    if (row.lift_pct >= 10) {
      good.push({ tone: "good", label: dim.toUpperCase(), text: `"${fmt(cur)}" usually boosts engagement by ${row.lift_pct.toFixed(0)}% — this helped.`, meta: `based on ${row.n} past events` })
    } else if (row.lift_pct <= -10) {
      bad.push({ tone: "bad", label: dim.toUpperCase(), text: `"${fmt(cur)}" usually hurts engagement by ${Math.abs(row.lift_pct).toFixed(0)}% — this worked against the event.`, meta: `based on ${row.n} past events` })
    }
  }
  reviewDim("Category", lifts.category, current.category, k => k)
  reviewDim("Time of day", lifts.daypart, current.daypart, k => k.toUpperCase())
  reviewDim("Day of Week", lifts.dow, current.dow, k => DOW_FULL[k])
  reviewDim("Free Food", lifts.free_food, current.free_food, k => k.toUpperCase())
  reviewDim("Format", lifts.virtual, current.virtual, k => k.toUpperCase())

  // RSVP → attendance show-up rate
  if (event.rsvps > 0 && event.attendance != null) {
    const ratio = event.attendance / event.rsvps
    if (ratio >= 0.7) {
      good.push({
        tone: "good", label: "SHOW-UP",
        text: `${(ratio * 100).toFixed(0)}% of RSVPs actually showed (${event.attendance}/${event.rsvps}) — strong conversion.`,
      })
    } else if (ratio <= 0.4) {
      bad.push({
        tone: "bad", label: "SHOW-UP",
        text: `Only ${(ratio * 100).toFixed(0)}% of RSVPs showed (${event.attendance}/${event.rsvps}) — day-of reminders may help next time.`,
      })
    }
  }

  return (
    <Panel title="Retro · What Went Well / Wrong" meta="based on lift tables + actual outcome">
      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        <div>
          <div style={{ color: C.GREEN, letterSpacing: "0.14em", fontSize: 9, marginBottom: 6, fontFamily: C.MONO }}>
            ✓ WHAT WENT WELL
          </div>
          {good.length === 0 && <div style={{ fontFamily: C.MONO, fontSize: 11, color: C.MUTED }}>No standout positives detected.</div>}
          {good.map((b, i) => <InsightBullet key={i} {...b} />)}
        </div>
        <div>
          <div style={{ color: C.RED, letterSpacing: "0.14em", fontSize: 9, marginBottom: 6, fontFamily: C.MONO }}>
            ⚠ WHAT WENT WRONG
          </div>
          {bad.length === 0 && <div style={{ fontFamily: C.MONO, fontSize: 11, color: C.MUTED }}>No clear issues — this event performed as expected.</div>}
          {bad.map((b, i) => <InsightBullet key={i} {...b} />)}
        </div>
        {event.engagement_score == null && event.attendance == null && (
          <div style={{ fontFamily: C.MONO, fontSize: 10, color: C.MUTED, borderTop: `1px solid ${C.BORDER}`, paddingTop: 8 }}>
            Record attendance above to enable show-up analysis.
          </div>
        )}
      </div>
    </Panel>
  )
}

// ── Attendance form (existing) ────────────────────────────────────────────
function AttendanceForm({
  event, token, clubName, onSaved,
}: {
  event: AttendanceEvent
  token: string | null
  clubName: string
  onSaved: () => void
}) {
  const [headcount, setHeadcount] = useState<string>(event.attendance != null ? String(event.attendance) : "")
  const [notes, setNotes] = useState<string>(event.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token) return
    const n = Number.parseInt(headcount, 10)
    if (!Number.isFinite(n) || n < 0) {
      setMsg({ ok: false, text: "Headcount must be a non-negative integer." })
      return
    }
    setSaving(true); setMsg(null)
    try {
      const r = await fetch(`${API}/api/eden/events/${event.event_id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ headcount: n, notes: notes.trim() || undefined }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${r.status}`)
      }
      setMsg({ ok: true, text: "Saved." })
      onSaved()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  const ratio = event.rsvps > 0 && event.attendance != null ? (event.attendance / event.rsvps) * 100 : null

  return (
    <Panel
      title={event.event_name}
      meta={`${clubName} · ${event.date}${event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""} · event #${event.event_id}`}
    >
      <div className="eden-mc-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <McStat label="Status" value={event.is_past ? "PAST" : "UPCOMING"} tone={event.is_past ? C.AMBER : C.CYAN} />
        <McStat label="RSVPs" value={String(event.rsvps)} />
        <McStat
          label="Recorded"
          value={event.attendance != null ? String(event.attendance) : "—"}
          tone={event.attendance != null ? C.GREEN : C.MUTED}
        />
        <McStat
          label="Show-up rate"
          value={ratio != null ? `${ratio.toFixed(0)}%` : "—"}
          tone={ratio != null && ratio >= 60 ? C.GREEN : ratio != null ? C.AMBER : C.MUTED}
        />
      </div>

      <form onSubmit={submit} style={{ padding: 14, display: "grid", gap: 12 }}>
        <div>
          <label className="eden-label" style={{ display: "block", marginBottom: 6 }}>
            Headcount {event.is_past ? "" : "(early estimate)"}
          </label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={headcount}
            onChange={e => setHeadcount(e.target.value)}
            className="eden-input"
            style={{ width: 160 }}
            placeholder="0"
          />
        </div>
        <div>
          <label className="eden-label" style={{ display: "block", marginBottom: 6 }}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="eden-textarea"
            rows={3}
            style={{ width: "100%", resize: "vertical" }}
            placeholder="conditions, weather, conflicts, vibe…"
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="submit"
            className="eden-button"
            disabled={saving || !token || !headcount.trim()}
          >
            {saving ? "Saving…" : event.attendance != null ? "Update" : "Record"}
          </button>
          {msg && (
            <span
              style={{
                fontFamily: C.MONO,
                fontSize: 10,
                color: msg.ok ? C.GREEN : C.RED,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {msg.text}
            </span>
          )}
          {event.entered_at && (
            <span style={{ fontFamily: C.MONO, fontSize: 9, color: C.MUTED, marginLeft: "auto" }}>
              last saved {new Date(event.entered_at).toLocaleString()}
            </span>
          )}
        </div>
      </form>
    </Panel>
  )
}
