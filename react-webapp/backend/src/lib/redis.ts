import { createClient, type RedisClientType } from "redis";

type RedisConfig = {
  source: string;
  url: string;
};

const PLACEHOLDER_PATTERNS = [
  /^\$\{\{.+\}\}$/,
  /^\{\{.+\}\}$/,
  /^<.+>$/,
];

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) return null;
  return value;
}

function isValidRedisUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "redis:" || parsed.protocol === "rediss:";
  } catch {
    return false;
  }
}

function buildRedisUrlFromParts(): RedisConfig | null {
  const host = readEnv("REDIS_HOST");
  if (!host) return null;

  const port = readEnv("REDIS_PORT") ?? "6379";
  const db = readEnv("REDIS_DB") ?? "0";
  const username = readEnv("REDIS_USERNAME");
  const password = readEnv("REDIS_PASSWORD");
  const tls = (readEnv("REDIS_TLS") ?? "").toLowerCase() === "true" || (readEnv("REDIS_SSL") ?? "").toLowerCase() === "true";

  const protocol = tls ? "rediss" : "redis";
  const auth = username || password
    ? `${encodeURIComponent(username ?? "default")}:${encodeURIComponent(password ?? "")}@`
    : "";

  return {
    source: "REDIS_HOST/REDIS_PORT",
    url: `${protocol}://${auth}${host}:${port}/${db}`,
  };
}

function resolveRedisConfig(): RedisConfig | null {
  const directUrl = readEnv("REDIS_URL");
  if (directUrl && isValidRedisUrl(directUrl)) {
    return { source: "REDIS_URL", url: directUrl };
  }

  const directUri = readEnv("REDIS_URI");
  if (directUri && isValidRedisUrl(directUri)) {
    return { source: "REDIS_URI", url: directUri };
  }

  const connectionString = readEnv("REDIS_CONNECTION_STRING");
  if (connectionString && isValidRedisUrl(connectionString)) {
    return { source: "REDIS_CONNECTION_STRING", url: connectionString };
  }

  const manyUrls = readEnv("REDIS_URLS");
  if (manyUrls) {
    const urls = manyUrls.split(",").map((x) => x.trim()).filter(Boolean);
    const firstValid = urls.find((candidate) => isValidRedisUrl(candidate));
    if (firstValid) {
      return { source: "REDIS_URLS", url: firstValid };
    }
  }

  return buildRedisUrlFromParts();
}

const redisConfig = resolveRedisConfig();

export const redisClient: RedisClientType | null = redisConfig
  ? createClient({
      url: redisConfig.url,
      socket: {
        connectTimeout: 5_000,
      },
    })
  : null;

if (redisClient) {
  redisClient.on("error", (err) => {
    console.error("Redis Client Error", err);
  });
}

export function isRedisConfigured() {
  return redisClient !== null;
}

export async function connectRedis() {
  if (!redisClient) {
    return false;
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log(`Connected to Redis (${redisConfig?.source})`);
  }

  return true;
}
