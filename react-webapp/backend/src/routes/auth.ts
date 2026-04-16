import { Router, Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { db } from "../config/postgres"
import { requireAuth, AuthRequest } from "../middlewear/auth"
import { createStudentNode, updateStudentNode } from "../services/graphService"
import { verifyClerkSessionToken } from "../utils/clerkToken"
import { syncRateLimiter, profileUpdateRateLimiter } from "../middlewear/authRateLimit"

const SELECT_PROFILE = `
  SELECT id, name, email, major, gpa, graduation_year, bio,
         clubs, companies, interests, linkedin_url, skills, looking_for, year
  FROM users WHERE id = $1
`

const SELECT_PUBLIC_PROFILE = `
  SELECT id, name, major, graduation_year, bio,
         clubs, companies, interests, linkedin_url, skills, looking_for, year
  FROM users WHERE id = $1
`

function formatUser(user: Record<string, unknown>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    major: user.major,
    gpa: user.gpa,
    graduationYear: user.graduation_year,
    bio: user.bio,
    clubs: (user.clubs as string[] | null) ?? [],
    companies: (user.companies as string[] | null) ?? [],
    interests: (user.interests as string[] | null) ?? [],
    linkedinUrl: user.linkedin_url,
    skills: (user.skills as string[] | null) ?? [],
    looking_for: (user.looking_for as string[] | null) ?? [],
    year: (user.year as string | null) ?? null,
  }
}

