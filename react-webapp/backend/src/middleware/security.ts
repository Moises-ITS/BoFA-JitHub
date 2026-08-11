import type { NextFunction, Request, Response } from "express"

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g
const SAFE_ID_REGEX = /^[a-zA-Z0-9:_-]{1,128}$/

function sanitizeString(input: string): string {
  return input.replace(CONTROL_CHARS, "").trim()
}

function deepSanitize(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value)
  if (Array.isArray(value)) return value.map((entry) => deepSanitize(entry))
  if (!value || typeof value !== "object") return value

  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    out[key] = deepSanitize(entry)
  }
  return out
}

export function sanitizeRequestInputs(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") req.body = deepSanitize(req.body)
  if (req.query && typeof req.query === "object") req.query = deepSanitize(req.query) as Request["query"]
  if (req.params && typeof req.params === "object") req.params = deepSanitize(req.params) as Request["params"]
  next()
}

export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID_REGEX.test(value)
}

export function requireSafeId(value: unknown): string | null {
  if (!isSafeId(value)) return null
  return sanitizeString(value)
}

export function sanitizeText(input: unknown, maxLen = 512): string {
  if (typeof input !== "string") return ""
  return sanitizeString(input).slice(0, maxLen)
}

export function sanitizeStringArray(input: unknown, itemMaxLen = 120, maxItems = 40): string[] {
  if (!Array.isArray(input)) return []
  return input
    .slice(0, maxItems)
    .map((item) => sanitizeText(item, itemMaxLen))
    .filter(Boolean)
}

export function sanitizeOptionalHttpsUrl(input: unknown): string | null {
  if (typeof input !== "string") return null
  const value = sanitizeString(input)
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
    return parsed.toString().slice(0, 500)
  } catch {
    return null
  }
}

export function toBoundedPositiveInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}
