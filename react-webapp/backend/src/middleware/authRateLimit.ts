import rateLimit, { type Store } from "express-rate-limit"
import { RedisStore } from "rate-limit-redis"
import { redisClient, connectRedis, isRedisConfigured } from "../lib/redis.js"

const defaultKeyGenerator = (req: { ip?: string }) => req.ip ?? "unknown"

const jsonRateLimitMessage = { error: "Too many requests. Please try again later." }

/**
 * Rate-limit storage backend.
 *
 * WHY: express-rate-limit's default MemoryStore counts per process. Behind a
 * load balancer with N instances, every limit silently becomes limit×N — and
 * counters reset on every deploy. With Redis configured (REDIS_URL etc., see
 * lib/redis.ts) all instances share one set of counters, so the numbers below
 * mean what they say regardless of topology. Without Redis we fall back to
 * per-process limiting and say so loudly at startup, because that's an
 * operational fact the person scaling the service needs to know.
 *
 * Each limiter gets its own key prefix so a client exhausting one bucket
 * (e.g. profile updates) doesn't consume another's counters.
 */
function makeStore(prefix: string): Store | undefined {
  if (!isRedisConfigured() || !redisClient) return undefined // MemoryStore fallback
  // Captured in a const so the null-check narrowing survives into the closure.
  const client = redisClient
  return new RedisStore({
    // sendCommand is the adapter contract between rate-limit-redis and the
    // node-redis v4+ client.
    sendCommand: (...args: string[]) => client.sendCommand(args),
    prefix: `rl:${prefix}:`,
  })
}

if (isRedisConfigured()) {
  // Fire-and-forget: limiters work before the connection resolves because
  // rate-limit-redis queues commands on the client.
  connectRedis().catch((err) => {
    console.error("[rate-limit] Redis connection failed — limits degrade to per-process:", err)
  })
  console.log("[rate-limit] using shared Redis store")
} else {
  console.warn(
    "[rate-limit] no Redis configured — limits are PER-PROCESS. " +
      "With multiple instances the effective limit is multiplied by instance count."
  )
}

// Global API limiter (all /api endpoints)
export const apiGlobalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonRateLimitMessage,
  keyGenerator: defaultKeyGenerator,
  store: makeStore("global"),
})

// Write-heavy limiter for POST/PUT/PATCH/DELETE endpoints
export const apiWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonRateLimitMessage,
  keyGenerator: defaultKeyGenerator,
  store: makeStore("write"),
})

// Limits profile sync/creation to 10 attempts per IP per 15 minutes
export const syncRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonRateLimitMessage,
  keyGenerator: defaultKeyGenerator,
  store: makeStore("sync"),
})

// Limits profile updates to 20 per IP per 15 minutes
export const profileUpdateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many update requests. Please try again later." },
  keyGenerator: defaultKeyGenerator,
  store: makeStore("profile"),
})

// Sensitive connection actions limiter
export const connectionActionRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 80,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many connection actions. Please slow down." },
  keyGenerator: defaultKeyGenerator,
  store: makeStore("connections"),
})
