import { Router, Response } from "express"
import { db } from "../config/postgres.js"
import { requireAuth, AuthRequest } from "../middleware/auth.js"
import { createConnectionInNeo4j, createProfessorNode, createStudentNode, removeConnectionFromNeo4j, getRecommendations } from "../services/graphService.js"
import { connectionActionRateLimiter } from "../middleware/authRateLimit.js"
import { requireSafeId, toBoundedPositiveInt } from "../middleware/security.js"

const router = Router()

// All connection routes require auth
router.use(requireAuth)

/**
 * Repairs the graph projection for the users about to be connected, and reports
 * which of them may hold a graph relationship at all.
 *
 * WHY THE TYPE CHECK: this used to call createStudentNode() for every id it was
 * given, regardless of what kind of account it was. Two bugs followed from that.
 *
 *  1. Professors got a SECOND node. `MERGE (s:Student {id: $id})` matches on
 *     label AND id, so it never found the existing `:Professor` node and
 *     created a `:Student` one carrying the same id. getNodes() returns both,
 *     so the graph payload gained duplicate ids — enough to break D3's keying
 *     and make hover cards show whichever copy won.
 *  2. Guests got a node at all. Signup deliberately keeps them out of the graph
 *     (see /api/auth/register-custom); this path silently put them back in, so
 *     the two disagreed about whether guests are discoverable.
 *
 * Returns the subset of ids that are graph-eligible. Guests are excluded, which
 * is what lets the caller skip the Neo4j edge entirely rather than issuing a
 * MATCH that silently matches nothing.
 */
async function ensureConnectionNodes(userIds: string[]): Promise<Set<string>> {
  const result = await db.query(
    `SELECT id, name, major, gpa, graduation_year, bio, clubs, companies,
            interests, linkedin_url, department, user_type
     FROM users
     WHERE id = ANY($1)`,
    [userIds]
  )

  const graphEligible = new Set<string>()

  for (const row of result.rows) {
    // NULL user_type is treated as 'student', matching the `|| "student"`
    // default used throughout the auth routes for rows predating migration 014.
    const userType = row.user_type ?? "student"
    const interests = Array.isArray(row.interests) ? row.interests : []

    if (userType === "guest") continue

    if (userType === "professor") {
      await createProfessorNode({
        id: row.id,
        name: row.name ?? "Professor",
        department: row.department ?? "",
        interests,
        bio: row.bio,
        linkedinUrl: row.linkedin_url,
      })
    } else {
      await createStudentNode({
        id: row.id,
        name: row.name ?? "Student",
        major: row.major ?? "",
        gpa: row.gpa == null ? null : Number(row.gpa),
        graduationYear: row.graduation_year ?? null,
        bio: row.bio ?? "",
        clubs: Array.isArray(row.clubs) ? row.clubs : [],
        companies: Array.isArray(row.companies) ? row.companies : [],
        interests,
        linkedinUrl: row.linkedin_url ?? null,
      })
    }
    graphEligible.add(row.id)
  }

  return graphEligible
}

