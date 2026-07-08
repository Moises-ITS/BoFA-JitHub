/**
 * eventFormatting.ts — presentation-only helpers and display constants for
 * event UI, shared by EventsPage, Home, the heatmap calendar, and the event
 * detail modal.
 *
 * WHY THIS FILE EXISTS: these used to live inside EventDetailModal.tsx, which
 * made that file a grab-bag of components + constants + functions. Mixing
 * non-component exports into a component module breaks React Fast Refresh
 * (every edit anywhere forced a full reload of three pages) and meant `fmt12`
 * got re-implemented locally in heatmap-calendar because importing it from a
 * "modal" felt wrong. Formatting helpers now have an honest home.
 */

/** Fallback avatar emojis, indexed deterministically so a club keeps the same emoji per render context. */
export const CLUB_EMOJIS = ["🎯", "💡", "🚀", "🎓", "⚡", "🌟", "🔥", "🎨", "🏆", "💻", "🎪", "🌈"];

/** Badge colors per event category — keys match the exact category values stored in the EDEN database. */
export const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  hackathon:         { bg: "var(--brand-primary-soft)",        color: "var(--brand-primary)" },
  workshop:          { bg: "var(--accent-networking-soft)",    color: "var(--accent-networking)" },
  recruiting:        { bg: "var(--accent-opportunities-soft)", color: "var(--accent-opportunities)" },
  conference:        { bg: "var(--accent-orgs-soft)",          color: "var(--accent-orgs)" },
  "info session":    { bg: "var(--accent-events-soft)",        color: "var(--accent-events)" },
  "general meeting": { bg: "rgba(255,255,255,0.06)",           color: "var(--text-muted)" },
  social:            { bg: "var(--accent-orgs-soft)",          color: "var(--accent-orgs)" },
  volunteering:      { bg: "var(--status-success-soft)",       color: "var(--status-success)" },
  "site tour":       { bg: "var(--accent-events-soft)",        color: "var(--accent-events)" },
  fundraiser:        { bg: "var(--status-error-soft)",         color: "var(--status-error)" },
  exposure:          { bg: "var(--status-info-soft)",          color: "var(--status-info)" },
  "study support":   { bg: "var(--accent-networking-soft)",    color: "var(--status-info)" },
};

/** Extract a short, readable blurb from a raw Instagram caption. */
export function captionBlurb(caption: string): string {
  // Drop hashtag-only lines, blank lines, and emoji-only lines
  const lines = caption.split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#") && /[a-zA-Z]/.test(l));
  const text = lines[0] ?? caption;
  // Strip inline hashtags and collapse whitespace
  const clean = text.replace(/#\S+/g, "").replace(/\s{2,}/g, " ").trim();
  // Take up to first sentence break
  const sentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  if (sentence.length <= 80) return sentence;
  // Break at last word boundary before 80 chars
  const cut = sentence.slice(0, 80).replace(/\s+\S*$/, "");
  return cut + "…";
}

/**
 * Normalize an event's categories: the API sends either an `event_categories`
 * array or a comma-separated `event_category` string depending on the
 * endpoint — this smooths both into a deduped, lowercased list.
 */
export function getEventCategories(
  event: { event_category?: string | null; event_categories?: string[] } | null | undefined
): string[] {
  const values = Array.isArray(event?.event_categories) && event.event_categories.length > 0
    ? event.event_categories
    : typeof event?.event_category === "string"
      ? event.event_category.split(",")
      : [];

  const unique: string[] = [];
  values.forEach((value: unknown) => {
    const cleaned = String(value ?? "").trim().toLowerCase();
    if (cleaned && !unique.includes(cleaned)) {
      unique.push(cleaned);
    }
  });
  return unique;
}

/**
 * "14:30" → "2:30pm", "09:00" → "9am". Null/empty-tolerant (returns "") so
 * callers with optional start/end times don't each need their own guard —
 * this tolerance is what let a second copy of this function grow in
 * heatmap-calendar before the consolidation.
 */
export function fmt12(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}
