import { Router, Response } from "express"
import { db, edenDb } from "../config/postgres.js"
import { requireAuth, AuthRequest } from "../middlewear/auth.js"

const router = Router()

const EVENTS_API = process.env.EVENTS_API_URL ?? "http://localhost:8000"

const ABBR: Record<string, string> = {
  "Institute of Electrical and Electronics Engineers": "IEEE",
  "Association for Computing Machinery": "ACM",
  "Society of Hispanic Professional Engineers": "SHPE",
  "Society of Women Engineers": "SWE",
  "National Society of Black Engineers": "NSBE",
  "American Society of Civil Engineers": "ASCE",
  "American Society of Mechanical Engineers": "ASME",
  "Google Developer Student Club": "GDSC",
  "Biomedical Engineering Society": "BMES",
  "Robotics Club": "Robotics",
  "Hispanic Association of Computing College Students": "HACCS",
}
function abbrFor(name: string): string {
  return ABBR[name] ?? name.split(/\s+/).map(w => w[0]).filter(Boolean).join("").slice(0, 5).toUpperCase()
}

async function requireEboardClub(req: AuthRequest, res: Response): Promise<number | null> {
  const u = await db.query(
    "SELECT is_eboard, eboard_club_id FROM users WHERE id = $1",
    [req.userId]
  )
  if (u.rows.length === 0 || !u.rows[0].is_eboard) {
    res.status(403).json({ error: "E-board access required" })
    return null
  }
  if (u.rows[0].eboard_club_id == null) {
    res.status(400).json({ error: "No club bound to this user" })
    return null
  }
  return u.rows[0].eboard_club_id as number
}

const dateStr = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : (d as string | null))

