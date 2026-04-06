import { fileURLToPath } from "url"
import path from "path"
import dotenv from "dotenv"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

// Dynamic imports ensure dotenv runs before any module that reads process.env
const [
  expressModule,
  { default: cors },
  { db },
  ,
  graphMod,
  authMod,
  connMod,
  oppMod,
  chatMemMod,
  buildingsMod,
  { startScheduler },
  { runMigrations },
  { ensureNodeIds },
] = await Promise.all([
  import("express"),
  import("cors"),
  import("./config/postgres.js"),
  import("./config/neo4j.js"),
  import("./routes/graph.js"),
  import("./routes/auth.js"),
  import("./routes/connections.js"),
  import("./routes/opportunities.js"),
  import("./routes/chatMemory.js"),
  import("./routes/buildings.js"),
  import("./scrapers/runner.js"),
  import("./db/migrate.js"),
  import("./services/graphService.js"),
])

try {
  await runMigrations()
  await ensureNodeIds()
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error("Startup migration/setup failed:", msg)
}

// Run the opportunities migration on startup
try {
  const migrationPath = path.resolve(__dirname, "db/migrations/003_opportunities.sql")
  const sql = fs.readFileSync(migrationPath, "utf8")
  await db.query(sql)
  console.log("Migration 003_opportunities applied")
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  if (!msg.includes("already exists")) {
    console.error("Migration 003 failed:", msg)
  }
}

const express = expressModule.default
const app = express()

const configuredFrontendOrigin = process.env.FRONTEND_URL || "http://localhost:5173"
const allowedOrigins = new Set<string>([
  configuredFrontendOrigin,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
])

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }

    callback(new Error(`CORS blocked for origin ${origin}`))
  },
}))
app.use(express.json())

app.use("/api/graph", graphMod.default)
app.use("/api/auth", authMod.default)
app.use("/api/connections", connMod.default)
app.use("/api/opportunities", oppMod.default)
app.use("/api/chat-memory", chatMemMod.default)
app.use("/api/buildings",   buildingsMod.default)

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  // Kick off scrapers after the server is listening
  startScheduler()
})
