// Run with: node test-connection.mjs
// Make sure backend is running in another terminal first (npm run dev)

import pg from "pg"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, ".env") })

const BASE = "http://localhost:3001"

const db = new pg.Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:      false,
})

async function run() {
  // 1. Direct DB connection
  console.log("\n=== 1. PostgreSQL connection ===")
  try {
    const res = await db.query("SELECT NOW() AS time, current_database() AS db")
    console.log("Connected to:", res.rows[0].db, "at", res.rows[0].time)
  } catch (e) {
    console.error("FAILED:", e.message)
    process.exit(1)
  }

  // 2. Show actual column types
  console.log("\n=== 2. Users table columns ===")
  try {
    const res = await db.query(
      "SELECT column_name, data_type, character_maximum_length " +
      "FROM information_schema.columns " +
      "WHERE table_name = 'users' ORDER BY ordinal_position"
    )
    for (const row of res.rows) {
      const len = row.character_maximum_length ? "(" + row.character_maximum_length + ")" : ""
      console.log(" " + row.column_name.padEnd(22) + row.data_type + len)
    }
  } catch (e) {
    console.error("FAILED:", e.message)
  }

  // 3. Health check
  console.log("\n=== 3. Backend health check ===")
  try {
    const r = await fetch(BASE + "/health")
    const data = await r.json()
    console.log(r.ok ? "OK:" : "FAILED:", JSON.stringify(data))
  } catch (e) {
    console.error("FAILED (is the backend running on port 3001?):", e.message)
    await db.end()
    return
  }

  // 4. Signup a test user
  console.log("\n=== 4. Signup test user ===")
  const testEmail = "test_" + Date.now() + "@example.com"
  let token = null
  let userId = null
  try {
    const r = await fetch(BASE + "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: testEmail,
        password: "testpassword123",
        major: "Computer Science",
        gpa: 3.5,
        graduationYear: 2027,
        bio: "Test bio",
        clubs: [],
        companies: []
      })
    })
    const data = await r.json()
    if (r.ok) {
      token  = data.token
      userId = data.user.id
      console.log("Created user:", data.user.name)
      console.log("User ID:     ", userId)
      console.log("JWT token:   ", token ? "received" : "MISSING")
    } else {
      console.error("FAILED:", data.error)
    }
  } catch (e) {
    console.error("FAILED:", e.message)
  }

  // 5. Verify token with /me
  if (token) {
    console.log("\n=== 5. GET /api/auth/me ===")
    try {
      const r = await fetch(BASE + "/api/auth/me", {
        headers: { "Authorization": "Bearer " + token }
      })
      const data = await r.json()
      if (r.ok) {
        console.log("Name:", data.name, "| Major:", data.major, "| GPA:", data.gpa)
      } else {
        console.error("FAILED:", data.error)
      }
    } catch (e) {
      console.error("FAILED:", e.message)
    }

    // 6. Cleanup
    console.log("\n=== 6. Cleanup ===")
    try {
      await db.query("DELETE FROM users WHERE email LIKE 'test_%@example.com'")
      console.log("Test user deleted from PostgreSQL")
    } catch (e) {
      console.error("Cleanup failed:", e.message)
    }
  }

  await db.end()
  console.log("\nDone.")
}

run()
