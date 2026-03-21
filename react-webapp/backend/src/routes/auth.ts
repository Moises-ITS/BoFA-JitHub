import { Router, Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { createClerkClient, verifyToken } from "@clerk/backend"
import { db } from "../config/postgres"
import { requireAuth, AuthRequest } from "../middlewear/auth"
import { createStudentNode, updateStudentNode } from "../services/graphService"

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

async function verifyClerkToken(token: string) {
  const jwtKey = process.env.CLERK_JWT_PUBLIC_KEY
  if (jwtKey) {
    return verifyToken(token, { jwtKey })
  }
  return clerk.verifyToken(token)
}

const SELECT_PROFILE = `
  SELECT id, name, email, major, gpa, graduation_year, bio,
         clubs, companies, interests, linkedin_url
  FROM users WHERE id = $1
`

function formatUser(u: Record<string, unknown>) {
  return {
    id:             u.id,
    name:           u.name,
    email:          u.email,
    major:          u.major,
    gpa:            u.gpa,
    graduationYear: u.graduation_year,
    bio:            u.bio,
    clubs:          u.clubs,
    companies:      u.companies,
    interests:      u.interests,
    linkedinUrl:    u.linkedin_url,
  }
}

const router = Router()

// POST /api/auth/sync
// Called once after Clerk sign-up to create or reclaim the profile row.
// Does its own token verification — cannot use requireAuth (no profile row yet).
router.post("/sync", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.slice(7)
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return }

  let clerkId: string
  try {
    const payload = await verifyClerkToken(token)
    clerkId = payload.sub
  } catch { res.status(401).json({ error: "Invalid token" }); return }

  const { email: clerkEmail, name, major, gpa, graduationYear, bio, clubs, companies, interests, linkedinUrl } = req.body

  if (!clerkEmail || !clerkEmail.toLowerCase().endsWith("@njit.edu")) {
    res.status(400).json({ error: "Only @njit.edu addresses are allowed" }); return
  }

  try {
    // Already synced?
    const existing = await db.query("SELECT id FROM users WHERE clerk_id = $1", [clerkId])
    if (existing.rows.length) {
      const u = await db.query(SELECT_PROFILE, [existing.rows[0].id])
      res.json(formatUser(u.rows[0])); return
    }

    // Legacy user reclaim — same email, no clerk_id yet (no new fields needed)
    const legacy = await db.query(
      "SELECT id FROM users WHERE email = $1 AND clerk_id IS NULL", [clerkEmail]
    )
    if (legacy.rows.length) {
      await db.query("UPDATE users SET clerk_id = $1 WHERE id = $2", [clerkId, legacy.rows[0].id])
      const u = await db.query(SELECT_PROFILE, [legacy.rows[0].id])
      res.json(formatUser(u.rows[0])); return
    }

    // Brand-new user — name is required; major/year can be filled in later
    if (!name) {
      res.status(400).json({ error: "name is required" }); return
    }

    // Brand-new user
    const id = uuidv4()
    const majorVal               = major?.trim()  || ""
    const gradYearVal            = graduationYear ? parseInt(String(graduationYear)) : null
    const clubList: string[]     = clubs     ?? []
    const companyList: string[]  = companies ?? []
    const interestList: string[] = interests ?? []
    const linkedinUrlVal         = linkedinUrl?.trim() || null

    const graphNodeId = await createStudentNode({
      id, name, major: majorVal,
      gpa:          gpa ?? null,
      graduationYear: gradYearVal,
      bio:          bio ?? "",
      clubs:        clubList,
      companies:    companyList,
      interests:    interestList,
      linkedinUrl:  linkedinUrlVal,
    })

    await db.query(
      `INSERT INTO users
         (id, email, name, major, gpa, graduation_year, bio, clubs,
          companies, interests, graph_node_id, linkedin_url, clerk_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, clerkEmail, name, majorVal, gpa ?? null, gradYearVal, bio ?? null,
       clubList, companyList, interestList, graphNodeId, linkedinUrlVal, clerkId]
    )

    const u = await db.query(SELECT_PROFILE, [id])
    res.status(201).json(formatUser(u.rows[0]))
  } catch (err) {
    console.error("Sync error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/auth/me — returns current user from Bearer token
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(SELECT_PROFILE, [req.userId])
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }
    res.json(formatUser(result.rows[0]))
  } catch (err) {
    console.error("Me error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/auth/users/:id/profile — public profile for any authenticated user
router.get("/users/:id/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  try {
    const result = await db.query(
      `SELECT id, name, major, graduation_year, bio, clubs, companies, interests, linkedin_url
       FROM users WHERE id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }
    const u = result.rows[0]
    res.json({
      id:             u.id,
      name:           u.name,
      major:          u.major,
      graduationYear: u.graduation_year,
      bio:            u.bio,
      clubs:          u.clubs ?? [],
      companies:      u.companies ?? [],
      interests:      u.interests ?? [],
      linkedinUrl:    u.linkedin_url,
    })
  } catch (err) {
    console.error("Profile fetch error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/auth/interests
router.get("/interests", async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT unnest(interests) AS interest FROM users
       WHERE array_length(interests, 1) > 0
       ORDER BY interest`
    )
    res.json(result.rows.map((r: { interest: string }) => r.interest).filter(Boolean))
  } catch {
    res.json([])
  }
})

// PUT /api/auth/profile
router.put("/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  const { gpa, major, graduationYear, bio, clubs, companies, interests, linkedinUrl } = req.body

  if (!major || !graduationYear) {
    res.status(400).json({ error: "major and graduationYear are required" })
    return
  }

  const clubList: string[]     = clubs     ?? []
  const companyList: string[]  = companies ?? []
  const interestList: string[] = interests ?? []
  const gpaVal                 = gpa ?? null
  const linkedinUrlVal         = linkedinUrl?.trim() || null

  try {
    const existing = await db.query("SELECT name FROM users WHERE id = $1", [req.userId])
    if (existing.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }

    await db.query(
      `UPDATE users SET major=$1, gpa=$2, graduation_year=$3, bio=$4, clubs=$5, companies=$6, interests=$7, linkedin_url=$8
       WHERE id=$9`,
      [major, gpaVal, graduationYear, bio ?? null, clubList, companyList, interestList, linkedinUrlVal, req.userId]
    )

    await updateStudentNode({
      id:          req.userId!,
      name:        existing.rows[0].name,
      major, gpa: gpaVal, graduationYear,
      bio:         bio ?? "",
      clubs:       clubList,
      companies:   companyList,
      interests:   interestList,
      linkedinUrl: linkedinUrlVal,
    })

    const updated = await db.query(SELECT_PROFILE, [req.userId])
    res.json(formatUser(updated.rows[0]))
  } catch (err) {
    console.error("Profile update error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
