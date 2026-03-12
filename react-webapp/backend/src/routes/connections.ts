import { Router, Response } from "express"
import { db } from "../config/postgres"
import { requireAuth, AuthRequest } from "../middlewear/auth"
import { createConnectionInNeo4j } from "../services/graphService"

const router = Router()

// All connection routes require auth
router.use(requireAuth)

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
