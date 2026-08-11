/**
 * routes/organizations.ts — HTTP surface for the Organizations directory.
 *
 * Mounted at /api/organizations. Deliberately NOT added to routes/events.ts:
 * that router is mounted at bare /api and already owns /api/clubs, so a sibling
 * /api/clubs/trending declared in a second router would be an ordering hazard
 * against the existing /api/events/clubs/trending the Events sidebar depends on.
 *
 * Routes stay thin per CLAUDE.md — parse, validate, delegate to
 * organizationsService, respond.
 *
 * AUTH POLICY (Decision 3 / R1)
 * -----------------------------
 * Star COUNTS and the directory listing are public: the page is gated by
 * ProtectedRoute in the UI anyway, and leaving the reads open means they cannot
 * race the auth context resolving a token.
 * "Did I star this", the detail view (it contains the caller's connections), and
 * every write require a session. The user id comes from the verified token via
 * req.userId, NEVER from the request body.
 */

import { Router, Request, Response } from "express"
import { requireAuth, AuthRequest } from "../middleware/auth.js"
import * as orgs from "../services/organizationsService.js"

const router = Router()

/** Clamp a caller-supplied limit — an unbounded LIMIT is a free table scan. */
function parseLimit(raw: unknown, fallback: number, max = 100): number {
  const n = Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

/** Non-numeric or negative offsets collapse to 0 rather than 400 — a bad offset
 *  is a client bug that should still render page one, not an error page. */
function parseOffset(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function parseClubId(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(n) || n <= 0) throw new orgs.OrgValidationError("Invalid organization id", 400)
  return n
}

function fail(res: Response, err: unknown, context: string) {
  if (err instanceof orgs.OrgValidationError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error(`[orgs] ${context} failed:`, err)
  res.status(500).json({ error: "Internal server error" })
}

// ── Directory ────────────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const rawType = typeof req.query.type === "string" ? req.query.type.trim() : ""
    // An empty/absent `type` means "all"; anything else must be one of the three
    // legal values, because silently ignoring a typo would show the unfiltered
    // list and look like the filter is broken (AC 16).
    let type: orgs.OrgType | null = null
    if (rawType) {
      if (!orgs.isOrgType(rawType)) {
        res.status(400).json({ error: "Invalid type filter" })
        return
      }
      type = rawType
    }
    const q = typeof req.query.q === "string" ? req.query.q.trim() : ""

    res.json(
      await orgs.listOrganizations({
        q: q || null,
        type,
        limit: parseLimit(req.query.limit, 24, 100),
        offset: parseOffset(req.query.offset),
      })
    )
  } catch (err) {
    fail(res, err, "GET /organizations")
  }
})

// NOTE ON ORDERING: the two literal paths below MUST stay above "/:clubId", or
// Express matches "/trending" and "/my-stars" against :clubId first and both
// 400 on an unparseable id. Same trap routes/events.ts documents at its feed
// section.

router.get("/trending", async (req: Request, res: Response) => {
  try {
    res.json(await orgs.getTrendingOrgs(parseLimit(req.query.limit, 5, 20)))
  } catch (err) {
    fail(res, err, "GET /organizations/trending")
  }
})

router.get("/my-stars", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ club_ids: await orgs.getStarredClubIds(req.userId!) })
  } catch (err) {
    fail(res, err, "GET /organizations/my-stars")
  }
})

router.get("/:clubId", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const detail = await orgs.getOrganizationDetail(parseClubId(req.params.clubId), req.userId!)
    if (!detail) {
      res.status(404).json({ error: "Not found" })
      return
    }
    res.json(detail)
  } catch (err) {
    fail(res, err, "GET /organizations/:clubId")
  }
})

// ── Stars ────────────────────────────────────────────────────────────────────

router.put("/:clubId/star", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await orgs.setStar(req.userId!, parseClubId(req.params.clubId), "add"))
  } catch (err) {
    fail(res, err, "PUT /organizations/:clubId/star")
  }
})

router.delete("/:clubId/star", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await orgs.setStar(req.userId!, parseClubId(req.params.clubId), "remove"))
  } catch (err) {
    fail(res, err, "DELETE /organizations/:clubId/star")
  }
})

export default router
