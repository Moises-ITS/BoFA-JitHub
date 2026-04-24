import { Pool } from "pg"

export const db = new Pool({
  host:     process.env.DB_HOST     ?? "shortline.proxy.rlwy.net",
  port:     Number(process.env.DB_PORT) || 35121,
  user:     process.env.DB_USER     ?? "postgres",
  password: process.env.DB_PASSWORD ?? "glItjRNsbsgrlUynrELkZWPLoxNMNzKP",
  database: process.env.DB_NAME     ?? "railway",
  ssl:      false,
})

db.connect()
  .then(client => {
    console.log("PostgreSQL connected")
    client.release()
  })
  .catch(err => console.error("PostgreSQL connection failed:", err))

// EDEN's separate Postgres — holds clubs/events/rsvps (owned by the FastAPI backend).
// Used read-only by the /api/eden/* routes to join attendance against events.
export const edenDb = new Pool({
  host:     process.env.EDEN_DB_HOST     ?? "localhost",
  port:     Number(process.env.EDEN_DB_PORT) || 5432,
  user:     process.env.EDEN_DB_USER     ?? "postgres",
  password: process.env.EDEN_DB_PASSWORD ?? "Perdomo1107!",
  database: process.env.EDEN_DB_NAME     ?? "eden",
  ssl:      false,
})
