/**
 * utils/origins.ts — single source of truth for "which browser origins do we trust".
 *
 * WHY THIS EXISTS: this exact logic (normalize an Origin header, read the
 * FRONTEND_* env vars, decide whether a *.vercel.app preview URL belongs to our
 * project) used to be copy-pasted in two places — index.ts (for CORS) and
 * utils/clerkToken.ts (for Clerk's authorizedParties check). Duplicated trust
 * logic is a security bug factory: fix an origin-parsing edge case in one copy
 * and the other keeps the hole. Both consumers now import from here.
 *
 * Everything env-derived is computed ONCE at module load — env vars don't
 * change at runtime, and the old clerkToken copy needlessly re-parsed them on
 * every single request.
 */

/** Lowercased `protocol//host` form of an origin, or null if it isn't a parseable URL. */
export function normalizeOrigin(origin: string): string | null {
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

/**
 * The Vercel project label, either explicit (FRONTEND_VERCEL_PROJECT /
 * VERCEL_PROJECT_NAME) or inferred from the configured frontend URLs. Used to
 * accept Vercel preview-deployment origins (project-git-branch-team.vercel.app)
 * without listing every preview URL in env.
 */
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
  // Shortest label wins: "myapp" beats "myapp-git-main" so previews still match.
  labels.sort((a, b) => a.length - b.length)
  return labels[0]
}

const vercelProject = inferVercelProject()
const vercelTeam =
  (process.env.FRONTEND_VERCEL_TEAM ?? process.env.VERCEL_TEAM_SLUG ?? "")
    .trim()
    .toLowerCase()

/** True when the origin is an https *.vercel.app host belonging to OUR project (and team, when configured). */
export function isAllowedVercelOrigin(origin: string): boolean {
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

/** Origins explicitly configured via FRONTEND_URL / FRONTEND_ORIGIN / FRONTEND_URLS (comma-separated), normalized. Computed once. */
export const configuredFrontendOrigins: readonly string[] = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URLS,
]
  .filter(Boolean)
  .flatMap((value) => (value as string).split(","))
  .map((origin) => origin.trim())
  .map((origin) => normalizeOrigin(origin) ?? origin.toLowerCase())
  .filter(Boolean)

// NOTE the two consumers intentionally trust slightly different localhost sets,
// preserved exactly from before the dedupe:
//  - CORS allows only the real Vite dev port (3000).
//  - Clerk authorizedParties also allows the legacy 517x ports because Clerk's
//    `azp` claim can reflect the port a still-running older dev session was
//    started on. (The dev port moved off 517x: Windows reserves 5093-5657 for
//    Hyper-V/WSL NAT, so Vite could not bind there.)

const corsAllowedOrigins = new Set<string>([
  ...configuredFrontendOrigins,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
])

/** CORS decision for a browser Origin header (configured origins + local dev + our Vercel previews). */
export function isAllowedCorsOrigin(origin: string): boolean {
  const normalized = normalizeOrigin(origin) ?? origin.toLowerCase()
  return corsAllowedOrigins.has(normalized) || isAllowedVercelOrigin(origin)
}

const clerkBaseParties = new Set<string>([
  ...configuredFrontendOrigins,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  // ORIGINS ONLY — scheme + host, no trailing slash and no path. Every lookup
  // goes through normalizeOrigin(), which returns `protocol//host` and discards
  // the rest, so "https://jit-hub.com/" and "https://jit-hub.com/home" can
  // never match anything (both were tried; both were silently dead). The single
  // entry below already covers every path on the domain.
  "https://jit-hub.com",
])

/**
 * The `authorizedParties` list for Clerk JWT verification. The request's own
 * origin is appended ONLY if it already passes our trust rules — this is what
 * lets tokens minted on a Vercel preview deployment verify without listing
 * every preview URL, while still rejecting arbitrary origins.
 */
export function buildAuthorizedParties(requestOrigin?: string): string[] {
  if (!requestOrigin) return Array.from(clerkBaseParties)

  const normalized = normalizeOrigin(requestOrigin)
  if (
    normalized &&
    (clerkBaseParties.has(normalized) || isAllowedVercelOrigin(requestOrigin))
  ) {
    return Array.from(new Set([...clerkBaseParties, normalized]))
  }
  return Array.from(clerkBaseParties)
}
