import * as dotenv from "dotenv";
dotenv.config();
import { getNodes } from "./src/services/graphService";

async function run() {
  try {
    const nodes = await getNodes();
    console.log("Success, found", nodes.length, "nodes.");
  } catch (err) {
    console.error("Error running getNodes:");
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