// GET /api/connections/status?userId=X — connection status with another user
router.get("/status", async (req: AuthRequest, res: Response) => {
  const { userId } = req.query
  const myId = req.userId!
  const safeUserId = requireSafeId(userId)
  if (!safeUserId) {
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
      [myId, safeUserId]
    )
    if (result.rows.length === 0) {
      res.json({ status: "none" })
      return
    }
    const row = result.rows[0]
    res.json({
      status: row.status as string,
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
        skills: Array.isArray(row.skills) ? row.skills : [],
        looking_for: Array.isArray(row.looking_for) ? row.looking_for : [],
        year: row.year ?? null,
      })
    }

    const me = userMap.get(req.userId!) ?? { skills: [], looking_for: [], year: null }

    const enriched = recs
      .map(r => {
        const other = userMap.get(r.id) ?? { skills: [], looking_for: [], year: null }
        const sharedSkills = me.skills.filter(s => other.skills.includes(s))
        const sharedIntent = me.looking_for.filter(l => other.looking_for.includes(l))
        const bonus = sharedSkills.length * 2 + sharedIntent.length * 3
        return {
          ...r,
          year: other.year,
          sharedSkills,
          sharedLookingFor: sharedIntent,
          lookingFor: other.looking_for,
          score: r.score + bonus,
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
router.post("/request", connectionActionRateLimiter, async (req: AuthRequest, res: Response) => {
  const { toUserId } = req.body
  const fromUserId = req.userId!
  const safeToUserId = requireSafeId(toUserId)

  if (!safeToUserId) {
    res.status(400).json({ error: "toUserId is required" })
    return
  }
  if (safeToUserId === fromUserId) {
    res.status(400).json({ error: "Cannot connect to yourself" })
    return
  }

  try {
    // Check target user exists
    const target = await db.query("SELECT id FROM users WHERE id = $1", [safeToUserId])
    if (target.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }

    // Check for existing request in either direction
    const existing = await db.query(
      `SELECT id, status FROM connection_requests
       WHERE (from_user_id = $1 AND to_user_id = $2)
          OR (from_user_id = $2 AND to_user_id = $1)`,
      [fromUserId, safeToUserId]
    )
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Connection request already exists", status: existing.rows[0].status })
      return
    }

    await db.query(
      "INSERT INTO connection_requests (from_user_id, to_user_id) VALUES ($1, $2)",
      [fromUserId, safeToUserId]
    )
    res.status(201).json({ message: "Connection request sent" })
  } catch (err) {
    console.error("Connection request error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/connections/accept — accept a pending request
router.post("/accept", connectionActionRateLimiter, async (req: AuthRequest, res: Response) => {
  const { fromUserId } = req.body
  const toUserId = req.userId!
  const safeFromUserId = requireSafeId(fromUserId)

  if (!safeFromUserId) {
    res.status(400).json({ error: "fromUserId is required" })
    return
  }

  try {
    const result = await db.query(
      `UPDATE connection_requests
       SET status = 'accepted', updated_at = NOW()
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING id`,
      [safeFromUserId, toUserId]
    )

    if (result.rowCount === 0) {
      res.status(404).json({ error: "No pending request found" })
      return
    }

    // Create bidirectional relationship in Neo4j. Postgres already recorded the
    // acceptance above and is the source of truth for connections — the graph
    // edge is a projection, so a guest on either side simply means no edge
    // rather than a failed request. Skipping is deliberate: issuing the MATCH
    // anyway would silently match nothing and look like it had worked.
    const graphEligible = await ensureConnectionNodes([safeFromUserId, toUserId])
    if (graphEligible.has(safeFromUserId) && graphEligible.has(toUserId)) {
      await createConnectionInNeo4j(safeFromUserId, toUserId)
    }

    // Notify original sender that their request was accepted.
    const accepter = await db.query("SELECT name FROM users WHERE id = $1", [toUserId])
    const accepterName = (accepter.rows[0]?.name as string | undefined)?.trim() || "A user"
    await db.query(
      `INSERT INTO user_notifications (user_id, kind, title, message, related_user_id)
       VALUES ($1, 'connection_accepted', 'Connection accepted', $2, $3)`,
      [safeFromUserId, `${accepterName} accepted your connection request.`, toUserId]
    )

    res.json({ message: "Connection accepted" })
  } catch (err) {
    console.error("Accept connection error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/connections/notifications — pending requests + inbox updates for current user
router.get("/notifications", async (req: AuthRequest, res: Response) => {
  const myId = req.userId!
  try {
    const [pendingResult, updatesResult] = await Promise.all([
      db.query(
        `SELECT cr.id, cr.from_user_id, cr.created_at,
                u.name AS from_name, u.email AS from_email, u.major AS from_major
         FROM connection_requests cr
         JOIN users u ON u.id = cr.from_user_id
         WHERE cr.to_user_id = $1 AND cr.status = 'pending'
         ORDER BY cr.created_at DESC`,
        [myId]
      ),
      db.query(
        `SELECT n.id, n.kind, n.title, n.message, n.is_read, n.created_at, n.related_user_id,
                u.name AS related_user_name
         FROM user_notifications n
         LEFT JOIN users u ON u.id = n.related_user_id
         WHERE n.user_id = $1
         ORDER BY n.created_at DESC
         LIMIT 100`,
        [myId]
      ),
    ])

    const unreadUpdates = updatesResult.rows.reduce(
      (acc, row) => acc + (row.is_read ? 0 : 1),
      0
    )
    const unreadCount = pendingResult.rows.length + unreadUpdates

    res.json({
      unreadCount,
      pendingRequests: pendingResult.rows,
      updates: updatesResult.rows,
    })
  } catch (err) {
    console.error("Notifications error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/connections/notifications/mark-read — mark inbox updates as read
router.post("/notifications/mark-read", connectionActionRateLimiter, async (req: AuthRequest, res: Response) => {
  const myId = req.userId!
  const { ids, markAll } = req.body as { ids?: number[]; markAll?: boolean }

  try {
    if (markAll) {
      await db.query(
        `UPDATE user_notifications
         SET is_read = TRUE
         WHERE user_id = $1 AND is_read = FALSE`,
        [myId]
      )
      res.json({ message: "Notifications marked as read" })
      return
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids[] or markAll=true is required" })
      return
    }
    const safeIds = ids
      .slice(0, 100)
      .map((id) => toBoundedPositiveInt(id, 0, 1, Number.MAX_SAFE_INTEGER))
      .filter((id) => Number.isFinite(id) && id > 0)
    if (!safeIds.length) {
      res.status(400).json({ error: "ids[] must contain valid positive integers" })
      return
    }

    await db.query(
      `UPDATE user_notifications
       SET is_read = TRUE
       WHERE user_id = $1 AND id = ANY($2::int[])`,
      [myId, safeIds]
    )
    res.json({ message: "Notifications marked as read" })
  } catch (err) {
    console.error("Mark notifications read error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// DELETE /api/connections/by-user/:userId — remove an accepted connection
router.delete("/by-user/:userId", connectionActionRateLimiter, async (req: AuthRequest, res: Response) => {
  const myId = req.userId!
  const otherId = requireSafeId(req.params.userId)

  if (!otherId) {
    res.status(400).json({ error: "Invalid userId format" })
    return
  }
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
router.post("/reject", connectionActionRateLimiter, async (req: AuthRequest, res: Response) => {
  const { fromUserId } = req.body
  const toUserId = req.userId!
  const safeFromUserId = requireSafeId(fromUserId)

  if (!safeFromUserId) {
    res.status(400).json({ error: "fromUserId is required" })
    return
  }

  try {
    const result = await db.query(
      `UPDATE connection_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING id`,
      [safeFromUserId, toUserId]
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
