import dotenv from "dotenv"
import { fileURLToPath } from "url"
import path from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, "../../.env") })

import { db } from "../config/postgres.js"
import fs from "fs"

async function migrate() {
  const sql = fs.readFileSync(
    path.resolve(__dirname, "migrations/002_auth.sql"),
    "utf8"
  )
  try {
    await db.query(sql)
    console.log("Migration 002_auth.sql applied successfully")
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("already exists")) {
      console.log("Already migrated, skipping")
    } else {
      console.error("Migration failed:", message)
      process.exit(1)
    }
  } finally {
    await db.end()
  }
}

migrate()
