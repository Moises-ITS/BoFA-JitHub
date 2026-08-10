/**
 * routes/events.ts — HTTP surface for the campus events feed.
 *
 * Mounted at /api, so the paths below read /api/events/*, /api/rsvp/*, /api/clubs.
 * These are the routes the Events page, the Home sidebar, and the profile page
 * call; they previously lived in the standalone EDEN FastAPI service.
 *
 * Routes stay thin per CLAUDE.md — parse and validate input, delegate to
 * eventsService, broadcast, respond.
 *
 * AUTH POLICY
 * -----------
 * Reads are public: the feed is browsable campus information, and the frontend
 * renders it before the auth context has resolved a token.
 * Writes require a session — an event submission and an RSVP are both attributed
 * to a specific student, and the writer's identity is taken from the verified
 * token, never from the request body.
 */

import { Router, Request, Response } from "express"
import { requireAuth, AuthRequest } from "../middleware/auth.js"
import { broadcastEvent } from "../realtime/eventsSocket.js"
import * as events from "../services/eventsService.js"

const router = Router()

/** Clamp a caller-supplied limit — an unbounded LIMIT is a free table scan. */
function parseLimit(raw: unknown, fallback: number, max = 100): number {
  const n = Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

function parseEventIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  // Cap the batch: these arrive as a POST body and land in an `= ANY($1)`, so
  // an unbounded array lets one request build an arbitrarily large query.
  return raw
    .map(v => Number.parseInt(String(v), 10))
    .filter(n => Number.isFinite(n))
    .slice(0, 200)
}

function fail(res: Response, err: unknown, context: string) {
  if (err instanceof events.EventValidationError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error(`[events] ${context} failed:`, err)
  res.status(500).json({ error: "Internal server error" })
}

// ── Club directory ───────────────────────────────────────────────────────────

router.get("/clubs", async (_req: Request, res: Response) => {
  try {
    res.json(await events.getClubDirectory())
  } catch (err) {
    fail(res, err, "GET /clubs")
  }
})

// ── Feed ─────────────────────────────────────────────────────────────────────
// NOTE ON ORDERING: the literal paths below MUST stay above `/events/:id`, or
// Express matches "/events/upcoming" against :id first and every one of them
// 400s on an unparseable id.

router.get("/events/upcoming", async (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === "string" && req.query.category.trim()
      ? req.query.category.trim()
      : null
    res.json(await events.getUpcoming(parseLimit(req.query.limit, 20), category))
  } catch (err) {
    fail(res, err, "GET /events/upcoming")
  }
})

router.get("/events/trending", async (req: Request, res: Response) => {
  try {
    res.json(await events.getTrending(parseLimit(req.query.limit, 20), req.query.upcoming_only === "true"))
  } catch (err) {
    fail(res, err, "GET /events/trending")
  }
})

router.get("/events/top-risers", async (req: Request, res: Response) => {
  try {
    res.json(await events.getTopRisers(parseLimit(req.query.limit, 20)))
  } catch (err) {
    fail(res, err, "GET /events/top-risers")
  }
})

router.get("/events/clubs/trending", async (req: Request, res: Response) => {
  try {
    res.json(await events.getClubsTrending(parseLimit(req.query.limit, 5, 20)))
  } catch (err) {
    fail(res, err, "GET /events/clubs/trending")
  }
})

router.get("/events/clubs/top-risers", async (req: Request, res: Response) => {
  try {
    res.json(await events.getClubsTopRisers(parseLimit(req.query.limit, 5, 20)))
  } catch (err) {
    fail(res, err, "GET /events/clubs/top-risers")
  }
})

router.get("/events/heatmap/weeks", (_req: Request, res: Response) => {
  try {
    res.json(events.getHeatmapWeeks())
  } catch (err) {
    fail(res, err, "GET /events/heatmap/weeks")
  }
})

router.get("/events/heatmap/week", async (req: Request, res: Response) => {
  try {
    const weekStart = typeof req.query.week_start === "string" ? req.query.week_start : null
    res.json(await events.getHeatmapWeek(weekStart))
  } catch (err) {
    fail(res, err, "GET /events/heatmap/week")
  }
})

