import { Request, Response, NextFunction } from "express"
import { createClerkClient, verifyToken } from "@clerk/backend"
import { db } from "../config/postgres"

export interface AuthRequest extends Request {
  userId?: string
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

async function verifyClerkToken(token: string) {
  // Prefer jwtKey (PEM) — works regardless of which instance CLERK_SECRET_KEY belongs to
  const jwtKey = process.env.CLERK_JWT_PUBLIC_KEY
  if (jwtKey) {
    return verifyToken(token, { jwtKey })
  }
  return clerk.verifyToken(token)
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid token" })
    return
  }
  const token = authHeader.slice(7)
  try {
    const payload = await verifyClerkToken(token)
    const clerkId = payload.sub

    // Fast path: clerk_id already linked
    const result = await db.query(
      "SELECT id FROM users WHERE clerk_id = $1", [clerkId]
    )
    if (result.rows.length > 0) {
      req.userId = result.rows[0].id
      next()
      return
    }

    // Auto-reclaim: if user has a legacy profile (same email, no clerk_id yet), link it silently
    try {
      const clerkUser = await clerk.users.getUser(clerkId)
      const primaryEmail = clerkUser.emailAddresses.find(
        e => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress
      if (primaryEmail) {
        const legacy = await db.query(
          "SELECT id FROM users WHERE email = $1 AND clerk_id IS NULL", [primaryEmail]
        )
        if (legacy.rows.length > 0) {
          await db.query(
            "UPDATE users SET clerk_id = $1 WHERE id = $2",
            [clerkId, legacy.rows[0].id]
          )
          req.userId = legacy.rows[0].id
          next()
          return
        }
      }
    } catch {
      // clerk.users.getUser failed (e.g. secret key issue) — fall through to PROFILE_REQUIRED
    }

    // No profile found — new user must complete setup
    res.status(403).json({ error: "Profile not set up", code: "PROFILE_REQUIRED" })
  } catch {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}
