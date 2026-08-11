/**
 * routes/jiti.ts — HTTP surface for Jiti v2, the NJIT-club chatbot.
 *
 * Mounted at /api/jiti behind JITI_ENABLED (see index.ts). Routes stay thin
 * per CLAUDE.md: parse the request, delegate to jitiService/jitiQuotaService,
 * translate their typed errors into the frozen API contract's status codes.
 */

import { Router, Response } from "express"
import { requireAuth, AuthRequest } from "../middleware/auth.js"
import * as jiti from "../services/jitiService.js"
import { getUserQuotaStatus } from "../services/jitiQuotaService.js"

const router = Router()

router.post("/chat", requireAuth, async (req: AuthRequest, res: Response) => {
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

router.get("/status", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    res.json(await getUserQuotaStatus(req.userId!))
  } catch (err) {
    console.error("[jiti] GET /status failed:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
