import { verifyToken, type VerifyTokenOptions } from "@clerk/backend"

function looksLikeBase64(value: string) {
  return /^[A-Za-z0-9+/=]+$/.test(value)
}

function normalizeOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin)
    return `${parsed.protocol}//${parsed.host}`.toLowerCase()
  } catch {
    return null
  }
}

function extractVercelLabel(value: string): string | null {
  const normalized = normalizeOrigin(value)
  if (!normalized) return null
  try {
    const host = new URL(normalized).hostname.toLowerCase()
    if (!host.endsWith(".vercel.app")) return null
    return host.slice(0, -".vercel.app".length)
  } catch {
    return null
  }
}

function inferVercelProject(): string {
  const explicit =
    (process.env.FRONTEND_VERCEL_PROJECT ?? process.env.VERCEL_PROJECT_NAME ?? "")
      .trim()
      .toLowerCase()
  if (explicit) return explicit

  const labels = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_ORIGIN,
    process.env.FRONTEND_URLS,
  ]
    .filter(Boolean)
    .flatMap((value) => (value as string).split(","))
    .map((value) => value.trim())
    .map((value) => extractVercelLabel(value))
    .filter((label): label is string => Boolean(label))

  if (labels.length === 0) return ""
  labels.sort((a, b) => a.length - b.length)
  return labels[0]
}

const vercelProject = inferVercelProject()
const vercelTeam =
  (process.env.FRONTEND_VERCEL_TEAM ?? process.env.VERCEL_TEAM_SLUG ?? "")
    .trim()
    .toLowerCase()

function isAllowedVercelOrigin(origin: string): boolean {
  if (!vercelProject) return false

  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }

  if (parsed.protocol !== "https:") return false
  const host = parsed.hostname.toLowerCase()
  if (!host.endsWith(".vercel.app")) return false
  if (host === `${vercelProject}.vercel.app`) return true
  if (!host.startsWith(`${vercelProject}-`)) return false
  if (!vercelTeam) return true
  return host.endsWith(`-${vercelTeam}.vercel.app`)
}

function buildAuthorizedParties(requestOrigin?: string) {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_ORIGIN,
    process.env.FRONTEND_URLS,
  ]
    .filter(Boolean)
    .flatMap((value) => (value as string).split(","))
    .map((origin) => origin.trim())
    .map((origin) => normalizeOrigin(origin) ?? origin.toLowerCase())
    .filter(Boolean)

  const authorizedParties = new Set<string>([
    ...configuredOrigins,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
  ])

  if (requestOrigin) {
    const normalized = normalizeOrigin(requestOrigin)
    if (normalized && (authorizedParties.has(normalized) || isAllowedVercelOrigin(requestOrigin))) {
      authorizedParties.add(normalized)
    }
  }

  return Array.from(authorizedParties)
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