// ── Student submission ───────────────────────────────────────────────────────

router.post("/events/community", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const created = await events.createCommunityEvent(req.body ?? {}, req.userId!)
    // Broadcast AFTER the transaction commits. Publishing first would let a
    // client refetch and miss the event it was just told about.
    broadcastEvent({ type: "event.created", event: created })
    res.status(201).json(created)
  } catch (err) {
    fail(res, err, "POST /events/community")
  }
})

// ── RSVPs ────────────────────────────────────────────────────────────────────

router.post("/rsvp/batch-attendees", async (req: Request, res: Response) => {
  try {
    res.json(await events.getBatchAttendees(parseEventIds(req.body?.event_ids)))
  } catch (err) {
    fail(res, err, "POST /rsvp/batch-attendees")
  }
})

router.post("/rsvp/batch-status", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // The caller's own statuses only — the body's user_id is ignored so one
    // student cannot enumerate another's RSVPs.
    res.json(await events.getBatchStatus(req.userId!, parseEventIds(req.body?.event_ids)))
  } catch (err) {
    fail(res, err, "POST /rsvp/batch-status")
  }
})

router.get("/rsvp/user/:userId", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.params.userId !== req.userId) {
      res.status(403).json({ error: "You can only view your own RSVPs" })
      return
    }
    res.json(await events.getUserRsvps(req.userId!))
  } catch (err) {
    fail(res, err, "GET /rsvp/user/:userId")
  }
})

router.get("/rsvp/:eventId/attendees", async (req: Request, res: Response) => {
  const eventId = Number.parseInt(req.params.eventId, 10)
  if (!Number.isFinite(eventId)) {
    res.status(400).json({ error: "Invalid event id" })
    return
  }
  try {
    res.json(await events.getAttendees(eventId))
  } catch (err) {
    fail(res, err, "GET /rsvp/:eventId/attendees")
  }
})

router.post("/rsvp/:eventId", requireAuth, async (req: AuthRequest, res: Response) => {
  const eventId = Number.parseInt(req.params.eventId, 10)
  if (!Number.isFinite(eventId)) {
    res.status(400).json({ error: "Invalid event id" })
    return
  }
  try {
    const status = typeof req.body?.status === "string" && req.body.status.trim()
      ? req.body.status.trim()
      : "going"
    await events.upsertRsvp(eventId, req.userId!, req.body ?? {}, status)
    const snapshot = await events.getAttendees(eventId)
    broadcastEvent({ type: "rsvp.changed", event_id: eventId, ...snapshot })
    res.json({ ok: true, ...snapshot })
  } catch (err) {
    fail(res, err, "POST /rsvp/:eventId")
  }
})

router.delete("/rsvp/:eventId/:userId", requireAuth, async (req: AuthRequest, res: Response) => {
  const eventId = Number.parseInt(req.params.eventId, 10)
  if (!Number.isFinite(eventId)) {
    res.status(400).json({ error: "Invalid event id" })
    return
  }
  try {
    // :userId is kept in the path for URL compatibility but is NOT trusted —
    // the row removed is always the authenticated caller's.
    await events.deleteRsvp(eventId, req.userId!)
    const snapshot = await events.getAttendees(eventId)
    broadcastEvent({ type: "rsvp.changed", event_id: eventId, ...snapshot })
    res.json({ ok: true, ...snapshot })
  } catch (err) {
    fail(res, err, "DELETE /rsvp/:eventId/:userId")
  }
})

// Declared last so it cannot shadow /events/upcoming, /events/trending, etc.
router.get("/events/:id", async (req: Request, res: Response) => {
  const eventId = Number.parseInt(req.params.id, 10)
  if (!Number.isFinite(eventId)) {
    res.status(400).json({ error: "Invalid event id" })
    return
  }
  try {
    const event = await events.getEventById(eventId)
    if (!event) {
      res.status(404).json({ error: "Not found" })
      return
    }
    res.json(event)
  } catch (err) {
    fail(res, err, "GET /events/:id")
  }
})

export default router
