/**
 * jitiCorpusService.ts — builds Jiti's entire knowledge base once, at boot,
 * as one plain-text block sized to sit behind Anthropic's prompt cache.
 *
 * WHY BOOT-TIME, NOT PER-REQUEST OR A BUILD STEP
 * ------------------------------------------------
 * jitiQuotaService's JITI_RESERVE_CENTS assumes the cached block is
 * byte-identical on every request after the first — a single byte of drift
 * (a re-sorted CSV, a recomputed date, anything that reads the clock) breaks
 * Anthropic's prefix match and turns every request into a full-price cache
 * write. So this module parses the CSV, filters, and formats exactly once at
 * import time and hands out the same string forever; nothing below this
 * comment may read Date.now() or touch randomness.
 *
 * WHY THIS IS NOT VECTOR RAG
 * ----------------------------
 * ~280 rows of club data compress to roughly 11k tokens of plain text — well
 * inside a single cacheable prefix. Chunking + embeddings would trade a
 * $0.10/MTok cache read for an embedding pipeline, a vector store, and
 * retrieval latency, to save nothing: the whole corpus is smaller than what
 * setting up retrieval for one relevant chunk would cost.
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { parse } from "csv-parse/sync"
import type Anthropic from "@anthropic-ai/sdk"
import { anthropicClient } from "../lib/anthropic.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Several candidate roots, same idea as index.ts's migrationCandidates list —
// this module is imported from both src/ (tsx) and dist/ (built), and the
// process cwd varies between local dev and Railway.
const CSV_CANDIDATES = [
  path.resolve(__dirname, "../../rag/data/text_files/njit_orgs.csv"),
  path.resolve(process.cwd(), "react-webapp/backend/rag/data/text_files/njit_orgs.csv"),
  path.resolve(process.cwd(), "rag/data/text_files/njit_orgs.csv"),
  path.resolve(process.cwd(), "backend/rag/data/text_files/njit_orgs.csv"),
]

const SUMMARY_MAX_CHARS = 130
const CATEGORY_MAX_CHARS = 40

// Anthropic's minimum cacheable prefix. Below this the block is sent in full
// on every single request — silently, no error from the API — which is
// exactly the failure mode JITI_RESERVE_CENTS was sized assuming can't happen.
export const MIN_CACHEABLE_TOKENS = 4_096
const WARN_ABOVE_TOKENS = 20_000

interface OrgCsvRow {
  id: string
  source_type: string
  title: string
  description: string
  category: string
  tags: string
  metadata_json: string
  url: string
  last_updated: string
}

interface OrgMetadata {
  short_name?: string
  status?: string
  summary?: string
  profile_picture?: string
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function truncate(value: string, max: number): string {
  const collapsed = collapseWhitespace(value)
  if (collapsed.length <= max) return collapsed
  return `${collapsed.slice(0, max - 1).trimEnd()}…`
}

function resolveCsvPath(): string {
  const found = CSV_CANDIDATES.find((candidate) => fs.existsSync(candidate))
  if (!found) {
    throw new Error(`[jiti][corpus] njit_orgs.csv not found. Checked: ${CSV_CANDIDATES.join(", ")}`)
  }
  return found
}

/**
 * Static header for the cached block. The "current as of" date is a literal
 * string, NOT derived from the CSV's last_updated column or the clock — doing
 * either would move the cache prefix (and thus invalidate it) on every scrape
 * or every calendar day.
 */
const CORPUS_HEADER =
  "NJIT club and organization index. Each line is one active club in the " +
  "format `name | category | summary`. Data current as of 2026-07-07.\n\n"

export interface CorpusBuildResult {
  block: string
  rowsIn: number
  rowsExcluded: number
}

/**
 * Pure, synchronous, and deterministic: parse the CSV, drop inactive rows,
 * format the rest. Called once at boot; also called directly (twice) by
 * jitiCorpusService.test.ts to prove the output never drifts between builds.
 */
