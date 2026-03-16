// Adds sample nodes to Neo4j for testing the graph.
// Run with: node seed-neo4j.mjs
// Safe to re-run — uses MERGE so it won't create duplicates.

import neo4j from "neo4j-driver"
import pkg from "pg"
import bcrypt from "bcryptjs"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import path from "path"

const { Pool } = pkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, ".env") })

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
)

const session = driver.session()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ── Edit these to add your own test data ──────────────────────────────────────

const students = [
  {
    id: "student-31", label: "Alex Iglesias", type: "student", interests: ["Startps", "Project Management"],
    major: "Civil Engineering", gpa: 3.2, graduationYear: 2028,
    clubs: ["Society of Hispanic Professional Engineers", "American Society of Civil Engineers"],
    companies: ["Gilbane"]
  },
  {
    id: "student-32", label: "Pablo Leyva", type: "student", interests: ["Agentic AI", "Entrepreneurship", "Startups", "Philosophy", "Rhetoric", "Politics"],
    major: "Applied Mathmatics", gpa: 3.0, graduationYear: 2027,
    clubs: ["Society of Hispanic Professional Engineers"], companies: ["Apple", "Angeles Ventures", "Caterpillar Inc.", "Rex AI"]
  },
  {
    id: "student-33", label: "Alejandro Perdomo", type: "student", interests: ["Artificial Intelligence", "Financial Technology", "Computer Vision", "Machine Learning"],
    major: "Computer Science", gpa: 3.8, graduationYear: 2027,
    clubs: ["Society of Hispanic Professional Engineers", "Hispanic and Latine Association of Computing College Students"], companies: ["Angeles Ventures"]
  },
  {
    id: "student-34", label: "Shane L. Singh", type: "student", interests: ["Automotive", "Defense"],
    major: "Mechanical Engineering", gpa: 3.3, graduationYear: 2029,
    clubs: ["Society of Hispanic Professional Engineers"], companies: []
  },
]

// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  try {
    console.log("Seeding Neo4j...\n")

    // Students + relationships
    for (const s of students) {
      await session.run(
        `MERGE (n:Student {id: $id})
         SET n.label = $label, n.type = $type,
             n.major = $major, n.gpa = $gpa, n.graduationYear = $graduationYear,
             n.interests = $interests`,
        { id: s.id, label: s.label, type: s.type,
          major: s.major, gpa: s.gpa, graduationYear: s.graduationYear,
          interests: s.interests }
      )
      for (const clubName of s.clubs) {
        await session.run(
          `MERGE (c:Club {type: 'club', label: $clubName})
             ON CREATE SET c.id = 'club-' + toLower(replace($clubName, ' ', '-'))
           WITH c MATCH (s:Student {id: $sid})
           MERGE (s)-[:MEMBER_OF]->(c)`,
          { sid: s.id, clubName }
        )
      }
      for (const companyName of s.companies) {
        await session.run(
          `MERGE (c:Company {type: 'company', normalizedName: toLower($companyName)})
             ON CREATE SET c.id = 'company-' + toLower(replace($companyName, ' ', '-')),
                           c.label = $companyName
           WITH c MATCH (s:Student {id: $sid})
           MERGE (s)-[:WORKS_AT]->(c)`,
          { sid: s.id, companyName }
        )
      }
      console.log("Student:", s.label, "| clubs:", s.clubs, "| companies:", s.companies)
    }

    // Build interest → student IDs map, then create Interest nodes for shared interests only
    console.log("\nProcessing shared interests...")
    const interestMap = {}
    for (const s of students) {
      for (const interest of s.interests) {
        if (!interestMap[interest]) interestMap[interest] = []
        interestMap[interest].push(s.id)
      }
    }
    for (const [interest, ids] of Object.entries(interestMap)) {
      if (ids.length >= 2) {
        await session.run(
          `MERGE (i:Interest {type: 'interest', label: $interest})
             ON CREATE SET i.id = 'interest-' + toLower(replace($interest, ' ', '-'))`,
          { interest }
        )
        for (const sid of ids) {
          await session.run(
            `MATCH (s:Student {id: $sid}), (i:Interest {type: 'interest', label: $interest})
             MERGE (s)-[:INTERESTED_IN]->(i)`,
            { sid, interest }
          )
        }
        console.log(`  Interest node: "${interest}" → ${ids.length} students`)
      }
    }

    // ── Seed PostgreSQL (students only) ─────────────────────────────────────
    console.log("\nSeeding PostgreSQL...")
    const passwordHash = await bcrypt.hash("Welcome1!", 10)

    for (const s of students) {
      // Generate email from name: "Michael Minchala" → "michael.minchala@njit.edu"
      const email = s.label.toLowerCase().replace(/\s+/g, ".") + "@njit.edu"
      await pool.query(
        `INSERT INTO users
           (id, email, name, password_hash, major, gpa, graduation_year, clubs, companies, interests, graph_node_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [
          s.id, email, s.label, passwordHash,
          s.major, s.gpa, s.graduationYear,
          s.clubs, s.companies, s.interests,
          s.id
        ]
      )
      console.log(`  PG: ${s.label} → ${email}`)
    }

    console.log("\nDone. Refresh the graph page to see the new nodes.")
  } catch (e) {
    console.error("Error:", e.message)
  } finally {
    await session.close()
    await driver.close()
    await pool.end()
  }
}

seed()
