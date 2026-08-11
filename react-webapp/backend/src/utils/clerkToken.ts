import { createClerkClient, verifyToken, type VerifyTokenOptions } from "@clerk/backend"
// Origin trust rules live in ONE module shared with the CORS layer — this file
// previously carried its own copy of the same functions, re-parsed from env on
// every request. See utils/origins.ts for the rules and the why.
import { buildAuthorizedParties } from "./origins.js"

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

/**
 * The caller's Clerk-VERIFIED primary email, lowercased, or null when it can't
 * be determined (Clerk API unreachable, no primary email).
 *
 * This is the ONLY email that may be used to link a Clerk identity to an
 * existing `users` row. A client-supplied email must never make that decision:
 * any holder of a valid session token could otherwise claim an arbitrary row
 * by posting someone else's address. Shared by requireAuth's reclaim path and
 * POST /api/auth/sync so the two can never diverge on this rule.
 */
export async function getClerkVerifiedPrimaryEmail(clerkId: string): Promise<string | null> {
  try {
    const clerkUser = await clerk.users.getUser(clerkId)
    const primary = clerkUser.emailAddresses.find(
      (emailAddress: { id: string; emailAddress: string }) =>
        emailAddress.id === clerkUser.primaryEmailAddressId
    )?.emailAddress
    return primary ? primary.toLowerCase() : null
  } catch {
    return null
  }
}

function looksLikeBase64(value: string) {
  return /^[A-Za-z0-9+/=]+$/.test(value)
}

function normalizeJwtKey(rawKey: string | undefined) {
  if (!rawKey) return undefined

  const trimmed = rawKey.trim().replace(/^"+|"+$/g, "")
  if (!trimmed) return undefined

  if (
    trimmed.startsWith("pk_") ||
    trimmed.startsWith("sk_") ||
    trimmed.startsWith("test_") ||
    trimmed.startsWith("live_")
  ) {
    return undefined
  }

  if (trimmed.includes("BEGIN PUBLIC KEY") && trimmed.includes("END PUBLIC KEY")) {
    return trimmed
  }

  const base64Body = trimmed.replace(/\s+/g, "")
  if (!base64Body) return undefined
  if (!looksLikeBase64(base64Body)) return undefined

  const wrappedLines = base64Body.match(/.{1,64}/g)?.join("\n") ?? base64Body
  return `-----BEGIN PUBLIC KEY-----\n${wrappedLines}\n-----END PUBLIC KEY-----`
}

export async function verifyClerkSessionToken(token: string, requestOrigin?: string) {
  const rawJwtKey = process.env.CLERK_JWT_PUBLIC_KEY
  const normalizedJwtKey = normalizeJwtKey(rawJwtKey)

  const options: VerifyTokenOptions = {
    secretKey: process.env.CLERK_SECRET_KEY,
    authorizedParties: buildAuthorizedParties(requestOrigin),
  }

  if (normalizedJwtKey) {
    options.jwtKey = normalizedJwtKey
  }

  try {
    return await verifyToken(token, options)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Clerk token verification error"
    throw new Error(`Clerk token verification failed: ${message}`)
  }
}
