import neo4j from "neo4j-driver";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "password";

async function wipe() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();

  try {
    const before = await session.run("MATCH (n) RETURN count(n) AS total");
    const beforeCount = before.records[0].get("total").toNumber();

    await session.run("MATCH (n) DETACH DELETE n");

    const after = await session.run("MATCH (n) RETURN count(n) AS total");
    const afterCount = after.records[0].get("total").toNumber();

    console.log(`Neo4j wipe complete. Nodes before: ${beforeCount}, after: ${afterCount}`);
  } finally {
    await session.close();
    await driver.close();
  }
}

wipe().catch((error) => {
  console.error("Neo4j wipe failed:", error);
  process.exitCode = 1;
});
