/**
 * English-language detection for job/scholarship listings.
 *
 * Strategy:
 *  1. Reject non-Latin scripts immediately (CJK, Arabic, Cyrillic, etc.)
 *  2. For longer text, count English stopwords — words like "the", "with",
 *     "have", "would" rarely appear in German/French/Spanish/Portuguese.
 *     Require ≥ 3 % of words to be English stopwords.
 *
 * Threshold is intentionally conservative so that:
 *  - Technical English with lots of jargon still passes (~10 % stopwords typical)
 *  - A paragraph of German/French/Spanish has < 1 % English stopwords and fails
 */

// ── Non-Latin script detector ─────────────────────────────────────────────
const NON_LATIN_RE =
  /[\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u0E00-\u0E7F\u0900-\u097F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g;

// ── High-confidence English-only stopwords ────────────────────────────────
// Chosen because they almost NEVER appear as standalone words in
// German, French, Spanish, Portuguese, Italian, Dutch, etc.
const EN_STOPWORDS = new Set([
  // Articles / determiners
  'the', 'this', 'that', 'these', 'those',
  // Verbs distinctive to English
  'have', 'has', 'had', 'been', 'being',
  'will', 'would', 'could', 'should', 'shall',
  'are', 'were',
  // Prepositions distinctive in English
  'with', 'from', 'than',
  // Conjunctions
  'and', 'but', 'nor', 'yet',
  // Pronouns
  'we', 'they', 'our', 'your', 'their', 'its',
  // Other common English words rarely shared
  'not', 'can', 'get', 'any', 'all', 'also',
]);

export function isEnglish(text: string): boolean {
  if (!text || text.length === 0) return true;

  // ── Step 1: reject non-Latin scripts ─────────────────────────────────
  const nonLatinHits = (text.match(NON_LATIN_RE) ?? []).length;
  if (nonLatinHits / text.length >= 0.04) return false;

  // ── Step 2: for short texts (titles ≤ 10 words) skip linguistic check ─
  const words = text.toLowerCase().match(/\b[a-z]{2,}\b/g) ?? [];
  if (words.length < 10) return true;

  // ── Step 3: stopword frequency check ──────────────────────────────────
  const enCount = words.filter(w => EN_STOPWORDS.has(w)).length;
  const ratio   = enCount / words.length;

  // Require at least 3 % English stopwords.
  // English technical prose: ~12–18 %. German/French/Spanish: ~0–1 %.
  return ratio >= 0.03;
}