export function buildCorpus(): CorpusBuildResult {
  const csvPath = resolveCsvPath()
  const raw = fs.readFileSync(csvPath, "utf8")
  const records: OrgCsvRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  })

  let rowsExcluded = 0
  const lines: string[] = []
  for (const record of records) {
    let metadata: OrgMetadata = {}
    try {
      metadata = record.metadata_json ? JSON.parse(record.metadata_json) : {}
    } catch {
      // Malformed metadata_json on a handful of scraped rows — treat as no
      // metadata rather than dropping the row or crashing the boot sequence.
      metadata = {}
    }

    // Only exclude on an explicit non-"Active" status. Rows with no status
    // key at all (metadata absent, or metadata present without a status
    // field) are kept — "no signal" is not "inactive".
    if (metadata.status && metadata.status !== "Active") {
      rowsExcluded += 1
      continue
    }

    const name = collapseWhitespace(metadata.short_name || record.title || "Unknown club")
    const summary = truncate(metadata.summary || record.description || "", SUMMARY_MAX_CHARS)
    const cat = truncate(record.category || "Uncategorized", CATEGORY_MAX_CHARS)
    lines.push(`${name} | ${cat} | ${summary}`)
  }

  return { block: CORPUS_HEADER + lines.join("\n"), rowsIn: records.length, rowsExcluded }
}

let cachedBlock: string | null = null

function requireAnthropic(): Anthropic {
  if (!anthropicClient) {
    throw new Error("[jiti][corpus] ANTHROPIC_API_KEY is not configured — cannot count boot-time corpus tokens")
  }
  return anthropicClient
}

/**
 * Counts tokens for the assembled system block using the real Anthropic
 * tokenizer (not a local estimate — the 4,096-token cache floor is Anthropic's
 * number, and only their counter is authoritative against it).
 */
async function countBlockTokens(block: string): Promise<number> {
  const client = requireAnthropic()
  const result = await client.messages.countTokens({
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
    system: [{ type: "text", text: block }],
    messages: [{ role: "user", content: "placeholder" }],
  })
  return result.input_tokens
}

/**
 * Boot-time gate: builds the corpus, counts it against the real tokenizer,
 * and throws if it lands below the cacheable floor. Fails loud on purpose —
 * a corpus that silently never caches burns the cache-write price
 * ($2/MTok) on every single request, not just the first, which quietly
 * blows through JITI_GLOBAL_DAILY_CENTS.
 *
 * Idempotent: safe to call on every request (jitiService does), only does
 * real work once.
 */
export async function initCorpus(systemPrefix = ""): Promise<void> {
  if (cachedBlock !== null) return

  const { block, rowsIn, rowsExcluded } = buildCorpus()
  // Count the EXACT string that becomes the cached prefix — instruction block
  // included — not just the corpus. Anthropic applies the 4,096-token minimum
  // to the whole cached text block, so counting a subset would answer a
  // slightly different question than the one the cache actually asks.
  const tokenCount = await countBlockTokens(systemPrefix + block)
  const pass = tokenCount >= MIN_CACHEABLE_TOKENS

  console.log("[jiti][corpus]", { rowsIn, rowsExcluded, tokenCount, minRequired: MIN_CACHEABLE_TOKENS, pass })

  if (!pass) {
    throw new Error(
      `[jiti][corpus] system block is ${tokenCount} tokens, below Anthropic's ${MIN_CACHEABLE_TOKENS}-token ` +
        "minimum cacheable prefix. It would silently never cache. Fix the corpus before enabling Jiti."
    )
  }
  if (tokenCount > WARN_ABOVE_TOKENS) {
    console.warn("[jiti][corpus] system block is unusually large", { tokenCount, warnAbove: WARN_ABOVE_TOKENS })
  }

  cachedBlock = block
}

/** The cached system block. Throws if initCorpus() hasn't completed — callers
 * (jitiService) always await initCorpus() first. */
export function getCachedSystemBlock(): string {
  if (cachedBlock === null) {
    throw new Error("[jiti][corpus] corpus not initialized — call initCorpus() before serving requests")
  }
  return cachedBlock
}

/** Test-only escape hatch: resets the module-level cache between test cases. */
export function __resetCorpusCacheForTests(): void {
  cachedBlock = null
}
