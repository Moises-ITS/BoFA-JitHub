import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"
import { db } from "../config/postgres"
import { requireAuth, AuthRequest } from "../middlewear/auth"
import { createStudentNode, updateStudentNode } from "../services/graphService"

const router = Router()

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  const { name, email, password, major, gpa, graduationYear, bio, clubs, companies, interests, linkedinUrl } = req.body

  if (!name || !email || !password || !major || !graduationYear) {
    res.status(400).json({ error: "name, email, password, major, and graduationYear are required" })
    return
  }

  if (!email.toLowerCase().endsWith("@njit.edu")) {
    res.status(400).json({ error: "Only @njit.edu email addresses are allowed" })
    return
  }

  try {
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email])
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "An account with that email already exists" })
      return
    }

    const id = uuidv4()
    const passwordHash = await bcrypt.hash(password, 12)
    const clubList: string[]     = clubs     ?? []
    const companyList: string[]  = companies ?? []
    const interestList: string[] = interests ?? []
    const linkedinUrlVal = linkedinUrl?.trim() || null

    const graphNodeId = await createStudentNode({
      id, name, major,
      gpa: gpa ?? null,
      graduationYear,
      bio: bio ?? "",
      clubs: clubList,
      companies: companyList,
      interests: interestList,
      linkedinUrl: linkedinUrlVal,
    })

    await db.query(
      `INSERT INTO users (id, email, name, password_hash, major, gpa, graduation_year, bio, clubs, companies, interests, graph_node_id, linkedin_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, email, name, passwordHash, major, gpa ?? null, graduationYear, bio ?? null, clubList, companyList, interestList, graphNodeId, linkedinUrlVal]
    )

    const token = jwt.sign({ userId: id }, process.env.JWT_SECRET!, { expiresIn: "7d" })
    res.status(201).json({
      token,
      user: { id, name, email, major, gpa, graduationYear, bio, clubs: clubList, companies: companyList, interests: interestList, linkedinUrl: linkedinUrlVal },
    })
  } catch (err) {
    console.error("Signup error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" })
    return
  }

  try {
    const result = await db.query(
      "SELECT id, name, email, password_hash, major, gpa, graduation_year, bio, clubs, companies, interests, linkedin_url FROM users WHERE email = $1",
      [email]
    )

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" })
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        major: user.major,
        gpa: user.gpa,
        graduationYear: user.graduation_year,
        bio: user.bio,
        clubs: user.clubs,
        companies: user.companies,
        interests: user.interests,
        linkedinUrl: user.linkedin_url,
      },
    })
  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/auth/me — returns current user from Bearer token
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, major, gpa, graduation_year, bio, clubs, companies, interests, linkedin_url FROM users WHERE id = $1",
      [req.userId]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" })
      return
    }
    const u = result.rows[0]
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      major: u.major,
      gpa: u.gpa,
      graduationYear: u.graduation_year,
      bio: u.bio,
      clubs: u.clubs,
      companies: u.companies,
      interests: u.interests,
      linkedinUrl: u.linkedin_url,
    })
  } catch (err) {
    console.error("Me error:", err)
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
      id: req.userId!,
      name: existing.rows[0].name,
      major, gpa: gpaVal, graduationYear,
      bio: bio ?? "",
      clubs: clubList,
      companies: companyList,
      interests: interestList,
      linkedinUrl: linkedinUrlVal,
    })

    const updated = await db.query(
      "SELECT id, name, email, major, gpa, graduation_year, bio, clubs, companies, interests, linkedin_url FROM users WHERE id=$1",
      [req.userId]
    )
    const u = updated.rows[0]
    res.json({
      id: u.id, name: u.name, email: u.email, major: u.major, gpa: u.gpa,
      graduationYear: u.graduation_year, bio: u.bio,
      clubs: u.clubs, companies: u.companies, interests: u.interests,
      linkedinUrl: u.linkedin_url,
    })
  } catch (err) {
    console.error("Profile update error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
