import { Pool } from "pg"

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

db.connect()
  .then(client => {
    console.log("PostgreSQL connected")
    client.release()
  })
  .catch(err => console.error("PostgreSQL connection failed:", err))
