import { Router, Response } from "express"
import { db } from "../config/postgres"
import { requireAuth, AuthRequest } from "../middlewear/auth"

const router = Router()

const EVENTS_API = process.env.EVENTS_API_URL ?? "http://localhost:8000"

// POST /api/eden/dev-grant — dev-only self-grant of e-board access.
//   body: { club_handle?: string, club_id?: number }
//   If club_handle is given, resolves club_id via EDEN /clubs.
router.post("/dev-grant", requireAuth, async (req: AuthRequest, res: Response) => {
  const { club_handle, club_id } = req.body ?? {}
  let resolvedClubId: number | null =
    Number.isFinite(Number(club_id)) ? Number(club_id) : null

  if (resolvedClubId == null && typeof club_handle === "string" && club_handle.trim()) {
    try {
      const resp = await fetch(`${EVENTS_API}/clubs`)
      if (!resp.ok) {
        res.status(502).json({ error: `EDEN /clubs returned ${resp.status}` })
        return
      }
      const clubs = await resp.json() as Array<{ club_id: number; instagram_handle: string | null; name: string }>
      const handle = club_handle.trim().toLowerCase().replace(/^@/, "")
      const match = clubs.find(c => (c.instagram_handle ?? "").toLowerCase().replace(/^@/, "") === handle)
      if (!match) {
        res.status(404).json({ error: `No club with instagram handle "${club_handle}"` })
        return
      }
      resolvedClubId = match.club_id
    } catch (err) {
      console.error("eden/dev-grant lookup error:", err)
      res.status(502).json({ error: "Failed to reach EDEN backend" })
      return
    }
  }

  if (resolvedClubId == null) {
    res.status(400).json({ error: "Provide club_handle or club_id" })
    return
  }

  try {
    const result = await db.query(
      `UPDATE users SET is_eboard = TRUE, eboard_club_id = $1
       WHERE id = $2
       RETURNING id, is_eboard, eboard_club_id`,
      [resolvedClubId, req.userId]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }
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
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }
    const row = result.rows[0]
    res.json({
      is_eboard: Boolean(row.is_eboard),
      eboard_club_id: row.eboard_club_id ?? null,
    })
  } catch (err) {
    console.error("eden/status error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/eden/events/:id/attendance — record or overwrite attendance for an event
router.post("/events/:id/attendance", requireAuth, async (req: AuthRequest, res: Response) => {
  const eventId = Number.parseInt(req.params.id, 10)
  if (!Number.isFinite(eventId)) {
    res.status(400).json({ error: "Invalid event id" })
    return
  }

  const { club_id, headcount, notes } = req.body ?? {}
  const clubId = Number.parseInt(String(club_id), 10)
  const count = Number.parseInt(String(headcount), 10)
  if (!Number.isFinite(clubId) || !Number.isFinite(count) || count < 0) {
    res.status(400).json({ error: "club_id and non-negative headcount are required" })
    return
  }

  try {
    const u = await db.query(
      "SELECT is_eboard, eboard_club_id FROM users WHERE id = $1",
      [req.userId]
    )
    if (u.rows.length === 0 || !u.rows[0].is_eboard) {
      res.status(403).json({ error: "E-board access required" })
      return
    }
    if (u.rows[0].eboard_club_id !== clubId) {
      res.status(403).json({ error: "You can only record attendance for your own club" })
      return
    }

    const notesValue = typeof notes === "string" && notes.trim() ? notes.trim() : null

    await db.query(
      `INSERT INTO event_attendance (event_id, club_id, headcount, entered_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id) DO UPDATE SET
         headcount  = EXCLUDED.headcount,
         entered_by = EXCLUDED.entered_by,
         entered_at = NOW(),
         notes      = EXCLUDED.notes`,
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

// GET /api/eden/events/:id/attendance — read attendance; only the owning club's e-board
router.get("/events/:id/attendance", requireAuth, async (req: AuthRequest, res: Response) => {
  const eventId = Number.parseInt(req.params.id, 10)
  if (!Number.isFinite(eventId)) {
    res.status(400).json({ error: "Invalid event id" })
    return
  }

  try {
    const u = await db.query(
      "SELECT is_eboard, eboard_club_id FROM users WHERE id = $1",
      [req.userId]
    )
    if (u.rows.length === 0 || !u.rows[0].is_eboard) {
      res.status(403).json({ error: "E-board access required" })
      return
    }

    const row = await db.query(
      "SELECT event_id, club_id, headcount, entered_by, entered_at, notes FROM event_attendance WHERE event_id = $1",
      [eventId]
    )
    if (row.rows.length === 0) {
      res.json(null)
      return
    }
    if (row.rows[0].club_id !== u.rows[0].eboard_club_id) {
      res.status(403).json({ error: "You can only view attendance for your own club" })
      return
    }
    res.json(row.rows[0])
  } catch (err) {
    console.error("eden/attendance GET error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