// POST /api/eden/dev-grant — dev-only self-grant of e-board access.
router.post("/dev-grant", requireAuth, async (req: AuthRequest, res: Response) => {
  const { club_handle, club_id } = req.body ?? {}
  let resolvedClubId: number | null =
    Number.isFinite(Number(club_id)) ? Number(club_id) : null

  if (resolvedClubId == null && typeof club_handle === "string" && club_handle.trim()) {
    try {
      const resp = await fetch(`${EVENTS_API}/clubs`)
      if (!resp.ok) { res.status(502).json({ error: `EDEN /clubs returned ${resp.status}` }); return }
      const clubs = await resp.json() as Array<{ club_id: number; instagram_handle: string | null; name: string }>
      const handle = club_handle.trim().toLowerCase().replace(/^@/, "")
      const match = clubs.find(c => (c.instagram_handle ?? "").toLowerCase().replace(/^@/, "") === handle)
      if (!match) { res.status(404).json({ error: `No club with instagram handle "${club_handle}"` }); return }
      resolvedClubId = match.club_id
    } catch (err) {
      console.error("eden/dev-grant lookup error:", err)
      res.status(502).json({ error: "Failed to reach EDEN backend" })
      return
    }
  }

  if (resolvedClubId == null) { res.status(400).json({ error: "Provide club_handle or club_id" }); return }

  try {
    const result = await db.query(
      `UPDATE users SET is_eboard = TRUE, eboard_club_id = $1
       WHERE id = $2 RETURNING id, is_eboard, eboard_club_id`,
      [resolvedClubId, req.userId]
    )
    if (result.rows.length === 0) { res.status(404).json({ error: "User not found" }); return }
    res.json(result.rows[0])
  } catch (err) {
    console.error("eden/dev-grant update error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/eden/status — returns whether current user is e-board + which club they cover
router.get("/status", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      "SELECT is_eboard, eboard_club_id FROM users WHERE id = $1",
      [req.userId]
    )
    if (result.rows.length === 0) { res.status(404).json({ error: "User not found" }); return }
    res.json({
      is_eboard: Boolean(result.rows[0].is_eboard),
      eboard_club_id: result.rows[0].eboard_club_id ?? null,
    })
  } catch (err) {
    console.error("eden/status error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/eden/events — create a new event for the user's club.
// Proxies to the FastAPI /events/community endpoint so the new row lands in
// the shared events table AND gets the companion event_posts row required by
// the /events feed (community events show up on the public Events page too).
router.post("/events", requireAuth, async (req: AuthRequest, res: Response) => {
  const clubId = await requireEboardClub(req, res)
  if (clubId == null) return

  const {
    event_name, date, start_time, end_time, event_category,
    has_free_food, virtual, campus_location, event_room, event_link, description,
    is_open_to_public,
  } = req.body ?? {}

  if (typeof event_name !== "string" || !event_name.trim()) {
    res.status(400).json({ error: "event_name is required" }); return
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date (YYYY-MM-DD) is required" }); return
  }
  if (typeof start_time !== "string" || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(start_time.trim())) {
    res.status(400).json({ error: "start_time (HH:MM) is required" }); return
  }

  const clubRow = await edenDb.query("SELECT name FROM clubs WHERE club_id = $1", [clubId])
  if (clubRow.rows.length === 0) {
    res.status(404).json({ error: "Club not found in EDEN backend" }); return
  }
  const clubName: string = clubRow.rows[0].name

  const payload = {
    club_name: clubName,
    event_name: event_name.trim(),
    event_category: typeof event_category === "string" && event_category.trim()
      ? event_category.trim().toLowerCase()
      : "general meeting",
    date,
    start_time: start_time.trim(),
    end_time: typeof end_time === "string" && end_time.trim() ? end_time.trim() : null,
    campus_location: typeof campus_location === "string" && campus_location.trim() ? campus_location.trim() : null,
    event_room: typeof event_room === "string" && event_room.trim() ? event_room.trim() : null,
    virtual: Boolean(virtual),
    has_free_food: Boolean(has_free_food),
    is_open_to_public: is_open_to_public !== false,
    event_link: typeof event_link === "string" && event_link.trim() ? event_link.trim() : null,
    description: typeof description === "string" && description.trim() ? description.trim() : null,
  }

  try {
    const upstream = await fetch(`${EVENTS_API}/events/community`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      const detail = (body && typeof body === "object" && "detail" in body)
        ? (body as { detail?: string }).detail
        : null
      res.status(upstream.status).json({ error: detail ?? `Upstream ${upstream.status}` })
      return
    }
    res.status(201).json(body)
  } catch (err) {
    console.error("eden/events POST proxy error:", err)
    res.status(502).json({ error: "Could not reach EDEN backend" })
  }
})

// POST /api/eden/events/:id/attendance — record/overwrite attendance for an event in the user's club
router.post("/events/:id/attendance", requireAuth, async (req: AuthRequest, res: Response) => {
  const eventId = Number.parseInt(req.params.id, 10)
  if (!Number.isFinite(eventId)) { res.status(400).json({ error: "Invalid event id" }); return }

  const { headcount, notes } = req.body ?? {}
  const count = Number.parseInt(String(headcount), 10)
  if (!Number.isFinite(count) || count < 0) {
    res.status(400).json({ error: "Non-negative headcount is required" })
    return
  }

  const clubId = await requireEboardClub(req, res)
  if (clubId == null) return

  try {
    const ev = await edenDb.query("SELECT club_id FROM events WHERE event_id = $1", [eventId])
    if (ev.rows.length === 0) { res.status(404).json({ error: "Event not found" }); return }
    if (ev.rows[0].club_id !== clubId) {
      res.status(403).json({ error: "You can only record attendance for your own club's events" })
      return
    }

    const notesValue = typeof notes === "string" && notes.trim() ? notes.trim() : null

    await db.query(
      `INSERT INTO event_attendance (event_id, club_id, headcount, entered_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id) DO UPDATE SET
         headcount = EXCLUDED.headcount,
         entered_by = EXCLUDED.entered_by,
         entered_at = NOW(),
         notes = EXCLUDED.notes`,
      [eventId, clubId, count, req.userId, notesValue]
    )

    const saved = await db.query(
      "SELECT event_id, club_id, headcount, entered_by, entered_at, notes FROM event_attendance WHERE event_id = $1",
      [eventId]
    )
    res.status(201).json(saved.rows[0])
  } catch (err) {
    console.error("eden/attendance POST error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/eden/events/:id/attendance
router.get("/events/:id/attendance", requireAuth, async (req: AuthRequest, res: Response) => {
  const eventId = Number.parseInt(req.params.id, 10)
  if (!Number.isFinite(eventId)) { res.status(400).json({ error: "Invalid event id" }); return }

  const clubId = await requireEboardClub(req, res)
  if (clubId == null) return

  try {
    const row = await db.query(
      "SELECT event_id, club_id, headcount, entered_by, entered_at, notes FROM event_attendance WHERE event_id = $1",
      [eventId]
    )
    if (row.rows.length === 0) { res.json(null); return }
    if (row.rows[0].club_id !== clubId) {
      res.status(403).json({ error: "You can only view attendance for your own club" })
      return
    }
    res.json(row.rows[0])
  } catch (err) {
    console.error("eden/attendance GET error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/eden/dashboard — F1 OVERVIEW for the user's club only
router.get("/dashboard", requireAuth, async (req: AuthRequest, res: Response) => {
  const clubId = await requireEboardClub(req, res)
  if (clubId == null) return

  try {
    const clubRow = await edenDb.query("SELECT club_id, name FROM clubs WHERE club_id = $1", [clubId])
    const clubName: string = clubRow.rows[0]?.name ?? `Club ${clubId}`

    // Past + upcoming totals for this club
    const totalsQ = await edenDb.query(`
      SELECT COUNT(*) FILTER (WHERE date <= CURRENT_DATE)::int AS past,
             COUNT(*) FILTER (WHERE date >  CURRENT_DATE)::int AS upcoming
      FROM events WHERE club_id = $1 AND date IS NOT NULL
    `, [clubId])
    const past = Number(totalsQ.rows[0]?.past ?? 0)
    const upcoming = Number(totalsQ.rows[0]?.upcoming ?? 0)

    // Engagement: this club's daily mean engagement over 90d
    const engQ = await edenDb.query(`
      SELECT e.date::date AS day,
             AVG(COALESCE(p.engagement_score, 0))::float AS mu
      FROM events e
      LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '90 days'
        AND e.date <= CURRENT_DATE
      GROUP BY day ORDER BY day
    `, [clubId])
    const engagement_90d = engQ.rows.map(r => ({ date: dateStr(r.day), value: Number(r.mu) || 0 }))

    // Mean & MoM change for engagement (30d vs prior 30d)
    const engRecentQ = await edenDb.query(`
      SELECT AVG(COALESCE(p.engagement_score, 0))::float AS mu
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '30 days' AND e.date <= CURRENT_DATE
    `, [clubId])
    const engPriorQ = await edenDb.query(`
      SELECT AVG(COALESCE(p.engagement_score, 0))::float AS mu
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '60 days' AND e.date <= CURRENT_DATE - INTERVAL '30 days'
    `, [clubId])
    const muRecent = Number(engRecentQ.rows[0]?.mu ?? 0)
    const muPrior = Number(engPriorQ.rows[0]?.mu ?? 0)
    const engMomPct = muPrior > 0 ? ((muRecent - muPrior) / muPrior) * 100 : 0

    // Upcoming RSVPs for this club + 7d delta
    const rsvpNowQ = await edenDb.query(`
      SELECT COUNT(*)::int AS n
      FROM event_rsvps r JOIN events e ON e.event_id = r.event_id
      WHERE e.club_id = $1 AND r.status = 'going' AND e.date >= CURRENT_DATE
    `, [clubId])
    const rsvpAgoQ = await edenDb.query(`
      SELECT COUNT(*)::int AS n
      FROM event_rsvps r JOIN events e ON e.event_id = r.event_id
      WHERE e.club_id = $1 AND r.status = 'going' AND e.date >= CURRENT_DATE
        AND r.rsvp_time < NOW() - INTERVAL '7 days'
    `, [clubId])
    const upcomingRsvps = Number(rsvpNowQ.rows[0]?.n ?? 0)
    const rsvpDelta7d = upcomingRsvps - Number(rsvpAgoQ.rows[0]?.n ?? 0)

    // Free-food lift for this club (180d)
    const foodQ = await edenDb.query(`
      SELECT e.has_free_food, AVG(COALESCE(p.engagement_score, 0))::float AS avg
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '180 days' AND e.date <= CURRENT_DATE
      GROUP BY e.has_free_food
    `, [clubId])
    const foodYes = Number(foodQ.rows.find(r => r.has_free_food)?.avg ?? 0)
    const foodNo = Number(foodQ.rows.find(r => !r.has_free_food)?.avg ?? 0)
    const foodLift = foodNo > 0 ? ((foodYes - foodNo) / foodNo) * 100 : 0

    // Attendance capture rate + a 90d day-level attendance series
    const attListQ = await edenDb.query(`
      SELECT event_id, date::date AS day FROM events
      WHERE club_id = $1 AND date IS NOT NULL AND date <= CURRENT_DATE
    `, [clubId])
    const pastIds = attListQ.rows.map(r => r.event_id)
    const eventDayById = new Map<number, string>(
      attListQ.rows.map(r => [r.event_id as number, dateStr(r.day) ?? ""])
    )
    let attendanceCount = 0
    let avgAttendance = 0
    let attendanceByEvent: Array<{ event_id: number; headcount: number }> = []
    if (pastIds.length > 0) {
      const a = await db.query(
        "SELECT COUNT(*)::int AS n, AVG(headcount)::float AS mu FROM event_attendance WHERE event_id = ANY($1::int[])",
        [pastIds]
      )
      attendanceCount = Number(a.rows[0]?.n ?? 0)
      avgAttendance = Number(a.rows[0]?.mu ?? 0)

      const perEvent = await db.query(
        "SELECT event_id, headcount FROM event_attendance WHERE event_id = ANY($1::int[])",
        [pastIds]
      )
      attendanceByEvent = perEvent.rows.map(r => ({
        event_id: Number(r.event_id),
        headcount: Number(r.headcount) || 0,
      }))
    }
    const captureRatePct = pastIds.length > 0 ? (attendanceCount / pastIds.length) * 100 : 0

    // Build a daily-average attendance series over the last 90 days.
    const today = new Date()
    const todayKey = today.toISOString().slice(0, 10)
    const ninetyAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 90)
    const bucket = new Map<string, { sum: number; n: number }>()
    for (const a of attendanceByEvent) {
      const day = eventDayById.get(a.event_id)
      if (!day) continue
      if (day < ninetyAgo.toISOString().slice(0, 10) || day > todayKey) continue
      const slot = bucket.get(day) ?? { sum: 0, n: 0 }
      slot.sum += a.headcount
      slot.n += 1
      bucket.set(day, slot)
    }
    const attendance_90d = Array.from(bucket.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([day, v]) => ({ date: day, value: v.n > 0 ? v.sum / v.n : 0 }))

    // Anomalies — z-score of each past event's engagement vs this club's 90d mean/std
    const anomQ = await edenDb.query(`
      WITH base AS (
        SELECT AVG(COALESCE(p.engagement_score, 0))::float AS mu,
               STDDEV_POP(COALESCE(p.engagement_score, 0))::float AS sigma
        FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
        WHERE e.club_id = $1
          AND e.date > CURRENT_DATE - INTERVAL '90 days' AND e.date <= CURRENT_DATE
      ),
      recent AS (
        SELECT e.event_id, e.event_name, e.date,
               AVG(COALESCE(p.engagement_score, 0))::float AS score
        FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
        WHERE e.club_id = $1
          AND e.date > CURRENT_DATE - INTERVAL '60 days' AND e.date <= CURRENT_DATE
        GROUP BY e.event_id, e.event_name, e.date
      )
      SELECT r.event_id, r.event_name, r.date, r.score, b.mu, b.sigma
      FROM recent r CROSS JOIN base b
      WHERE b.sigma > 0
    `, [clubId])
    const anomalies = anomQ.rows
      .map(r => {
        const mu = Number(r.mu) || 0
        const sigma = Number(r.sigma) || 0
        const score = Number(r.score) || 0
        const z = sigma > 0 ? (score - mu) / sigma : 0
        return {
          event_id: r.event_id,
          event_name: r.event_name,
          date: dateStr(r.date),
          type: z >= 0 ? "SURGE" : "DIP",
          z_sigma: Math.abs(z),
          score, mu,
        }
      })
      .filter(a => a.z_sigma >= 1.2)
      .sort((a, b) => b.z_sigma - a.z_sigma)
      .slice(0, 10)

    // Top past events for this club
    const topQ = await edenDb.query(`
      SELECT e.event_id, e.event_name, e.event_category, e.date,
             COALESCE(p.engagement_score, 0)::float AS score
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1 AND e.date IS NOT NULL AND e.date <= CURRENT_DATE
      ORDER BY score DESC NULLS LAST LIMIT 12
    `, [clubId])
    const top_past_events = topQ.rows.map((r, i) => ({
      rank: i + 1,
      event_id: r.event_id,
      event_name: r.event_name,
      category: r.event_category,
      score: Number(r.score) || 0,
      date: dateStr(r.date),
    }))

    // Day × hour heatmap for this club (180d)
    const hmQ = await edenDb.query(`
      SELECT EXTRACT(DOW FROM e.date)::int AS dow,
             EXTRACT(HOUR FROM e.start_time)::int AS hour,
             COUNT(*)::int AS n
      FROM events e
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '180 days' AND e.date <= CURRENT_DATE
        AND e.start_time IS NOT NULL
      GROUP BY dow, hour
    `, [clubId])
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const row of hmQ.rows) {
      const d = Number(row.dow), h = Number(row.hour)
      if (d >= 0 && d < 7 && h >= 0 && h < 24) heatmap[d][h] = Number(row.n) || 0
    }

    // Upcoming pipeline — next 5 events for this club
    const upcomingQ = await edenDb.query(`
      SELECT e.event_id, e.event_name, e.date, e.start_time, e.event_category,
             e.predicted_engagement_score,
             COALESCE((SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.event_id AND r.status = 'going'), 0)::int AS rsvps
      FROM events e
      WHERE e.club_id = $1 AND e.date >= CURRENT_DATE
      ORDER BY e.date ASC, e.start_time ASC NULLS LAST
      LIMIT 8
    `, [clubId])
    const upcoming_pipeline = upcomingQ.rows.map(r => ({
      event_id: r.event_id,
      event_name: r.event_name,
      date: dateStr(r.date),
      start_time: r.start_time,
      category: r.event_category,
      predicted: r.predicted_engagement_score != null ? Number(r.predicted_engagement_score) : null,
      rsvps: Number(r.rsvps) || 0,
    }))

    res.json({
      club: { club_id: clubId, name: clubName, abbr: abbrFor(clubName) },
      semester: { label: "SPR 2026", week: 14, of: 15 },
      kpis: {
        past_events: past,
        upcoming_events: upcoming,
        avg_engagement: muRecent,
        engagement_mom_pct: engMomPct,
        upcoming_rsvps: upcomingRsvps,
        rsvp_delta_7d: rsvpDelta7d,
        avg_attendance: avgAttendance,
        attendance_capture_pct: captureRatePct,
        free_food_lift_pct: foodLift,
        anomalies: anomalies.length,
      },
      engagement_90d,
      attendance_90d,
      anomalies,
      top_past_events,
      heatmap,
      upcoming_pipeline,
    })
  } catch (err) {
    console.error("eden/dashboard error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Box-Muller transform — produce a single sample from N(0, 1).
function sampleNormal(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Simulate `trials` engagement values from N(mean, std), clamp to ≥ 0, then
// return mean/p5/p50/p95 plus the realized standard deviation.
function simulate(mean: number, std: number, trials: number) {
  const samples = new Float64Array(trials)
  for (let i = 0; i < trials; i++) {
    samples[i] = Math.max(0, mean + std * sampleNormal())
  }
  // Sort ascending for percentiles
  const sorted = Array.from(samples).sort((a, b) => a - b)
  const pct = (p: number) => sorted[Math.min(trials - 1, Math.max(0, Math.floor((p / 100) * trials)))]
  const avg = sorted.reduce((s, x) => s + x, 0) / trials
  const variance = sorted.reduce((s, x) => s + (x - avg) * (x - avg), 0) / trials
  return {
    expected: avg,
    most_likely: pct(50),
    low_estimate: pct(5),
    high_estimate: pct(95),
    uncertainty: Math.sqrt(variance),
  }
}

// GET /api/eden/forecast — Monte Carlo forecast for the user's club's upcoming events
router.get("/forecast", requireAuth, async (req: AuthRequest, res: Response) => {
  const clubId = await requireEboardClub(req, res)
  if (clubId == null) return

  const TRIALS = 2000

  try {
    const baseQ = await edenDb.query(`
      SELECT AVG(COALESCE(p.engagement_score, 0))::float AS mu,
             STDDEV_POP(COALESCE(p.engagement_score, 0))::float AS sigma,
             COUNT(*)::int AS n
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '180 days' AND e.date <= CURRENT_DATE
    `, [clubId])
    const mu = Number(baseQ.rows[0]?.mu ?? 0)
    const sigma = Number(baseQ.rows[0]?.sigma ?? 0)
    const baseN = Number(baseQ.rows[0]?.n ?? 0)

    const rsvpBaseQ = await edenDb.query(`
      SELECT AVG(cnt)::float AS mu_rsvp FROM (
        SELECT e.event_id, COUNT(*) FILTER (WHERE r.status = 'going') AS cnt
        FROM events e LEFT JOIN event_rsvps r ON r.event_id = e.event_id
        WHERE e.club_id = $1
          AND e.date > CURRENT_DATE - INTERVAL '180 days' AND e.date <= CURRENT_DATE
        GROUP BY e.event_id
      ) s
    `, [clubId])
    const muRsvp = Number(rsvpBaseQ.rows[0]?.mu_rsvp ?? 0)

    const upQ = await edenDb.query(`
      SELECT e.event_id, e.event_name, e.event_category, e.date, e.start_time,
             e.has_free_food, e.virtual, e.predicted_engagement_score,
             COALESCE((SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.event_id AND r.status = 'going'), 0)::int AS rsvps
      FROM events e
      WHERE e.club_id = $1 AND e.date >= CURRENT_DATE
      ORDER BY e.date ASC, e.start_time ASC NULLS LAST
      LIMIT 60
    `, [clubId])

    const events = upQ.rows.map(r => {
      const predBase = r.predicted_engagement_score != null ? Number(r.predicted_engagement_score) : mu
      const foodBump = r.has_free_food ? 1.08 : 1.0
      const center = predBase * foodBump
      const sim = simulate(center, sigma, TRIALS)

      const rsvpPace = muRsvp > 0 ? Number(r.rsvps) / muRsvp : 0
      const risk =
        (mu > 0 && sim.expected < mu * 0.6) ||
        (muRsvp > 0 && rsvpPace < 0.3)

      return {
        event_id: r.event_id,
        event_name: r.event_name,
        category: r.event_category,
        date: dateStr(r.date),
        start_time: r.start_time,
        current_rsvps: Number(r.rsvps) || 0,
        baseline_rsvps: Math.round(muRsvp),
        expected: sim.expected,
        most_likely: sim.most_likely,
        low_estimate: sim.low_estimate,
        high_estimate: sim.high_estimate,
        uncertainty: sim.uncertainty,
        has_free_food: Boolean(r.has_free_food),
        virtual: Boolean(r.virtual),
        at_risk: risk,
      }
    })

    res.json({
      horizon_days: 30,
      model: "monte-carlo-v0",
      trials: TRIALS,
      baseline: {
        club_average: mu,
        spread: sigma,
        past_events: baseN,
        typical_rsvps: muRsvp,
      },
      events,
    })
  } catch (err) {
    console.error("eden/forecast error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/eden/whatif — lift tables built ONLY from the user's club history
router.get("/whatif", requireAuth, async (req: AuthRequest, res: Response) => {
  const clubId = await requireEboardClub(req, res)
  if (clubId == null) return

  try {
    const baselineQ = await edenDb.query(`
      SELECT AVG(COALESCE(p.engagement_score, 0))::float AS mu, COUNT(*)::int AS n
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '365 days' AND e.date <= CURRENT_DATE
    `, [clubId])
    const mu = Number(baselineQ.rows[0]?.mu ?? 0)
    const baselineN = Number(baselineQ.rows[0]?.n ?? 0)

    const liftRow = (row: { mu: number; n: number }) => ({
      mu: row.mu, n: row.n, lift_pct: mu > 0 ? ((row.mu - mu) / mu) * 100 : 0,
    })

    const catQ = await edenDb.query(`
      SELECT COALESCE(e.event_category, 'UNCATEGORIZED') AS k, COUNT(*)::int AS n,
             AVG(COALESCE(p.engagement_score, 0))::float AS mu
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '365 days' AND e.date <= CURRENT_DATE
      GROUP BY k HAVING COUNT(*) >= 2 ORDER BY mu DESC
    `, [clubId])
    const dayQ = await edenDb.query(`
      SELECT CASE WHEN EXTRACT(HOUR FROM e.start_time) < 12 THEN 'morning'
                  WHEN EXTRACT(HOUR FROM e.start_time) < 17 THEN 'afternoon'
                  ELSE 'evening' END AS k,
             COUNT(*)::int AS n, AVG(COALESCE(p.engagement_score, 0))::float AS mu
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1 AND e.start_time IS NOT NULL
        AND e.date > CURRENT_DATE - INTERVAL '365 days' AND e.date <= CURRENT_DATE
      GROUP BY k
    `, [clubId])
    const dowQ = await edenDb.query(`
      SELECT EXTRACT(DOW FROM e.date)::int AS k,
             COUNT(*)::int AS n, AVG(COALESCE(p.engagement_score, 0))::float AS mu
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '365 days' AND e.date <= CURRENT_DATE
      GROUP BY k ORDER BY k
    `, [clubId])
    const foodQ = await edenDb.query(`
      SELECT e.has_free_food AS k, COUNT(*)::int AS n, AVG(COALESCE(p.engagement_score, 0))::float AS mu
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '365 days' AND e.date <= CURRENT_DATE
      GROUP BY k
    `, [clubId])
    const virtualQ = await edenDb.query(`
      SELECT e.virtual AS k, COUNT(*)::int AS n, AVG(COALESCE(p.engagement_score, 0))::float AS mu
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '365 days' AND e.date <= CURRENT_DATE
      GROUP BY k
    `, [clubId])

    res.json({
      baseline_mu: mu,
      baseline_n: baselineN,
      window_days: 365,
      category: catQ.rows.map(r => ({ key: r.k, ...liftRow({ mu: Number(r.mu) || 0, n: Number(r.n) || 0 }) })),
      daypart: dayQ.rows.map(r => ({ key: r.k, ...liftRow({ mu: Number(r.mu) || 0, n: Number(r.n) || 0 }) })),
      dow: dowQ.rows.map(r => ({ key: Number(r.k), ...liftRow({ mu: Number(r.mu) || 0, n: Number(r.n) || 0 }) })),
      free_food: foodQ.rows.map(r => ({ key: r.k ? "yes" : "no", ...liftRow({ mu: Number(r.mu) || 0, n: Number(r.n) || 0 }) })),
      virtual: virtualQ.rows.map(r => ({ key: r.k ? "virtual" : "in-person", ...liftRow({ mu: Number(r.mu) || 0, n: Number(r.n) || 0 }) })),
    })
  } catch (err) {
    console.error("eden/whatif error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/eden/attendance — all this club's events with attendance status, for the F4 form
router.get("/attendance", requireAuth, async (req: AuthRequest, res: Response) => {
  const clubId = await requireEboardClub(req, res)
  if (clubId == null) return

  try {
    const clubRow = await edenDb.query("SELECT name FROM clubs WHERE club_id = $1", [clubId])
    const clubName: string = clubRow.rows[0]?.name ?? `Club ${clubId}`

    const evQ = await edenDb.query(`
      SELECT e.event_id, e.event_name, e.date, e.start_time, e.event_category,
             e.has_free_food, e.virtual, e.predicted_engagement_score,
             COALESCE((SELECT MAX(p.engagement_score) FROM event_posts p WHERE p.event_id = e.event_id), NULL) AS engagement_score,
             COALESCE((SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.event_id AND r.status = 'going'), 0)::int AS rsvps
      FROM events e
      WHERE e.club_id = $1 AND e.date IS NOT NULL
      ORDER BY e.date DESC LIMIT 200
    `, [clubId])

    const eventIds = evQ.rows.map(r => r.event_id)
    const attMap = new Map<number, { headcount: number; notes: string | null; entered_at: string }>()
    if (eventIds.length > 0) {
      const a = await db.query(
        "SELECT event_id, headcount, notes, entered_at FROM event_attendance WHERE event_id = ANY($1::int[])",
        [eventIds]
      )
      for (const row of a.rows) {
        attMap.set(row.event_id, {
          headcount: Number(row.headcount),
          notes: row.notes,
          entered_at: row.entered_at,
        })
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const events = evQ.rows.map(r => {
      const a = attMap.get(r.event_id) ?? null
      const dateString = dateStr(r.date) ?? ""
      return {
        event_id: r.event_id,
        event_name: r.event_name,
        date: dateString,
        start_time: r.start_time,
        category: r.event_category,
        has_free_food: Boolean(r.has_free_food),
        virtual: Boolean(r.virtual),
        predicted_engagement: r.predicted_engagement_score != null ? Number(r.predicted_engagement_score) : null,
        engagement_score: r.engagement_score != null ? Number(r.engagement_score) : null,
        rsvps: Number(r.rsvps) || 0,
        is_past: dateString <= today,
        attendance: a?.headcount ?? null,
        notes: a?.notes ?? null,
        entered_at: a?.entered_at ?? null,
      }
    })

    const past = events.filter(e => e.is_past)
    const captured = past.filter(e => e.attendance != null)
    const counts = captured.map(e => e.attendance as number)
    const sum = counts.reduce((a, b) => a + b, 0)
    const avg = counts.length === 0 ? 0 : sum / counts.length

    const baseQ = await edenDb.query(`
      SELECT AVG(COALESCE(p.engagement_score, 0))::float AS mu
      FROM events e LEFT JOIN event_posts p ON p.event_id = e.event_id
      WHERE e.club_id = $1
        AND e.date > CURRENT_DATE - INTERVAL '180 days' AND e.date <= CURRENT_DATE
    `, [clubId])
    const baselineMu = Number(baseQ.rows[0]?.mu ?? 0)

    res.json({
      club: { club_id: clubId, name: clubName, abbr: abbrFor(clubName) },
      events,
      baseline_mu: baselineMu,
      stats: {
        total_past_events: past.length,
        events_with_attendance: captured.length,
        capture_pct: past.length > 0 ? (captured.length / past.length) * 100 : 0,
        avg_attendance: avg,
      },
    })
  } catch (err) {
    console.error("eden/attendance LIST error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
