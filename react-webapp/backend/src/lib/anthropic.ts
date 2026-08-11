import Anthropic from "@anthropic-ai/sdk"

// Mirrors lib/redis.ts: a Railway/Vercel env var left as an unfilled template
// (`${{ANTHROPIC_API_KEY}}`, `<your-key>`) is worse than a missing one — it
// looks configured but throws on the first real request. Treating placeholder
// shapes as "not configured" surfaces that at boot instead.
const PLACEHOLDER_PATTERNS = [
  /^\$\{\{.+\}\}$/,
  /^\{\{.+\}\}$/,
  /^<.+>$/,
]

function readEnv(name: string): string | null {
  const raw = process.env[name]
  if (!raw) return null
  const value = raw.trim()
  if (!value) return null
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) return null
  return value
}

const apiKey = readEnv("ANTHROPIC_API_KEY")

export const anthropicClient: Anthropic | null = apiKey ? new Anthropic({ apiKey }) : null

export function isAnthropicConfigured(): boolean {
  return anthropicClient !== null
}
