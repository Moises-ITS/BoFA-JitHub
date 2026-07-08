/**
 * types/events.ts — the canonical shape of an event as served by the EDEN
 * FastAPI (scraped from club Instagram posts).
 *
 * WHY MOST FIELDS ARE OPTIONAL: different EDEN endpoints return different
 * subsets (upcoming vs trending vs detail), and scraped data is inherently
 * patchy — an event may lack a date, location, or category. Optional fields
 * force every consumer to handle absence, which matches reality.
 *
 * The index signature is a deliberate escape hatch: the EDEN API grows fields
 * faster than this type is updated, and an unknown extra field should never
 * break the frontend. Access to undeclared fields is typed `unknown`, so you
 * still can't use one without narrowing it first.
 */
export interface EdenEvent {
  event_id: number;
  event_name: string;
  club_id?: number | null;
  club_name?: string;
  /** ISO date (yyyy-mm-dd); null/absent when the scraper couldn't determine one. */
  date?: string | null;
  /** "HH:MM:SS" 24h clock. */
  start_time?: string | null;
  end_time?: string | null;
  /** Legacy comma-separated form; prefer event_categories when present. */
  event_category?: string | null;
  event_categories?: string[];
  campus_location?: string | null;
  event_room?: string | null;
  has_free_food?: boolean;
  virtual?: boolean;
  is_open_to_public?: boolean;
  /** Raw Instagram caption. */
  caption?: string | null;
  collaborators?: string[];
  sponsors?: string[];
  engagement_score?: number | null;
  post_url?: string | null;
  [key: string]: unknown;
}

/** Row shape from EDEN's trending/top-risers club endpoints (Home + EventsPage sidebars). */
export interface TrendingClub {
  club_id?: number;
  club_name: string;
  /** Percent change in engagement vs prior period; null = not yet computable. */
  change_pct?: number | null;
  total_likes?: number;
  event_count?: number;
  avg_score?: number;
  [key: string]: unknown;
}
