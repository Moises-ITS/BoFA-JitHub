import pg from "pg"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, ".env") })

const db = new pg.Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:      false,
})

try {
  await db.query(`
    ALTER TABLE users
      ALTER COLUMN id            TYPE character varying,
      ALTER COLUMN email         TYPE character varying,
      ALTER COLUMN name          TYPE character varying,
      ALTER COLUMN graph_node_id TYPE character varying,
      ALTER COLUMN created_at    TYPE TIMESTAMP USING created_at::timestamp
  `)
  console.log("Schema fixed successfully")
} catch (e) {
  console.error("Failed:", e.message)
} finally {
  await db.end()
}
