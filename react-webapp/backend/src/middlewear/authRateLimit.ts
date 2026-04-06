import rateLimit from "express-rate-limit"

// Limits profile sync/creation to 10 attempts per IP per 15 minutes
export const syncRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  keyGenerator: (req) => req.ip ?? "unknown",
})

// Limits profile updates to 20 per IP per 15 minutes
export const profileUpdateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many update requests. Please try again later." },
  keyGenerator: (req) => req.ip ?? "unknown",
})