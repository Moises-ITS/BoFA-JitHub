import { Router, Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { createClerkClient } from "@clerk/backend"
import { db } from "../config/postgres.js"
import { requireAuth, AuthRequest } from "../middleware/auth.js"
import {
  createStudentNode,
  deleteStudentNode,
  updateStudentNode,
  createProfessorNode,
  updateProfessorNode,
} from "../services/graphService.js"
import { safeGraphWrite } from "../services/graphService.js"
import { verifyClerkSessionToken, getClerkVerifiedPrimaryEmail } from "../utils/clerkToken.js"
import { syncRateLimiter, profileUpdateRateLimiter } from "../middleware/authRateLimit.js"
import {
  requireSafeId,
  sanitizeOptionalHttpsUrl,
  sanitizeStringArray,
  sanitizeText,
} from "../middleware/security.js"
import { generateSessionToken } from "../utils/customToken.js"
import bcrypt from "bcryptjs"

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

// One query fetches everything; what the CLIENT sees is decided by the
// formatter below, never by which SQL string a route happened to use. Two
// near-identical SELECTs + two near-identical formatters previously had to be
// kept in sync by hand — adding a column meant editing four places, and
// forgetting one silently dropped the field from some responses.
const SELECT_PROFILE = `
  SELECT id, name, email, major, gpa, graduation_year, bio,
         clubs, companies, interests, linkedin_url, skills, looking_for, year, user_type, department
  FROM users WHERE id = $1
`

/**
 * Maps a DB row to the API response shape.
 *
 * SECURITY DESIGN: this is an explicit ALLOWLIST — fields are copied one by
 * one, never spread (`...user`), so a new DB column (password hash, admin
 * flag, ...) can never leak into a response by accident. `includePrivate`
 * gates the fields only the account owner may see (email, gpa): /me passes
 * true; the public profile route passes false.
 */
function formatUser(user: Record<string, unknown>, { includePrivate }: { includePrivate: boolean }) {
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
    userType: user.user_type,
    department: user.department,
    ...(includePrivate ? { email: user.email, gpa: user.gpa } : {}),
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

router.post("/register-custom", async (req: Request, res: Response) => {
  const { name, email, password, userType, department, interest } = req.body

  if (!name || !email || !password || !userType) {
    res.status(400).json({ error: "Name, email, password and user type are required" })
    return
  }

  if (userType !== "guest" && userType !== "professor") {
    res.status(400).json({ error: "Invalid user type" })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    res.status(400).json({ error: "A valid email is required" })
    return
  }

  try {
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [normalizedEmail])
    if (existing.rows.length > 0) {
      res.status(400).json({ error: "Email already registered" })
      return
    }

    const id = uuidv4()
    const passwordHash = await bcrypt.hash(password, 10)
    const departmentValue = department ? sanitizeText(department, 120) : null
    
    // Support either single string or array of strings for interests/interest
    const interestList = interest 
      ? (Array.isArray(interest) ? interest : [interest]).map(i => sanitizeText(i, 80)) 
      : []

    // Postgres FIRST — it owns identity. The graph projection is attempted
    // afterwards and is allowed to fail; see safeGraphWrite() for the full
    // reasoning. graph_node_id starts NULL and is only set once the projection
    // actually lands, which is what makes it a reliable reconciliation marker.
    await db.query(
      `INSERT INTO users
         (id, email, name, password_hash, user_type, department, interests, graph_node_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
      [
        id,
        normalizedEmail,
        name.trim(),
        passwordHash,
        userType,
        departmentValue,
        interestList,
      ]
    )

    // Guests are deliberately absent from the graph — they are not discoverable
    // and have no connections, so there is nothing to project.
    if (userType === "professor") {
      const graphNodeId = await safeGraphWrite(
        { op: "createProfessorNode", userId: id },
        () => createProfessorNode({
          id,
          name: name.trim(),
          department: departmentValue || "",
          interests: interestList,
        })
      )
      if (graphNodeId) {
        await db.query("UPDATE users SET graph_node_id = $1 WHERE id = $2", [graphNodeId, id])
      }
    }

    const userResult = await db.query(SELECT_PROFILE, [id])
    const token = generateSessionToken(id)
    res.status(201).json({
      token,
      user: formatUser(userResult.rows[0], { includePrivate: true }),
    })
  } catch (err) {
    console.error("Custom registration error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.post("/login-custom", async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    const result = await db.query(
      "SELECT id, password_hash FROM users WHERE email = $1 AND (user_type = 'guest' OR user_type = 'professor')",
      [normalizedEmail]
    )

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    const { id, password_hash } = result.rows[0]
    if (!password_hash) {
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    const match = await bcrypt.compare(password, password_hash)
    if (!match) {
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    const userResult = await db.query(SELECT_PROFILE, [id])
    const token = generateSessionToken(id)
    res.json({
      token,
      user: formatUser(userResult.rows[0], { includePrivate: true }),
    })
  } catch (err) {
    console.error("Custom login error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.post("/sync", syncRateLimiter, async (req: Request, res: Response) => {
  const token = req.headers.authorization?.slice(7)
  if (!token) {
    console.warn("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "missing_token", ip: req.ip })
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  let clerkId: string
  try {
    const payload = await verifyClerkSessionToken(token, req.headers.origin)
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
      res.json(formatUser(user.rows[0], { includePrivate: true }))
      return
    }

    // Link decisions run on the Clerk-VERIFIED primary email, not the body
    // email — see getClerkVerifiedPrimaryEmail. This also reclaims rows whose
    // clerk_id points at a PREVIOUS Clerk instance: matching only
    // `clerk_id IS NULL` here once 500'd on users_email_key for every existing
    // user after a production instance swap, stranding them at setup.
    const verifiedEmail = await getClerkVerifiedPrimaryEmail(clerkId)
    const linkEmail = verifiedEmail ?? normalizedEmail
    const legacy = await db.query(
      "SELECT id, clerk_id FROM users WHERE email = $1",
      [linkEmail]
    )
    if (legacy.rows.length > 0) {
      const row = legacy.rows[0]
      const stale = row.clerk_id !== null // != clerkId too, or the lookup above would have matched
      if (stale && !verifiedEmail) {
        // The row belongs to a different Clerk identity and Clerk couldn't
        // confirm the caller owns this address — refuse rather than hand the
        // row over on a client-supplied email.
        console.warn("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "relink_unverified_refused", ip: req.ip })
        res.status(409).json({ error: "Account already linked" })
        return
      }
      await db.query("UPDATE users SET clerk_id = $1 WHERE id = $2", [clerkId, row.id])
      console.info("[security][auth-attempt]", { route: "/api/auth/sync", outcome: stale ? "stale_clerk_relinked" : "legacy_linked", userId: row.id, ip: req.ip })
      const user = await db.query(SELECT_PROFILE, [row.id])
      res.json(formatUser(user.rows[0], { includePrivate: true }))
      return
    }

    // Brand-new user — name is required; everything else can be filled in later
    if (!normalizedName) {
      res.status(400).json({ error: "name is required" })
      return
    }

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

    // Postgres FIRST. This route is the ONLY thing standing between a
    // Clerk-authenticated student and a usable account — if it fails they are
    // stranded at /setup with no profile row. Neo4j must therefore never be
    // able to block it. graph_node_id stays NULL until the projection lands.
    await db.query(
      // user_type is set explicitly rather than leaning on the column default.
      // This route is the only way a Clerk student is created, and "these rows
      // are students" should be readable here, not inferred from a migration.
      `INSERT INTO users
         (id, email, name, major, gpa, graduation_year, bio, clubs,
          companies, interests, graph_node_id, linkedin_url, skills,
          looking_for, year, clerk_id, user_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,$12,$13,$14,$15,'student')`,
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
        linkedinUrlValue,
        skillList,
        lookingForList,
        yearValue,
        clerkId,
      ]
    )

    const graphNodeId = await safeGraphWrite(
      { op: "createStudentNode", userId: id },
      () => createStudentNode({
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
    )
    if (graphNodeId) {
      await db.query("UPDATE users SET graph_node_id = $1 WHERE id = $2", [graphNodeId, id])
    }

    const user = await db.query(SELECT_PROFILE, [id])
    console.info("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "new_user_created", userId: id, ip: req.ip })
    res.status(201).json(formatUser(user.rows[0], { includePrivate: true }))
  } catch (err) {
    // A concurrent sync for the same email can still slip between the SELECT
    // and the INSERT; surface the constraint as a retryable conflict, not a 500.
    if ((err as { code?: string })?.code === "23505") {
      console.warn("[security][auth-attempt]", { route: "/api/auth/sync", outcome: "duplicate_email_conflict", ip: req.ip })
      res.status(409).json({ error: "An account with this email already exists" })
      return
    }
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
    res.json(formatUser(result.rows[0], { includePrivate: true }))
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
    const result = await db.query(SELECT_PROFILE, [safeId])
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }
    res.json(formatUser(result.rows[0], { includePrivate: false }))
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
  const { gpa, major, graduationYear, bio, clubs, companies, interests, linkedinUrl, skills, looking_for, year, department } = req.body

  try {
    const existing = await db.query("SELECT name, user_type FROM users WHERE id = $1", [req.userId])
    if (existing.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }

    const userType = existing.rows[0].user_type || "student"

    if (userType === "student") {
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
    } else if (userType === "professor") {
      const bioValue = sanitizeText(bio, 2000) || null
      const linkedinUrlValue = sanitizeOptionalHttpsUrl(linkedinUrl)
      const departmentValue = department ? sanitizeText(department, 120) : null
      const interestList = toStringArray(interests)

      await db.query(
        `UPDATE users
         SET department = COALESCE($1, department),
             interests = $2,
             bio = $3,
             linkedin_url = $4
         WHERE id = $5`,
        [
          departmentValue,
          interestList,
          bioValue,
          linkedinUrlValue,
          req.userId,
        ]
      )

      await updateProfessorNode({
        id: req.userId!,
        name: existing.rows[0].name,
        department: departmentValue || "",
        interests: interestList,
        bio: bioValue,
        linkedinUrl: linkedinUrlValue,
      })
    } else if (userType === "guest") {
      const bioValue = sanitizeText(bio, 2000) || null
      const linkedinUrlValue = sanitizeOptionalHttpsUrl(linkedinUrl)

      await db.query(
        `UPDATE users
         SET bio = $1,
             linkedin_url = $2
         WHERE id = $3`,
        [
          bioValue,
          linkedinUrlValue,
          req.userId,
        ]
      )
    }

    const updated = await db.query(SELECT_PROFILE, [req.userId])
    res.json(formatUser(updated.rows[0], { includePrivate: true }))
  } catch (err) {
    console.error("Profile update error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.delete("/account", requireAuth, profileUpdateRateLimiter, async (req: AuthRequest, res: Response) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  try {
    const userResult = await db.query("SELECT id, clerk_id, user_type FROM users WHERE id = $1", [userId])
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }

    const userType = userResult.rows[0].user_type || "student"
    const clerkId = userResult.rows[0].clerk_id as string | null

    if (userType === "student") {
      if (!clerkId) {
        res.status(409).json({ error: "Account is not linked to Clerk" })
        return
      }
      await clerk.users.deleteUser(clerkId)
    }

    // Guests are not added to Neo4j, but students and professors are.
    if (userType !== "guest") {
      await deleteStudentNode(userId)
    }

    const client = await db.connect()
    try {
      await client.query("BEGIN")
      await client.query("DELETE FROM user_chat_memory WHERE user_id = $1", [userId])
      await client.query("DELETE FROM user_notifications WHERE user_id = $1 OR related_user_id = $1", [userId])
      await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId])
      await client.query("DELETE FROM connection_requests WHERE from_user_id = $1 OR to_user_id = $1", [userId])
      await client.query("DELETE FROM users WHERE id = $1", [userId])
      await client.query("COMMIT")
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }

    console.info("[security][account-delete]", { userId, ip: req.ip })
    res.json({ ok: true })
  } catch (err) {
    console.error("Account deletion error:", err)
    res.status(500).json({ error: "Unable to delete account" })
  }
})

export default router
