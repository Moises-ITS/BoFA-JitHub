import { Request, Response, NextFunction } from "express"
import { db } from "../config/postgres.js"
import { verifyClerkSessionToken, getClerkVerifiedPrimaryEmail } from "../utils/clerkToken.js"
import { verifySessionToken } from "../utils/customToken.js"

export interface AuthRequest extends Request {
  userId?: string
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("[security][auth-failed]", { reason: "missing_bearer", path: req.originalUrl, ip: req.ip })
    res.status(401).json({ error: "Missing or invalid token" })
    return
  }
  const token = authHeader.slice(7)

  if (token.startsWith("custom_")) {
    const customUserId = verifySessionToken(token)
    if (customUserId) {
      req.userId = customUserId
      console.info("[security][auth-success]", { path: req.originalUrl, ip: req.ip, userId: req.userId, via: "custom_token" })
      next()
      return
    } else {
      console.warn("[security][auth-failed]", { reason: "invalid_or_expired_custom_token", path: req.originalUrl, ip: req.ip })
      res.status(401).json({ error: "Invalid or expired token" })
      return
    }
  }

  let clerkId: string
  try {
    const payload = await verifyClerkSessionToken(token, req.headers.origin)
    clerkId = payload.sub
  } catch (error) {
    console.error("Clerk token verification failed in requireAuth:", error)
    console.warn("[security][auth-failed]", { reason: "invalid_or_expired_token", path: req.originalUrl, ip: req.ip })
    res.status(401).json({ error: "Invalid or expired token" })
    return
  }

  try {
    const result = await db.query("SELECT id FROM users WHERE clerk_id = $1", [clerkId])
    if (result.rows.length > 0) {
      req.userId = result.rows[0].id
      console.info("[security][auth-success]", { path: req.originalUrl, ip: req.ip, userId: req.userId })
      next()
      return
    }

    // Reclaim an existing row by the Clerk-VERIFIED primary email — including
    // rows still carrying a clerk_id from a previous Clerk instance. Matching
    // only `clerk_id IS NULL` here once stranded every existing user behind
    // 403/500 loops when the app moved to a new production instance: their old
    // ids matched nothing, and the stale value blocked the re-link.
    const primaryEmail = await getClerkVerifiedPrimaryEmail(clerkId)
    if (primaryEmail) {
      const legacy = await db.query(
        "SELECT id, clerk_id FROM users WHERE email = $1",
        [primaryEmail]
      )

      if (legacy.rows.length > 0) {
        const stale = legacy.rows[0].clerk_id !== null
        await db.query(
          "UPDATE users SET clerk_id = $1 WHERE id = $2",
          [clerkId, legacy.rows[0].id]
        )
        req.userId = legacy.rows[0].id
        console.info("[security][auth-success]", { path: req.originalUrl, ip: req.ip, userId: req.userId, via: stale ? "stale_clerk_reclaim" : "legacy_reclaim" })
        next()
        return
      }
    }

    console.warn("[security][auth-failed]", { reason: "profile_required", path: req.originalUrl, ip: req.ip, clerkId })
    res.status(403).json({ error: "Profile not set up", code: "PROFILE_REQUIRED" })
  } catch (error) {
    console.error("Auth middleware database lookup failed:", error)
    console.warn("[security][auth-failed]", { reason: "auth_backend_unavailable", path: req.originalUrl, ip: req.ip })
    res.status(500).json({ error: "Authentication backend unavailable" })
  }
}
