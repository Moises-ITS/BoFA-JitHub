import neo4j from "neo4j-driver"

const neo4jUri = process.env.NEO4J_URI
// NEO4J_USERNAME is the name Aura uses in the credentials file it hands you at
// instance creation, so it is what gets pasted into .env; NEO4J_USER was this
// project's original name. Accept both rather than failing startup on a
// spelling difference nobody chose.
const neo4jUser = process.env.NEO4J_USER ?? process.env.NEO4J_USERNAME
const neo4jPassword = process.env.NEO4J_PASSWORD

if (!neo4jUri || !neo4jUser || !neo4jPassword) {
  const missing = [
    !neo4jUri ? "NEO4J_URI" : null,
    !neo4jUser ? "NEO4J_USER (or NEO4J_USERNAME)" : null,
    !neo4jPassword ? "NEO4J_PASSWORD" : null,
  ].filter(Boolean).join(", ")
  throw new Error(
    `Missing required Neo4j env vars: ${missing}. ` +
      `Create backend/.env.local from backend/.env.example and set these values.`
  )
}

export const driver = neo4j.driver(
  neo4jUri,
  neo4j.auth.basic(neo4jUser, neo4jPassword)
)

driver.verifyConnectivity()
  .then(() => console.log("Neo4j connected"))
  .catch(err => console.error("Neo4j connection failed:", err))
