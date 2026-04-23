import { Router, Response } from "express"
import { db } from "../config/postgres.js"
import { requireAuth, AuthRequest } from "../middlewear/auth.js"
import { apiWriteRateLimiter } from "../middlewear/authRateLimit.js"
import { sanitizeStringArray } from "../middlewear/security.js"

const router = Router()

// GET /api/chat-memory — top topics for current user
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT topic, weight FROM user_chat_memory
       WHERE user_id = $1
       ORDER BY weight DESC, last_seen DESC
       LIMIT 10`,
      [req.userId]
    )
    res.json(result.rows.map((r: { topic: string; weight: number }) => ({
      topic: r.topic,
      weight: r.weight,
    })))
  } catch {
    res.json([])
  }
})

// POST /api/chat-memory/record — upsert topics extracted from a user message
router.post("/record", requireAuth, apiWriteRateLimiter, async (req: AuthRequest, res: Response) => {
  const { topics } = req.body as { topics: string[] }
  const safeTopics = sanitizeStringArray(topics, 80, 10)
  if (safeTopics.length === 0) {
    res.status(400).json({ error: "topics must be a non-empty array" })
    return
  }
  try {
    for (const topic of safeTopics) {
      await db.query(
        `INSERT INTO user_chat_memory (user_id, topic, weight, last_seen)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (user_id, topic)
         DO UPDATE SET weight = user_chat_memory.weight + 1, last_seen = NOW()`,
        [req.userId, topic]
      )
    }
    res.json({ ok: true })
  } catch (err) {
    console.error("chat-memory record error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
