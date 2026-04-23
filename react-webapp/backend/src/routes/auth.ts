import { Router, Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { createClerkClient } from "@clerk/backend"
import { db } from "../config/postgres.js"
import { requireAuth, AuthRequest } from "../middlewear/auth.js"
import { createStudentNode, updateStudentNode } from "../services/graphService.js"
import { verifyClerkSessionToken } from "../utils/clerkToken.js"
import { syncRateLimiter, profileUpdateRateLimiter } from "../middlewear/authRateLimit.js"
import {
  requireSafeId,
  sanitizeOptionalHttpsUrl,
  sanitizeStringArray,
  sanitizeText,
} from "../middlewear/security.js"

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

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
  return sanitizeStringArray(value, 80, 50)
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
    console.warn("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "missing_token", ip: req.ip })
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  let clerkId: string
  try {
    const payload = await verifyClerkSessionToken(token)
    clerkId = payload.sub
  } catch (error) {
    console.error("Clerk token verification failed in /api/auth/sync:", error)
    console.warn("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "invalid_token", ip: req.ip })
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

  const normalizedEmail = sanitizeText(clerkEmail, 254).toLowerCase()
  const normalizedName = sanitizeText(name, 120)
  if (!normalizedEmail || !normalizedEmail.endsWith("@njit.edu")) {
    console.warn("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "invalid_email_domain", ip: req.ip })
    res.status(400).json({ error: "Only @njit.edu addresses are allowed" })
    return
  }

  try {
    const existing = await db.query("SELECT id FROM users WHERE clerk_id = $1", [clerkId])
    if (existing.rows.length > 0) {
      console.info("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "existing_user", userId: existing.rows[0].id, ip: req.ip })
      const user = await db.query(SELECT_PROFILE, [existing.rows[0].id])
      res.json(formatUser(user.rows[0]))
      return
    }

    const legacy = await db.query(
      "SELECT id FROM users WHERE email = $1 AND clerk_id IS NULL",
      [normalizedEmail]
    )
    if (legacy.rows.length > 0) {
      await db.query("UPDATE users SET clerk_id = $1 WHERE id = $2", [clerkId, legacy.rows[0].id])
      console.info("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "legacy_linked", userId: legacy.rows[0].id, ip: req.ip })
      const user = await db.query(SELECT_PROFILE, [legacy.rows[0].id])
      res.json(formatUser(user.rows[0]))
      return
    }

    if (!normalizedName) {
      res.status(400).json({ error: "name is required" })
      return
    }

    // Legacy user reclaim handled above

    // Brand-new user — name is required; major/year can be filled in later
    if (!normalizedName) {
      res.status(400).json({ error: "name is required" }); return
    }

    // Brand-new user
    const id = uuidv4()
    const majorValue = sanitizeText(major, 120)
    const gpaValue = toNullableNumber(gpa)
    const graduationYearValue = toNullableInt(graduationYear)
    const bioValue = sanitizeText(bio, 2000)
    const clubList = toStringArray(clubs)
    const companyList = toStringArray(companies)
    const interestList = toStringArray(interests)
    const skillList = toStringArray(skills)
    const lookingForList = toStringArray(looking_for)
    const yearValue = sanitizeText(year, 30) || null
    const linkedinUrlValue = sanitizeOptionalHttpsUrl(linkedinUrl)

    const graphNodeId = await createStudentNode({
      id,
      name: normalizedName,
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
        normalizedEmail,
        normalizedName,
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
    console.info("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "new_user_created", userId: id, ip: req.ip })
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
  const safeId = requireSafeId(req.params.id)
  if (!safeId) {
    res.status(400).json({ error: "Invalid user id format" })
    return
  }
  if (safeId !== req.userId) {
    res.status(403).json({ error: "Forbidden: cannot access another user's profile directly" })
    return
  }
  try {
    const result = await db.query(SELECT_PUBLIC_PROFILE, [safeId])
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

router.get("/interests", requireAuth, async (_req: Request, res: Response) => {
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
  const { gpa, major, graduationYear, bio, clubs, companies, interests, linkedinUrl, skills, looking_for, year } = req.body

  const majorValue = sanitizeText(major, 120)
  const bioValue = sanitizeText(bio, 2000) || null
  const yearValue = sanitizeText(year, 30) || null
  if (!majorValue || !graduationYear) {
    res.status(400).json({ error: "major and graduationYear are required" })
    return
  }

  const clubList = toStringArray(clubs)
  const companyList = toStringArray(companies)
  const interestList = toStringArray(interests)
  const skillList = toStringArray(skills)
  const lookingForList = toStringArray(looking_for)
  const gpaValue = toNullableNumber(gpa)
  const graduationYearValue = toNullableInt(graduationYear)
  const linkedinUrlValue = sanitizeOptionalHttpsUrl(linkedinUrl)

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
        majorValue,
        gpaValue,
        graduationYearValue,
        bioValue,
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
      major: majorValue,
      gpa: gpaValue,
      graduationYear: graduationYearValue,
      bio: bioValue ?? "",
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
