import dotenv from "dotenv";
import { createClient } from "redis";

dotenv.config({ path: ".env" });

const PLACEHOLDER_PATTERNS = [/^\$\{\{.+\}\}$/, /^\{\{.+\}\}$/, /^<.+>$/];

function readEnv(name) {
  const raw = process.env[name];
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) return null;
  return value;
}

function isValidRedisUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "redis:" || parsed.protocol === "rediss:";
  } catch {
    return false;
  }
}

function buildFromParts() {
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
    name: "REDIS_HOST/REDIS_PORT",
    url: `${protocol}://${auth}${host}:${port}/${db}`,
  };
}

function collectTargets() {
  const targets = [];
  const pushIfValid = (name, value) => {
    if (value && isValidRedisUrl(value)) {
      targets.push({ name, url: value });
    }
  };

  pushIfValid("REDIS_URL", readEnv("REDIS_URL"));
  pushIfValid("REDIS_URI", readEnv("REDIS_URI"));
  pushIfValid("REDIS_CONNECTION_STRING", readEnv("REDIS_CONNECTION_STRING"));

  const many = readEnv("REDIS_URLS");
  if (many) {
    const urls = many.split(",").map((x) => x.trim()).filter(Boolean);
    urls.forEach((url, idx) => pushIfValid(`REDIS_URLS[${idx}]`, url));
  }

  const partsTarget = buildFromParts();
  if (partsTarget) targets.push(partsTarget);

  // Deduplicate by URL while keeping first label.
  const seen = new Set();
  return targets.filter((t) => {
    if (seen.has(t.url)) return false;
    seen.add(t.url);
    return true;
  });
}

async function testTarget(target) {
  const client = createClient({
    url: target.url,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: () => false,
    },
  });

  const key = `jit:redis:smoke:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const value = `ok:${target.name}`;

  try {
    await client.connect();
    await client.set(key, value, { EX: 30 });
    const got = await client.get(key);
    await client.del(key);
    if (got !== value) {
      throw new Error(`Value mismatch for ${target.name}`);
    }
    return { ok: true, target: target.name };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, target: target.name, message };
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}

const targets = collectTargets();

if (targets.length === 0) {
  console.error("No valid Redis instance config found (REDIS_URL / REDIS_URLS / REDIS_HOST+REDIS_PORT).");
  process.exit(2);
}

const results = [];
for (const target of targets) {
  // eslint-disable-next-line no-await-in-loop
  results.push(await testTarget(target));
}

const failures = results.filter((r) => !r.ok);

results.forEach((r) => {
  if (r.ok) {
    console.log(`PASS ${r.target}`);
  } else {
    console.error(`FAIL ${r.target}: ${r.message}`);
  }
});

if (failures.length > 0) {
  process.exit(1);
}

console.log(`Redis smoke test passed for ${results.length} instance(s).`);
