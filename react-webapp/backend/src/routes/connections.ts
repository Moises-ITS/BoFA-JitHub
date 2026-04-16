import { Router, Response } from "express"
import { db } from "../config/postgres"
import { requireAuth, AuthRequest } from "../middlewear/auth"
import { createConnectionInNeo4j, removeConnectionFromNeo4j, getRecommendations } from "../services/graphService"

const router = Router()

const TOPIC_STOP_WORDS = new Set([
  "a", "an", "and", "are", "be", "can", "could", "for", "from", "help",
  "helping", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or",
  "someone", "something", "that", "the", "these", "those", "to", "want",
  "who", "with", "would", "you",
])

function normalizeClubText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function tokenizeTopic(value: string | null | undefined) {
  return new Set(
    (value ?? "")
      .toLowerCase()
      .match(/[a-z0-9+#]+/g)?.filter((token) => token.length >= 3 && !TOPIC_STOP_WORDS.has(token)) ?? []
  )
}

function memberMatchesClub(userClubs: string[], clubTerms: string[]) {
  const normalizedTerms = clubTerms.map(normalizeClubText).filter(Boolean)
  return userClubs.some((club) => {
    const normalizedClub = normalizeClubText(club)
    return normalizedTerms.some((term) =>
      normalizedClub === term || normalizedClub.includes(term) || term.includes(normalizedClub)
    )
  })
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

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

router.post("/club-members", async (req: AuthRequest, res: Response) => {
  const rawClubName = typeof req.body?.clubName === "string" ? req.body.clubName.trim() : ""
  const clubTerms = Array.isArray(req.body?.clubTerms)
    ? req.body.clubTerms.filter((term: unknown): term is string => typeof term === "string" && term.trim().length > 0)
    : []
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : ""
  const limit = Math.min(Math.max(Number(req.body?.limit) || 5, 1), 8)

  if (!rawClubName) {
    res.status(400).json({ error: "clubName is required" })
    return
  }

  const allClubTerms = Array.from(new Set([rawClubName, ...clubTerms]))
  const topicTokens = tokenizeTopic(topic)

  try {
    const [meResult, candidatesResult, statusResult] = await Promise.all([
      db.query(
        `SELECT id, major, clubs, interests, skills
         FROM users
         WHERE id = $1`,
        [req.userId]
      ),
      db.query(
        `SELECT id, name, major, year, graduation_year, bio, clubs, interests, skills, looking_for
         FROM users
         WHERE id <> $1 AND array_length(clubs, 1) > 0`,
        [req.userId]
      ),
      db.query(
        `SELECT from_user_id, to_user_id, status
         FROM connection_requests
         WHERE from_user_id = $1 OR to_user_id = $1`,
        [req.userId]
      ),
    ])

    const me = meResult.rows[0] ?? { major: null, clubs: [], interests: [], skills: [] }
    const statusMap = new Map<string, { status: string; direction: string }>()
    for (const row of statusResult.rows) {
      const otherId = row.from_user_id === req.userId ? row.to_user_id : row.from_user_id
      statusMap.set(otherId, {
        status: row.status as string,
        direction: row.from_user_id === req.userId ? "sent" : "received",
      })
    }

    const members = candidatesResult.rows
      .map((row) => {
        const clubs = toStringArray(row.clubs)
        if (!memberMatchesClub(clubs, allClubTerms)) {
          return null
        }

        const interests = toStringArray(row.interests)
        const skills = toStringArray(row.skills)
        const lookingFor = toStringArray(row.looking_for)
        const reasons: string[] = []
        let score = 1

        const skillMatches = skills.filter((skill) => {
          const tokens = tokenizeTopic(skill)
          return Array.from(topicTokens).some((token) => tokens.has(token))
        })
        if (skillMatches.length > 0) {
          score += 4 + Math.min(skillMatches.length, 2)
          reasons.push(`skills: ${skillMatches.slice(0, 2).join(", ")}`)
        }

        const interestMatches = interests.filter((interest) => {
          const tokens = tokenizeTopic(interest)
          return Array.from(topicTokens).some((token) => tokens.has(token))
        })
        if (interestMatches.length > 0) {
          score += 2 + Math.min(interestMatches.length, 2)
          reasons.push(`interests: ${interestMatches.slice(0, 2).join(", ")}`)
        }

        const lookingForMatches = lookingFor.filter((item) => {
          const tokens = tokenizeTopic(item)
          return Array.from(topicTokens).some((token) => tokens.has(token))
        })
        if (lookingForMatches.length > 0) {
          score += 2
          reasons.push(`also looking for: ${lookingForMatches.slice(0, 2).join(", ")}`)
        }

        if (me.major && row.major && String(me.major).trim().toLowerCase() === String(row.major).trim().toLowerCase()) {
          score += 2
          reasons.push(`same major: ${row.major}`)
        }

        const sharedInterests = interests.filter((interest) => toStringArray(me.interests).includes(interest))
        if (sharedInterests.length > 0) {
          score += 2
          reasons.push(`shared interests: ${sharedInterests.slice(0, 2).join(", ")}`)
        }

        const sharedSkills = skills.filter((skill) => toStringArray(me.skills).includes(skill))
        if (sharedSkills.length > 0) {
          score += 2
          reasons.push(`shared skills: ${sharedSkills.slice(0, 2).join(", ")}`)
        }

        const sharedOtherClubs = clubs.filter((club) =>
          toStringArray(me.clubs).includes(club) && normalizeClubText(club) !== normalizeClubText(rawClubName)
        )
        if (sharedOtherClubs.length > 0) {
          score += 1
          reasons.push(`shared clubs: ${sharedOtherClubs.slice(0, 2).join(", ")}`)
        }

        const connection = statusMap.get(row.id)
        return {
          user_id: row.id,
          name: row.name,
          major: row.major,
          year: row.year,
          graduation_year: row.graduation_year,
          clubs,
          interests,
          skills,
          looking_for: lookingFor,
          bio: row.bio ?? "",
          score,
          match_reasons: reasons,
          connection_status: connection?.status ?? null,
          connection_direction: connection?.direction ?? null,
        }
      })
      .filter((member): member is NonNullable<typeof member> => member !== null)
      .sort((a, b) => {
        const aConnected = a.connection_status === "accepted" ? 1 : 0
        const bConnected = b.connection_status === "accepted" ? 1 : 0
        if (aConnected !== bConnected) return aConnected - bConnected
        const aPending = a.connection_status === "pending" ? 1 : 0
        const bPending = b.connection_status === "pending" ? 1 : 0
        if (aPending !== bPending) return aPending - bPending
        if (a.score !== b.score) return b.score - a.score
        return (a.name ?? "").localeCompare(b.name ?? "")
      })
      .slice(0, limit)

    res.json({
      club_name: rawClubName,
      topic: topic || null,
      members,
    })
  } catch (err) {
    console.error("Club members lookup error:", err)
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
