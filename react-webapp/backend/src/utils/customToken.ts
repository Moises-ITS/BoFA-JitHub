import crypto from "crypto"

const JWT_SECRET = process.env.JWT_SECRET || "fallback-jithub-secret-key-123456"

export function generateSessionToken(userId: string): string {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days expiration
  const payload = JSON.stringify({ userId, expiresAt })
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("hex")
  return `custom_${Buffer.from(payload).toString("base64")}.${signature}`
}

export function verifySessionToken(token: string): string | null {
  try {
    const actualToken = token.startsWith("custom_") ? token.slice(7) : token
    const parts = actualToken.split(".")
    if (parts.length !== 2) return null
    const payload = Buffer.from(parts[0], "base64").toString("utf-8")
    const signature = parts[1]
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("hex")
    if (signature !== expectedSignature) return null
    const decoded = JSON.parse(payload)
    if (decoded.expiresAt < Date.now()) return null
    return decoded.userId
  } catch {
    return null
  }
}
