import { Request, Response, NextFunction } from "express"
import { createClerkClient } from "@clerk/backend"
import { db } from "../config/postgres.js"
import { verifyClerkSessionToken } from "../utils/clerkToken.js"

export interface AuthRequest extends Request {
  userId?: string
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("[security][auth-failed]", { reason: "missing_bearer", path: req.originalUrl, ip: req.ip })
    res.status(401).json({ error: "Missing or invalid token" })
    return
  }
  const token = authHeader.slice(7)

  try {
    const payload = await verifyClerkSessionToken(token)
    const clerkId = payload.sub

    const result = await db.query("SELECT id FROM users WHERE clerk_id = $1", [clerkId])
    if (result.rows.length > 0) {
      req.userId = result.rows[0].id
      console.info("[security][auth-success]", { path: req.originalUrl, ip: req.ip, userId: req.userId })
      next()
      return
    }

    try {
      const clerkUser = await clerk.users.getUser(clerkId)
      const primaryEmail = clerkUser.emailAddresses.find(
        (emailAddress: { id: string; emailAddress: string }) =>
          emailAddress.id === clerkUser.primaryEmailAddressId
      )?.emailAddress

      if (primaryEmail) {
        const legacy = await db.query(
          "SELECT id FROM users WHERE email = $1 AND clerk_id IS NULL",
          [primaryEmail]
        )

        if (legacy.rows.length > 0) {
          await db.query(
            "UPDATE users SET clerk_id = $1 WHERE id = $2",
            [clerkId, legacy.rows[0].id]
          )
          req.userId = legacy.rows[0].id
          console.info("[security][auth-success]", { path: req.originalUrl, ip: req.ip, userId: req.userId, via: "legacy_reclaim" })
          next()
          return
        }
      }
    } catch {
      // If Clerk user lookup fails, fall through to PROFILE_REQUIRED below.
    }

    console.warn("[security][auth-failed]", { reason: "profile_required", path: req.originalUrl, ip: req.ip, clerkId })
    res.status(403).json({ error: "Profile not set up", code: "PROFILE_REQUIRED" })
  } catch (error) {
    console.error("Clerk token verification failed in requireAuth:", error)
    console.warn("[security][auth-failed]", { reason: "invalid_or_expired_token", path: req.originalUrl, ip: req.ip })
    res.status(401).json({ error: "Invalid or expired token" })
  }
}
