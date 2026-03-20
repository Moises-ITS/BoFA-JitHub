import { fileURLToPath } from "url"
import path from "path"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

// Dynamic imports ensure dotenv runs before any module that reads process.env
const [expressModule, { default: cors }, , , graphMod, authMod, connMod, chatMemMod, { runMigrations }, { ensureNodeIds }] =
  await Promise.all([
    import("express"),
    import("cors"),
    import("./config/postgres.js"),
    import("./config/neo4j.js"),
    import("./routes/graph.js"),
    import("./routes/auth.js"),
    import("./routes/connections.js"),
    import("./routes/chatMemory.js"),
    import("./db/migrate.js"),
    import("./services/graphService.js"),
  ])

// Apply any pending DB migrations before handling traffic
await runMigrations()
// Patch any Neo4j nodes missing an id property
await ensureNodeIds()

const express = expressModule.default
const app = express()

// Allow any localhost port in dev + the configured production URL
const allowedOrigins = (process.env.FRONTEND_URL ?? "").split(",").map(s => s.trim()).filter(Boolean)
app.use(cors({
  origin(origin, cb) {
    // Allow requests with no origin (curl, mobile apps, server-to-server)
    if (!origin) return cb(null, true)
    // Allow any localhost / 127.0.0.1 port in local development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true)
    // Allow configured production origins
    if (allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())

app.use("/api/graph",        graphMod.default)
app.use("/api/auth",         authMod.default)
app.use("/api/connections",  connMod.default)
app.use("/api/chat-memory",  chatMemMod.default)

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
