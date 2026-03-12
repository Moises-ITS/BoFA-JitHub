import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"
import { db } from "../config/postgres"
import { requireAuth, AuthRequest } from "../middlewear/auth"
import { createStudentNode } from "../services/graphService"

const router = Router()

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  const { name, email, password, major, gpa, graduationYear, bio, clubs, companies } = req.body

  if (!name || !email || !password || !major || !graduationYear) {
    res.status(400).json({ error: "name, email, password, major, and graduationYear are required" })
    return
  }

  try {
    // Check if email already exists
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email])
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "An account with that email already exists" })
      return
    }

    const id = uuidv4()
    const passwordHash = await bcrypt.hash(password, 12)
    const clubList: string[]    = clubs    ?? []
    const companyList: string[] = companies ?? []

    // Create student node in Neo4j first to get the graph_node_id
    const graphNodeId = await createStudentNode({
      id,
      name,
      major,
      gpa: gpa ?? null,
      graduationYear,
      bio: bio ?? "",
      clubs: clubList,
      companies: companyList,
    })

    // Insert into PostgreSQL
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, major, gpa, graduation_year, bio, clubs, companies, graph_node_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, email, name, passwordHash, major, gpa ?? null, graduationYear, bio ?? null, clubList, companyList, graphNodeId]
    )

    const token = jwt.sign({ userId: id }, process.env.JWT_SECRET!, { expiresIn: "7d" })
    res.status(201).json({
      token,
      user: { id, name, email, major, gpa, graduationYear, bio, clubs: clubList, companies: companyList },
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
      "SELECT id, name, email, password_hash, major, gpa, graduation_year, bio, clubs, companies FROM users WHERE email = $1",
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
      },
    })
  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/auth/me — returns current user from token
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, major, gpa, graduation_year, bio, clubs, companies FROM users WHERE id = $1",
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
    })
  } catch (err) {
    console.error("Me error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
