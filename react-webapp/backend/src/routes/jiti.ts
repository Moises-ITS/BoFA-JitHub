/**
 * routes/jiti.ts — HTTP surface for Jiti v2, the NJIT-club chatbot.
 *
 * Mounted at /api/jiti behind JITI_ENABLED (see index.ts). Routes stay thin
 * per CLAUDE.md: parse the request, delegate to jitiService/jitiQuotaService,
 * translate their typed errors into the frozen API contract's status codes.
 */

import { Router, Response, NextFunction } from "express"
import { db } from "../config/postgres.js"
import { requireAuth, AuthRequest } from "../middleware/auth.js"
import * as jiti from "../services/jitiService.js"
import { getUserQuotaStatus } from "../services/jitiQuotaService.js"

const router = Router()

/**
 * Jiti is for the NJIT community — students, faculty, and staff. Guest accounts
 * do not get it.
 *
 * This is also the load-bearing abuse control. Anyone can self-serve a guest
 * account at POST /api/auth/register-custom with no email verification, so
 * while guests could reach the chatbot, a single person could mint accounts in
 * a loop and each one carried a fresh 5-prompt quota. Per-IP limits are the
 * wrong tool on a campus that NATs its students behind a handful of addresses,
 * and the per-user quota is by definition useless when users are free. Denying
 * guests removes the incentive entirely: a farmed account grants nothing.
 *
 * The daily global spend ceiling still caps the bill; this caps who can spend it.
 *
 * Applied to /status as well as /chat, deliberately — the widget hides itself
 * when /status is not a 200, so a guest never even sees the launcher rather
 * than seeing one that errors on first use.
 */
async function denyGuests(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { rows } = await db.query("SELECT user_type FROM users WHERE id = $1", [req.userId])
    if (rows[0]?.user_type === "guest") {
      res.status(403).json({
        error: "Jiti is available to NJIT students, faculty, and staff.",
        code: "GUEST_NOT_ALLOWED",
      })
      return
    }
    next()
  } catch (err) {
    // Fail CLOSED. This gate is an abuse control, and a database hiccup must
    // not become the way around it.
    console.error("[jiti][auth] guest check failed:", err)
    res.status(503).json({ error: "Jiti is unavailable right now", code: "UPSTREAM_FAILURE" })
  }
}

router.post("/chat", requireAuth, denyGuests, async (req: AuthRequest, res: Response) => {
  let input: jiti.ChatInput
  try {
    input = jiti.validateChatInput(req.body)
  } catch (err) {
    if (err instanceof jiti.ValidationError) {
      res.status(400).json({ error: err.message })
      return
    }
    console.error("[jiti] POST /chat validation failed unexpectedly:", err)
    res.status(400).json({ error: "Invalid request" })
    return
  }

  try {
    const result = await jiti.chat(req.userId!, input)
    res.json(result)
  } catch (err) {
    if (err instanceof jiti.QuotaExceededError) {
      res.status(429).json({
        error: err.message,
        code: "QUOTA_EXCEEDED",
        used: err.used,
        limit: err.limit,
        resetAt: err.resetAt,
      })
      return
    }
    if (err instanceof jiti.AtCapacityError) {
      res.status(503).json({
        error: "Jiti is at capacity for today — try again tomorrow",
        code: "AT_CAPACITY",
        resetAt: err.resetAt,
      })
      return
    }
    if (err instanceof jiti.UpstreamFailureError) {
      res.status(502).json({ error: err.message, code: "UPSTREAM_FAILURE" })
      return
    }
    console.error("[jiti] POST /chat failed:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.get("/status", requireAuth, denyGuests, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await getUserQuotaStatus(req.userId!))
  } catch (err) {
    console.error("[jiti] GET /status failed:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
