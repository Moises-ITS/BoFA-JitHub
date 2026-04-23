import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const PORT = Number(process.env.PORT ?? 3001)
const FRONTEND_ORIGIN = process.env.FRONTEND_URL ?? "http://localhost:5173"

const EXTRA_SQL_MIGRATIONS = [
  "db/migrations/003_opportunities.sql",
]

async function applySqlMigrations(db: { query: (sql: string) => Promise<unknown> }) {
  for (const relPath of EXTRA_SQL_MIGRATIONS) {
    const filePath = path.resolve(__dirname, relPath)
    const migrationName = path.basename(relPath)
    try {
      const sql = fs.readFileSync(filePath, "utf8")
      await db.query(sql)
      console.log(`Migration ${migrationName} applied`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Migration ${migrationName} failed:`, msg)
      throw err
    }
  }
}

async function connectRedisIfConfigured() {
  const { connectRedis, isRedisConfigured } = await import("./lib/redis.js")
  if (!isRedisConfigured()) {
    console.warn("Redis is not configured. Continuing without Redis.")
    return
  }
  await connectRedis()
}

async function bootstrap() {
  // Dynamic imports ensure dotenv runs before any module that reads process.env.
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
    edenMod,
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
    import("./routes/eden.js"),
    import("./scrapers/runner.js"),
    import("./db/migrate.js"),
    import("./services/graphService.js"),
  ])

  await runMigrations()
  await ensureNodeIds()
  await applySqlMigrations(db)
  await connectRedisIfConfigured()

  const express = expressModule.default
  const app = express()

  const allowedOrigins = new Set<string>([
    FRONTEND_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ])

  app.use(cors({
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(new Error(`CORS blocked for origin ${origin}`))
    },
  }))
  app.use(express.json())

  const routes: Array<[string, unknown]> = [
    ["/api/graph", graphMod.default],
    ["/api/auth", authMod.default],
    ["/api/connections", connMod.default],
    ["/api/opportunities", oppMod.default],
    ["/api/chat-memory", chatMemMod.default],
    ["/api/buildings", buildingsMod.default],
    ["/api/eden", edenMod.default],
  ]
  for (const [mountPath, router] of routes) {
    app.use(mountPath, router as Parameters<typeof app.use>[1])
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`)
    startScheduler()
  })
}

bootstrap().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error("Backend startup failed:", msg)
  process.exit(1)
})
