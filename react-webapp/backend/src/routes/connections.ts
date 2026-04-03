import { Router, Response } from "express"
import { db } from "../config/postgres"
import { requireAuth, AuthRequest } from "../middlewear/auth"
import { createConnectionInNeo4j, removeConnectionFromNeo4j, getRecommendations } from "../services/graphService"

const router = Router()

// All connection routes require auth
router.use(requireAuth)

// GET /api/connections/status?userId=X — connection status with another user
router.get("/status", async (req: AuthRequest, res: Response) => {
  const { userId } = req.query
  const myId = req.userId!
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId required" })
    return
  }
  try {
    const result = await db.query(
      `SELECT status, from_user_id
       FROM connection_requests
       WHERE (from_user_id = $1 AND to_user_id = $2)
          OR (from_user_id = $2 AND to_user_id = $1)
       LIMIT 1`,
      [myId, userId]
    )
    if (result.rows.length === 0) {
      res.json({ status: "none" })
      return
    }
    const row = result.rows[0]
    res.json({
      status:    row.status as string,
      direction: row.from_user_id === myId ? "sent" : "received",
    })
  } catch (err) {
    console.error("Connection status error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/connections/recommendations — recommended students based on shared attributes
router.get("/recommendations", async (req: AuthRequest, res: Response) => {
  try {
    const recs = await getRecommendations(req.userId!)
    if (recs.length === 0) {
      res.json(recs)
      return
    }

    // Enrich with skills, looking_for, and year from Postgres
    const allIds = [req.userId!, ...recs.map(r => r.id)]
    const pgResult = await db.query(
      `SELECT id, skills, looking_for, year FROM users WHERE id = ANY($1)`,
      [allIds]
    )
    const userMap = new Map<string, { skills: string[]; looking_for: string[]; year: string | null }>()
    for (const row of pgResult.rows) {
      userMap.set(row.id, {
        skills:      Array.isArray(row.skills)      ? row.skills      : [],
        looking_for: Array.isArray(row.looking_for) ? row.looking_for : [],
        year:        row.year ?? null,
      })
    }

    const me = userMap.get(req.userId!) ?? { skills: [], looking_for: [], year: null }

    const enriched = recs
      .map(r => {
        const other        = userMap.get(r.id) ?? { skills: [], looking_for: [], year: null }
        const sharedSkills = me.skills.filter(s => other.skills.includes(s))
        const sharedIntent = me.looking_for.filter(l => other.looking_for.includes(l))
        const bonus        = sharedSkills.length * 2 + sharedIntent.length * 3
        return {
          ...r,
          year:             other.year,
          sharedSkills,
          sharedLookingFor: sharedIntent,
          lookingFor:       other.looking_for,
          score:            r.score + bonus,
        }
      })
      .sort((a, b) => b.score - a.score)

    res.json(enriched)
  } catch (err) {
    console.error("Recommendations error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/connections/request — send a connection request
router.post("/request", async (req: AuthRequest, res: Response) => {
  const { toUserId } = req.body
  const fromUserId = req.userId!

  if (!toUserId) {
    res.status(400).json({ error: "toUserId is required" })
    return
  }
  if (toUserId === fromUserId) {
    res.status(400).json({ error: "Cannot connect to yourself" })
    return
  }

  try {
    // Check target user exists
    const target = await db.query("SELECT id FROM users WHERE id = $1", [toUserId])
    if (target.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // Check for existing request in either direction
    const existing = await db.query(
      `SELECT id, status FROM connection_requests
       WHERE (from_user_id = $1 AND to_user_id = $2)
          OR (from_user_id = $2 AND to_user_id = $1)`,
      [fromUserId, toUserId]
    )
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Connection request already exists", status: existing.rows[0].status })
      return
    }

    await db.query(
      "INSERT INTO connection_requests (from_user_id, to_user_id) VALUES ($1, $2)",
      [fromUserId, toUserId]
    )
    res.status(201).json({ message: "Connection request sent" })
  } catch (err) {
    console.error("Connection request error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/connections/accept — accept a pending request
router.post("/accept", async (req: AuthRequest, res: Response) => {
  const { fromUserId } = req.body
  const toUserId = req.userId!

  if (!fromUserId) {
    res.status(400).json({ error: "fromUserId is required" })
    return
  }

  try {
    const result = await db.query(
      `UPDATE connection_requests
       SET status = 'accepted', updated_at = NOW()
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING id`,
      [fromUserId, toUserId]
    )

    if (result.rowCount === 0) {
      res.status(404).json({ error: "No pending request found" })
      return
    }

    // Create bidirectional relationship in Neo4j
    await createConnectionInNeo4j(fromUserId, toUserId)

    res.json({ message: "Connection accepted" })
  } catch (err) {
    console.error("Accept connection error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// DELETE /api/connections/:userId — remove an accepted connection
router.delete("/:userId", async (req: AuthRequest, res: Response) => {
  const myId     = req.userId!
  const otherId  = req.params.userId

  if (otherId === myId) {
    res.status(400).json({ error: "Cannot remove yourself" })
    return
  }

  try {
    const result = await db.query(
      `DELETE FROM connection_requests
       WHERE ((from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1))
         AND status = 'accepted'
       RETURNING id`,
      [myId, otherId]
    )
    if (result.rowCount === 0) {
      res.status(404).json({ error: "No accepted connection found" })
      return
    }
    await removeConnectionFromNeo4j(myId, otherId)
    res.json({ message: "Connection removed" })
  } catch (err) {
    console.error("Remove connection error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/connections/reject — reject a pending request
router.post("/reject", async (req: AuthRequest, res: Response) => {
  const { fromUserId } = req.body
  const toUserId = req.userId!

  if (!fromUserId) {
    res.status(400).json({ error: "fromUserId is required" })
    return
  }

  try {
    const result = await db.query(
      `UPDATE connection_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING id`,
      [fromUserId, toUserId]
    )

    if (result.rowCount === 0) {
      res.status(404).json({ error: "No pending request found" })
      return
    }

    res.json({ message: "Connection rejected" })
  } catch (err) {
    console.error("Reject connection error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/connections/pending — incoming pending requests for current user
router.get("/pending", async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT cr.id, cr.from_user_id, cr.created_at,
              u.name AS from_name, u.email AS from_email, u.major AS from_major
       FROM connection_requests cr
       JOIN users u ON u.id = cr.from_user_id
       WHERE cr.to_user_id = $1 AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error("Pending connections error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/connections — accepted connections for current user
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.major, u.gpa, u.graduation_year, u.bio
       FROM connection_requests cr
       JOIN users u ON u.id = CASE
         WHEN cr.from_user_id = $1 THEN cr.to_user_id
         ELSE cr.from_user_id
       END
       WHERE (cr.from_user_id = $1 OR cr.to_user_id = $1)
         AND cr.status = 'accepted'`,
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error("List connections error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
