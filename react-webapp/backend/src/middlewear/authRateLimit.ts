import rateLimit from "express-rate-limit"

const defaultKeyGenerator = (req: { ip?: string }) => req.ip ?? "unknown"

const jsonRateLimitMessage = { error: "Too many requests. Please try again later." }

// Global API limiter (all /api endpoints)
export const apiGlobalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonRateLimitMessage,
  keyGenerator: defaultKeyGenerator,
})

// Write-heavy limiter for POST/PUT/PATCH/DELETE endpoints
export const apiWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonRateLimitMessage,
  keyGenerator: defaultKeyGenerator,
})

// Limits profile sync/creation to 10 attempts per IP per 15 minutes
export const syncRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonRateLimitMessage,
  keyGenerator: defaultKeyGenerator,
})

// Limits profile updates to 20 per IP per 15 minutes
export const profileUpdateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many update requests. Please try again later." },
  keyGenerator: defaultKeyGenerator,
})

// Sensitive connection actions limiter
export const connectionActionRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 80,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many connection actions. Please slow down." },
  keyGenerator: defaultKeyGenerator,
})
