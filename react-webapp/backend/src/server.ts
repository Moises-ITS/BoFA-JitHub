import express from "express";
import { connectRedis } from "./lib/redis.js";
import authRouter from "./routes/auth.js";
import edenRouter from "./routes/eden.js";

const app = express();

app.set("trust proxy", 1);
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/eden", edenRouter);

const PORT = process.env.PORT || 3001;

async function start() {
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
