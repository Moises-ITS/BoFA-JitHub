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