function formatPublicProfile(user: Record<string, unknown>) {
  return {
    id: user.id,
    name: user.name,
    major: user.major,
    graduationYear: user.graduation_year,
    bio: user.bio,
    clubs: (user.clubs as string[] | null) ?? [],
    companies: (user.companies as string[] | null) ?? [],
    interests: (user.interests as string[] | null) ?? [],
    linkedinUrl: user.linkedin_url,
    skills: (user.skills as string[] | null) ?? [],
    looking_for: (user.looking_for as string[] | null) ?? [],
    year: (user.year as string | null) ?? null,
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isNaN(parsed) ? null : parsed
}

const router = Router()

router.post("/sync", syncRateLimiter, async (req: Request, res: Response) => {
  const token = req.headers.authorization?.slice(7)
  if (!token) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  let clerkId: string
  try {
    const payload = await verifyClerkSessionToken(token)
    clerkId = payload.sub
  } catch (error) {
    console.error("Clerk token verification failed in /api/auth/sync:", error)
    res.status(401).json({ error: "Invalid token" })
    return
  }

  const {
    email: clerkEmail,
    name,
    major,
    gpa,
    graduationYear,
    bio,
    clubs,
    companies,
    interests,
    linkedinUrl,
    skills,
    looking_for,
    year,
  } = req.body

  if (!clerkEmail || !String(clerkEmail).toLowerCase().endsWith("@njit.edu")) {
    res.status(400).json({ error: "Only @njit.edu addresses are allowed" })
    return
  }

  try {
    const existing = await db.query("SELECT id FROM users WHERE clerk_id = $1", [clerkId])
    if (existing.rows.length > 0) {
      const user = await db.query(SELECT_PROFILE, [existing.rows[0].id])
      res.json(formatUser(user.rows[0]))
      return
    }

    const legacy = await db.query(
      "SELECT id FROM users WHERE email = $1 AND clerk_id IS NULL",
      [clerkEmail]
    )
    if (legacy.rows.length > 0) {
      await db.query("UPDATE users SET clerk_id = $1 WHERE id = $2", [clerkId, legacy.rows[0].id])
      const user = await db.query(SELECT_PROFILE, [legacy.rows[0].id])
      res.json(formatUser(user.rows[0]))
      return
    }

    if (!name) {
      res.status(400).json({ error: "name is required" })
      return
    }

    const id = uuidv4()
    const majorValue = typeof major === "string" ? major.trim() : ""
    const gpaValue = toNullableNumber(gpa)
    const graduationYearValue = toNullableInt(graduationYear)
    const bioValue = typeof bio === "string" ? bio : ""
    const clubList = toStringArray(clubs)
    const companyList = toStringArray(companies)
    const interestList = toStringArray(interests)
    const skillList = toStringArray(skills)
    const lookingForList = toStringArray(looking_for)
    const yearValue = typeof year === "string" && year.trim() ? year.trim() : null
    const linkedinUrlValue =
      typeof linkedinUrl === "string" && linkedinUrl.trim() ? linkedinUrl.trim() : null

    const graphNodeId = await createStudentNode({
      id,
      name,
      major: majorValue,
      gpa: gpaValue,
      graduationYear: graduationYearValue,
      bio: bioValue,
      clubs: clubList,
      companies: companyList,
      interests: interestList,
      linkedinUrl: linkedinUrlValue,
    })

    await db.query(
      `INSERT INTO users
         (id, email, name, major, gpa, graduation_year, bio, clubs,
          companies, interests, graph_node_id, linkedin_url, skills,
          looking_for, year, clerk_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        id,
        clerkEmail,
        name,
        majorValue,
        gpaValue,
        graduationYearValue,
        bioValue || null,
        clubList,
        companyList,
        interestList,
        graphNodeId,
        linkedinUrlValue,
        skillList,
        lookingForList,
        yearValue,
        clerkId,
      ]
    )

    const user = await db.query(SELECT_PROFILE, [id])
    res.status(201).json(formatUser(user.rows[0]))
  } catch (err) {
    console.error("Sync error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

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

router.get("/users/:id/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(SELECT_PUBLIC_PROFILE, [req.params.id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }
    res.json(formatPublicProfile(result.rows[0]))
  } catch (err) {
    console.error("Profile fetch error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.get("/interests", async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT unnest(interests) AS interest FROM users
       WHERE array_length(interests, 1) > 0
       ORDER BY interest`
    )
    res.json(result.rows.map((row: { interest: string }) => row.interest).filter(Boolean))
  } catch {
    res.json([])
  }
})

router.put("/profile", requireAuth, profileUpdateRateLimiter, async (req: AuthRequest, res: Response) => {
  const {
    gpa,
    major,
    graduationYear,
    bio,
    clubs,
    companies,
    interests,
    linkedinUrl,
    skills,
    looking_for,
    year,
  } = req.body

  if (!major || !graduationYear) {
    res.status(400).json({ error: "major and graduationYear are required" })
    return
  }

  const clubList = toStringArray(clubs)
  const companyList = toStringArray(companies)
  const interestList = toStringArray(interests)
  const skillList = toStringArray(skills)
  const lookingForList = toStringArray(looking_for)
  const yearValue = typeof year === "string" && year.trim() ? year.trim() : null
  const gpaValue = toNullableNumber(gpa)
  const graduationYearValue = toNullableInt(graduationYear)
  const linkedinUrlValue =
    typeof linkedinUrl === "string" && linkedinUrl.trim() ? linkedinUrl.trim() : null

  if (graduationYearValue === null) {
    res.status(400).json({ error: "graduationYear must be a valid year" })
    return
  }

  try {
    const existing = await db.query("SELECT name FROM users WHERE id = $1", [req.userId])
    if (existing.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }

    await db.query(
      `UPDATE users
       SET major = $1,
           gpa = $2,
           graduation_year = $3,
           bio = $4,
           clubs = $5,
           companies = $6,
           interests = $7,
           linkedin_url = $8,
           skills = $9,
           looking_for = $10,
           year = $11
       WHERE id = $12`,
      [
        major,
        gpaValue,
        graduationYearValue,
        typeof bio === "string" ? bio : null,
        clubList,
        companyList,
        interestList,
        linkedinUrlValue,
        skillList,
        lookingForList,
        yearValue,
        req.userId,
      ]
    )

    await updateStudentNode({
      id: req.userId!,
      name: existing.rows[0].name,
      major,
      gpa: gpaValue,
      graduationYear: graduationYearValue,
      bio: typeof bio === "string" ? bio : "",
      clubs: clubList,
      companies: companyList,
      interests: interestList,
      linkedinUrl: linkedinUrlValue,
    })

    const updated = await db.query(SELECT_PROFILE, [req.userId])
    res.json(formatUser(updated.rows[0]))
  } catch (err) {
    console.error("Profile update error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
