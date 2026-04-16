import neo4j from "neo4j-driver"

const neo4jUri = process.env.NEO4J_URI
const neo4jUser = process.env.NEO4J_USER
const neo4jPassword = process.env.NEO4J_PASSWORD

if (!neo4jUri || !neo4jUser || !neo4jPassword) {
  const missing = [
    !neo4jUri ? "NEO4J_URI" : null,
    !neo4jUser ? "NEO4J_USER" : null,
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
