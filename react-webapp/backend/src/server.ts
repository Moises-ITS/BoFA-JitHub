import express from "express";
import { connectRedis } from "./lib/redis";
import authRouter from "./routes/auth";
import edenRouter from "./routes/eden";

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