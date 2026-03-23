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
  const options: VerifyTokenOptions = {
    secretKey: process.env.CLERK_SECRET_KEY,
  }

  const normalizedJwtKey = normalizeJwtKey(process.env.CLERK_JWT_PUBLIC_KEY)
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
