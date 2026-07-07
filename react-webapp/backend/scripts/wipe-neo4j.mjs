import neo4j from "neo4j-driver";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This script lives in scripts/, but the .env lives at the backend package root —
// resolve one level up so credentials load no matter where node is invoked from.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "password";

// Safety interlock: this script IRREVERSIBLY deletes every node and relationship
// in the graph database. Requiring an explicit --yes flag means it can never run
// by accident (tab-completed, copy-pasted from history, wrong terminal, etc.).
// If you're pointing at production, stop and take a backup first.
if (!process.argv.includes("--yes")) {
  console.error(
    "Refusing to run: this DELETES EVERY NODE in the Neo4j database at\n" +
      `  ${NEO4J_URI}\n` +
      "Re-run with --yes if you are absolutely sure:\n" +
      "  node scripts/wipe-neo4j.mjs --yes"
  );
  process.exit(1);
}

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
