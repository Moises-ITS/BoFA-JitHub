// Adds sample nodes to Neo4j for testing the graph.
// Run with: node seed-neo4j.mjs
// Safe to re-run — uses MERGE so it won't create duplicates.

import neo4j from "neo4j-driver"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, ".env") })

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
)

const session = driver.session()

// ── Edit these to add your own test data ──────────────────────────────────────

const clubs = [
  { id: "club-1", label: "Chess Club",        type: "club" },
  { id: "club-2", label: "Coding Club",        type: "club" },
  { id: "club-3", label: "Debate Team",        type: "club" },
  { id: "club-4", label: "Art Society",        type: "club" },
]

const companies = [
  { id: "co-1", label: "Google",     type: "company" },
  { id: "co-2", label: "Microsoft",  type: "company" },
  { id: "co-3", label: "Meta",       type: "company" },
]

const professors = [
  { id: "prof-1", label: "Dr. Smith",   type: "professor", department: "Computer Science" },
  { id: "prof-2", label: "Dr. Johnson", type: "professor", department: "Mathematics" },
]

const students = [
  {
    id: "student-test-1", label: "Alice Johnson", type: "student",
    major: "Computer Science", gpa: 3.8, graduationYear: 2026,
    clubs: ["Coding Club"], companies: ["Google"]
  },
  {
    id: "student-test-2", label: "Bob Williams", type: "student",
    major: "Mathematics", gpa: 3.5, graduationYear: 2027,
    clubs: ["Chess Club", "Debate Team"], companies: []
  },
  {
    id: "student-test-3", label: "Carol Davis", type: "student",
    major: "Art History", gpa: 3.9, graduationYear: 2025,
    clubs: ["Art Society"], companies: ["Meta"]
  },
]

// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  try {
    console.log("Seeding Neo4j...\n")

    // Clubs
    for (const c of clubs) {
      await session.run(
        "MERGE (n {id: $id}) SET n.label = $label, n.type = $type",
        c
      )
      console.log("Club:", c.label)
    }

    // Companies
    for (const c of companies) {
      await session.run(
        "MERGE (n {id: $id}) SET n.label = $label, n.type = $type",
        c
      )
      console.log("Company:", c.label)
    }

    // Professors
    for (const p of professors) {
      await session.run(
        "MERGE (n {id: $id}) SET n.label = $label, n.type = $type, n.department = $department",
        p
      )
      console.log("Professor:", p.label)
    }

    // Students + relationships
    for (const s of students) {
      await session.run(
        `MERGE (n {id: $id})
         SET n.label = $label, n.type = $type,
             n.major = $major, n.gpa = $gpa, n.graduationYear = $graduationYear`,
        { id: s.id, label: s.label, type: s.type,
          major: s.major, gpa: s.gpa, graduationYear: s.graduationYear }
      )
      for (const clubName of s.clubs) {
        await session.run(
          `MATCH (s {id: $sid}), (c {type: 'club'}) WHERE toLower(c.label) = toLower($name)
           MERGE (s)-[:MEMBER_OF]->(c)`,
          { sid: s.id, name: clubName }
        )
      }
      for (const companyName of s.companies) {
        await session.run(
          `MATCH (s {id: $sid}), (c {type: 'company'}) WHERE toLower(c.label) = toLower($name)
           MERGE (s)-[:WORKS_AT]->(c)`,
          { sid: s.id, name: companyName }
        )
      }
      console.log("Student:", s.label, "| clubs:", s.clubs, "| companies:", s.companies)
    }

    console.log("\nDone. Refresh the graph page to see the new nodes.")
  } catch (e) {
    console.error("Error:", e.message)
  } finally {
    await session.close()
    await driver.close()
  }
}

seed()
