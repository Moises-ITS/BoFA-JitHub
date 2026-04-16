import { verifyToken, type VerifyTokenOptions } from "@clerk/backend"

function normalizeJwtKey(rawKey: string | undefined) {
  if (!rawKey) return undefined

  const trimmed = rawKey.trim().replace(/^"+|"+$/g, "")
  if (!trimmed) return undefined

  if (trimmed.includes("BEGIN PUBLIC KEY") && trimmed.includes("END PUBLIC KEY")) {
    return trimmed
  }

  const base64Body = trimmed.replace(/\s+/g, "")
  if (!base64Body) return undefined

  const wrappedLines = base64Body.match(/.{1,64}/g)?.join("\n") ?? base64Body
  return `-----BEGIN PUBLIC KEY-----\n${wrappedLines}\n-----END PUBLIC KEY-----`
}

export async function verifyClerkSessionToken(token: string) {
  const rawJwtKey = process.env.CLERK_JWT_PUBLIC_KEY
  const normalizedJwtKey = normalizeJwtKey(rawJwtKey)

  console.log("[clerkToken] CLERK_SECRET_KEY present:", !!process.env.CLERK_SECRET_KEY)
  console.log("[clerkToken] CLERK_JWT_PUBLIC_KEY raw present:", !!rawJwtKey)
  console.log("[clerkToken] normalized jwtKey present:", !!normalizedJwtKey)
  if (normalizedJwtKey) {
    console.log("[clerkToken] jwtKey first line:", normalizedJwtKey.split("\n")[0])
  }

  // Decode JWT header to see kid/alg
  try {
    const [headerB64] = token.split(".")
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString())
    console.log("[clerkToken] JWT header:", header)
    const [, payloadB64] = token.split(".")
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString())
    console.log("[clerkToken] JWT payload azp:", payload.azp, "iss:", payload.iss, "exp:", new Date(payload.exp * 1000).toISOString())
  } catch (e) {
    console.log("[clerkToken] could not decode JWT for inspection:", e)
  }

  const options: VerifyTokenOptions = {
    secretKey: process.env.CLERK_SECRET_KEY,
    authorizedParties: [
      process.env.FRONTEND_URL ?? "http://localhost:5174",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ],
  }

  if (normalizedJwtKey) {
    options.jwtKey = normalizedJwtKey
  }

  console.log("[clerkToken] authorizedParties:", options.authorizedParties)

  try {
    const result = await verifyToken(token, options)
    console.log("[clerkToken] verification SUCCESS — sub:", result.sub)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Clerk token verification error"
    console.error("[clerkToken] verification FAILED:", message)
    throw new Error(`Clerk token verification failed: ${message}`)
  }
}
