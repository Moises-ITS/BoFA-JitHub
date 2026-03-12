import { fileURLToPath } from "url"
import path from "path"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

// Dynamic imports ensure dotenv runs before any module that reads process.env
const [expressModule, { default: cors }, , , graphMod, authMod, connMod] =
  await Promise.all([
    import("express"),
    import("cors"),
    import("./config/postgres.js"),
    import("./config/neo4j.js"),
    import("./routes/graph.js"),
    import("./routes/auth.js"),
    import("./routes/connections.js"),
  ])

const express = expressModule.default
const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL }))
app.use(express.json())

app.use("/api/graph",       graphMod.default)
app.use("/api/auth",        authMod.default)
app.use("/api/connections", connMod.default)

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
