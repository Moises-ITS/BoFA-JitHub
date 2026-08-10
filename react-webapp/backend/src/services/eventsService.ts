/**
 * eventsService.ts — the campus events feed: browsing, student submissions, and
 * RSVPs.
 *
 * HISTORY / WHY THIS LIVES HERE NOW
 * ---------------------------------
 * These endpoints used to be a separate FastAPI service ("EDEN") on port 8000,
 * which the frontend called directly. That service read and wrote the SAME
 * Postgres this backend already connects to — `events`, `clubs`, `event_posts`,
 * `event_rsvps`, `collaborations`, `sponsors` are all in the main database. The
 * split bought nothing and cost a second deployment that was never configured
 * in production, so the logic moved here. No schema changed; every query below
 * targets tables that already exist.
 *
 * THE event_posts JOIN
 * --------------------
 * An event's engagement metrics live in `event_posts`, one row per promo post.
 * The original feed used an INNER JOIN, which silently hid any event without a
 * post row. Student-submitted events get a companion `event_posts` row created
 * in the same transaction (see createCommunityEvent) precisely so they remain
 * visible — but a LEFT JOIN is used for reads regardless, so a missing post row
 * can never make a student's event disappear from the feed again.
 */

import type { PoolClient } from "pg"
import { db } from "../config/postgres.js"
import {
  findMatchingClub,
  getClubAliases,
  getClubDisplayName,
  normalizeClubText,
  resolveCanonicalClubName,
  serializeClubCollection,
  type ClubRow,
} from "./clubDirectory.js"

/**
 * The academic term the feed is scoped to.
 *
 * This REPLACED two hardcoded constants (2026-01-01 → 2026-05-25) inherited
 * from the previous service. Those dates silently expired: once the calendar
 * passed May 25 2026, `date <= SEMESTER_END` excluded everything, so
 * /events/upcoming returned [] and the heatmap had zero weeks — including for
 * events students had just submitted. A feed that empties itself on a fixed
 * date is indistinguishable from a broken feed, which is precisely how it read.
 *
 * Computed per call, not at module load: a long-running server must roll into
 * the next term without a redeploy.
 *
 * Override with SEMESTER_START_DATE / SEMESTER_END_DATE (YYYY-MM-DD) when the
 * real academic calendar doesn't match these approximations.
 */
export function currentTerm(today: Date = new Date()): { start: string; end: string } {
  const envStart = process.env.SEMESTER_START_DATE
  const envEnd = process.env.SEMESTER_END_DATE
  if (envStart && envEnd && /^\d{4}-\d{2}-\d{2}$/.test(envStart) && /^\d{4}-\d{2}-\d{2}$/.test(envEnd)) {
    return { start: envStart, end: envEnd }
  }

  const year = today.getFullYear()
  const month = today.getMonth() + 1
  // Fall runs into winter break, so its end is the turn of the year; Spring and
  // the short summer session each sit inside one calendar year.
  if (month >= 8) return { start: `${year}-08-01`, end: `${year}-12-31` }
  if (month <= 5) return { start: `${year}-01-01`, end: `${year}-05-31` }
  return { start: `${year}-06-01`, end: `${year}-07-31` }
}

/** Preview length. Shared by the REST attendee endpoints AND the realtime
 * rsvp.changed payload — if they disagreed, the list would visibly change
 * length whenever a socket message arrived. */
export const PREVIEW_LIMIT = 20

export interface AttendeeSnapshot {
  count: number
  preview: Array<{ user_id: string; user_name: string; user_major: string }>
}

/** `date` columns come back from pg as JS Dates; the API contract is "YYYY-MM-DD". */
function dateStr(value: unknown): string | null {
  if (value instanceof Date) {
    // Format from local parts, not toISOString(): a date-only column is
    // midnight local, and UTC conversion would shift it to the previous day for
    // any timezone west of Greenwich — every NJIT event landing a day early.
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, "0")
    const d = String(value.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  return (value as string | null) ?? null
}

function parseCategories(value: string | null): string[] {
  if (!value) return []
  const categories: string[] = []
  for (const raw of value.split(",")) {
    const cleaned = raw.trim().toLowerCase()
    if (cleaned && !categories.includes(cleaned)) categories.push(cleaned)
  }
  return categories
}

/** Row shape produced by every feed query below (see EVENT_SELECT). */
interface EventRow {
  event_id: number
  event_name: string
  event_type: string | null
  event_category: string | null
  date: Date | string | null
  start_time: string | null
  end_time: string | null
  campus_location: string | null
  event_room: string | null
  has_free_food: boolean | null
  virtual: boolean | null
  is_external: boolean | null
  is_open_to_public: boolean | null
  event_link: string | null
  club_id: number | null
  club_name: string | null
  instagram_handle: string | null
  likes: number | null
  comments: number | null
  engagement_score: string | number | null
  post_url: string | null
  caption: string | null
}

/**
 * One post per event. `event_posts` can hold several rows for the same event
 * (a promo plus a recap); DISTINCT ON collapses to the highest-engagement one
 * so an event never appears twice in the feed.
 */
const EVENT_POST = `
  LEFT JOIN LATERAL (
    SELECT p.likes, p.comments, p.engagement_score, p.post_url, p.caption, p.post_datetime
    FROM event_posts p
    WHERE p.event_id = e.event_id
    ORDER BY p.engagement_score DESC NULLS LAST, p.post_id ASC
    LIMIT 1
  ) p ON TRUE`

const EVENT_SELECT = `
  SELECT e.event_id, e.event_name, e.event_type, e.event_category, e.date,
         e.start_time, e.end_time, e.campus_location, e.event_room,
         e.has_free_food, e.virtual, e.is_external, e.is_open_to_public, e.event_link,
         e.club_id, c.name AS club_name, c.instagram_handle,
         p.likes, p.comments, p.engagement_score, p.post_url, p.caption
  FROM events e
  LEFT JOIN clubs c ON c.club_id = e.club_id
  ${EVENT_POST}`

function formatEvent(row: EventRow) {
  const eventDate = dateStr(row.date)
  let daysUntil: number | null = null
  if (eventDate) {
    const today = new Date()
    const midnightToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    const [y, m, d] = eventDate.split("-").map(Number)
    daysUntil = Math.round((Date.UTC(y, m - 1, d) - midnightToday) / 86_400_000)
  }
  const categories = parseCategories(row.event_category)
  const rawClubName = row.club_name ?? ""
  const canonicalClubName = resolveCanonicalClubName(rawClubName)
  const engagement = row.engagement_score == null ? null : Number(row.engagement_score)

  return {
    event_id: row.event_id,
    event_name: row.event_name,
    event_type: row.event_type,
    event_category: categories[0] ?? null,
    event_categories: categories,
    date: eventDate,
    days_until: daysUntil,
    start_time: row.start_time,
    end_time: row.end_time,
    campus_location: row.campus_location,
    event_room: row.event_room,
    has_free_food: row.has_free_food,
    virtual: row.virtual,
    is_external: row.is_external,
    is_open_to_public: row.is_open_to_public,
    event_link: row.event_link,
    club_id: row.club_id,
    club_name: getClubDisplayName(canonicalClubName),
    club_full_name: canonicalClubName,
    club_aliases: getClubAliases(canonicalClubName, row.instagram_handle),
    likes: row.likes,
    comments: row.comments,
    engagement_score: engagement,
    post_url: row.post_url,
    caption: row.caption,
  }
}

export type FormattedEvent = ReturnType<typeof formatEvent>

// ── Deduplication ────────────────────────────────────────────────────────────
// The clubs table accumulated duplicates from scraping, so the same real-world
// event can exist as several rows under near-identical names. These helpers are
// a direct port of the previous service's behaviour.

const IGNORE_WORDS = new Set([
  "event", "njit", "night", "annual", "first", "about", "your",
  "with", "week", "fall", "spring", "summer", "winter",
])

/** Ratio of the longest common subsequence to total length — a cheap stand-in
 * for Python's difflib.SequenceMatcher.ratio(), which has no JS equivalent. */
function similarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0
  const rows = a.length + 1
  const cols = b.length + 1
  let prev = new Array<number>(cols).fill(0)
  let curr = new Array<number>(cols).fill(0)
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1])
    }
    ;[prev, curr] = [curr, prev]
    curr.fill(0)
  }
  return (2 * prev[cols - 1]) / (a.length + b.length)
}

function namesAreDupes(a: string, b: string): boolean {
  if (similarity(a, b) >= 0.75) return true
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length >= 5 && !IGNORE_WORDS.has(w)))
  const wordsB = a === b ? wordsA : new Set(b.split(/\s+/).filter(w => w.length >= 5 && !IGNORE_WORDS.has(w)))
  if (wordsA.size === 0 || wordsB.size === 0) return false
  for (const word of wordsA) if (wordsB.has(word)) return true
  return false
}

function scoreOf(row: EventRow): number {
  return row.engagement_score == null ? 0 : Number(row.engagement_score)
}

/** Exact-name dedup first (keep highest engagement), then fuzzy within a date. */
function deduplicate(rows: EventRow[]): EventRow[] {
  const byName = new Map<string, EventRow>()
  for (const row of rows) {
    const name = row.event_name.trim().toLowerCase()
    const existing = byName.get(name)
    if (!existing || scoreOf(row) > scoreOf(existing)) byName.set(name, row)
  }

  const candidates = [...byName.values()]
  const kept: EventRow[] = []
  const used = new Set<number>()
  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i)) continue
    let best = candidates[i]
    const nameI = candidates[i].event_name.trim().toLowerCase()
    const dateI = dateStr(candidates[i].date)
    for (let j = i + 1; j < candidates.length; j++) {
      if (used.has(j)) continue
      if (dateI !== dateStr(candidates[j].date)) continue
      if (!namesAreDupes(nameI, candidates[j].event_name.trim().toLowerCase())) continue
      used.add(j)
      if (scoreOf(candidates[j]) > scoreOf(best)) best = candidates[j]
    }
    kept.push(best)
  }
  return kept
}

// ── Feed reads ───────────────────────────────────────────────────────────────

export async function getUpcoming(limit: number, category: string | null): Promise<FormattedEvent[]> {
  const params: unknown[] = [currentTerm().end, limit * 3]
  let categoryFilter = ""
  if (category) {
    params.push(`%${category}%`)
    categoryFilter = ` AND e.event_category ILIKE $${params.length}`
  }
  const { rows } = await db.query<EventRow>(
    `${EVENT_SELECT}
     WHERE e.date IS NOT NULL
       AND e.date >= CURRENT_DATE
       AND e.date <= $1::date${categoryFilter}
     ORDER BY e.date ASC, e.start_time ASC NULLS LAST
     LIMIT $2`,
    params
  )
  return deduplicate(rows).slice(0, limit).map(formatEvent)
}

export async function getTrending(limit: number, upcomingOnly: boolean): Promise<FormattedEvent[]> {
  const { rows: likeRows } = await db.query<{ club_id: number; total: string }>(
    `SELECT e.club_id, COALESCE(SUM(p.likes), 0) AS total
     FROM events e JOIN event_posts p ON p.event_id = e.event_id
     WHERE p.post_datetime >= $1::date AND e.club_id IS NOT NULL
     GROUP BY e.club_id`,
    [currentTerm().start]
  )
  const clubLikes = new Map(likeRows.map(r => [r.club_id, Number(r.total) || 0]))

  const dateFilter = upcomingOnly
    ? "AND e.date IS NOT NULL AND e.date >= CURRENT_DATE AND e.date <= $1::date"
    : ""
  const { rows } = await db.query<EventRow>(
    `${EVENT_SELECT} WHERE TRUE ${dateFilter} ORDER BY p.engagement_score DESC NULLS LAST LIMIT $2`,
    [currentTerm().end, limit * 5]
  )

  const deduped = deduplicate(rows)
  deduped.sort((a, b) => {
    const clubDiff = (clubLikes.get(b.club_id ?? -1) ?? 0) - (clubLikes.get(a.club_id ?? -1) ?? 0)
    return clubDiff !== 0 ? clubDiff : scoreOf(b) - scoreOf(a)
  })
  return deduped.slice(0, limit).map(formatEvent)
}

export async function getTopRisers(limit: number): Promise<FormattedEvent[]> {
  const { rows } = await db.query<EventRow>(
    `${EVENT_SELECT}
     WHERE p.engagement_score IS NOT NULL AND p.post_datetime >= $1::date
     ORDER BY p.engagement_score DESC
     LIMIT $2`,
    [currentTerm().start, limit * 3]
  )
  return deduplicate(rows).slice(0, limit).map(formatEvent)
}

export async function getClubsTrending(limit: number) {
  const { rows } = await db.query(
    `SELECT c.club_id, c.name,
            COALESCE(SUM(p.likes), 0)::int AS total_likes,
            COUNT(p.post_id)::int AS event_count
     FROM clubs c
     JOIN events e ON e.club_id = c.club_id
     JOIN event_posts p ON p.event_id = e.event_id
     WHERE p.post_datetime >= $1::date
     GROUP BY c.club_id, c.name
     ORDER BY SUM(p.likes) DESC NULLS LAST
     LIMIT $2`,
    [currentTerm().start, limit]
  )
  return rows.map((r, i) => ({
    rank: i + 1,
    club_id: r.club_id,
    club_name: getClubDisplayName(r.name),
    total_likes: Number(r.total_likes) || 0,
    event_count: Number(r.event_count) || 0,
    change_pct: null,
  }))
}

export async function getClubsTopRisers(limit: number) {
  const { rows } = await db.query(
    `SELECT c.club_id, c.name,
            AVG(p.engagement_score)::float AS avg_score,
            COUNT(p.post_id)::int AS event_count
     FROM clubs c
     JOIN events e ON e.club_id = c.club_id
     JOIN event_posts p ON p.event_id = e.event_id
     WHERE p.engagement_score IS NOT NULL AND p.post_datetime >= $1::date
     GROUP BY c.club_id, c.name
     ORDER BY AVG(p.engagement_score) DESC
     LIMIT $2`,
    [currentTerm().start, limit]
  )
  return rows.map((r, i) => ({
    rank: i + 1,
    club_id: r.club_id,
    club_name: getClubDisplayName(r.name),
    avg_score: Math.round((Number(r.avg_score) || 0) * 100) / 100,
    event_count: Number(r.event_count) || 0,
  }))
}

export async function getEventById(eventId: number) {
  const { rows } = await db.query<EventRow>(`${EVENT_SELECT} WHERE e.event_id = $1`, [eventId])
  if (rows.length === 0) return null

  const data = formatEvent(rows[0]) as FormattedEvent & { collaborators: string[]; sponsors: string[] }
  const [collabs, sponsors] = await Promise.all([
    db.query("SELECT partner_name FROM collaborations WHERE event_id = $1", [eventId]),
    db.query("SELECT sponsor_name FROM sponsors WHERE event_id = $1", [eventId]),
  ])
  data.collaborators = collabs.rows.map(r => r.partner_name)
  data.sponsors = sponsors.rows.map(r => r.sponsor_name)
  return data
}

// ── Club directory ───────────────────────────────────────────────────────────

async function loadClubs(): Promise<ClubRow[]> {
  const { rows } = await db.query<ClubRow>(
    "SELECT club_id, name, instagram_handle, follower_count, bio FROM clubs ORDER BY name ASC"
  )
  return rows
}

export async function getClubDirectory() {
  return serializeClubCollection(await loadClubs())
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

const HEATMAP_HOURS = [8, 10, 12, 14, 16, 18, 20, 22]

function mondayOf(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // getDay() is 0=Sunday; shift so Monday starts the week.
  const offset = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - offset)
  return copy
}

function bucketHour(startTime: string | null): number {
  if (!startTime) return 12
  const [h, m] = startTime.split(":").map(Number)
  const minutes = h * 60 + (m || 0)
  return HEATMAP_HOURS.reduce((best, slot) =>
    Math.abs(slot * 60 - minutes) < Math.abs(best * 60 - minutes) ? slot : best
  )
}

export function getHeatmapWeeks(): string[] {
  const weeks: string[] = []
  const cursor = mondayOf(new Date())
  const [ey, em, ed] = currentTerm().end.split("-").map(Number)
  const endMonday = mondayOf(new Date(ey, em - 1, ed))
  while (cursor <= endMonday) {
    weeks.push(dateStr(cursor)!)
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

interface HeatmapSlot {
  event_id: number
  event_name: string
  club_name: string | null
  start_time: string | null
  post_url: string | null
}

/** Collapse near-identical names within one day/hour cell, preferring an entry
 * that carries a post_url so the cell stays clickable. */
function fuzzyDedupSlots(slots: HeatmapSlot[]): HeatmapSlot[] {
  const kept: HeatmapSlot[] = []
  const used = new Set<number>()
  for (let i = 0; i < slots.length; i++) {
    if (used.has(i)) continue
    let best = slots[i]
    const nameI = slots[i].event_name.trim().toLowerCase()
    for (let j = i + 1; j < slots.length; j++) {
      if (used.has(j)) continue
      if (!namesAreDupes(nameI, slots[j].event_name.trim().toLowerCase())) continue
      used.add(j)
      if (!best.post_url && slots[j].post_url) best = slots[j]
    }
    kept.push(best)
  }
  return kept
}

export async function getHeatmapWeek(weekStart: string | null) {
  const monday = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
    ? (() => { const [y, m, d] = weekStart.split("-").map(Number); return new Date(y, m - 1, d) })()
    : mondayOf(new Date())
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)

  const { rows } = await db.query(
    `SELECT e.event_id, e.event_name, e.date, e.start_time, c.name AS club_name, p.post_url
     FROM events e
     LEFT JOIN clubs c ON c.club_id = e.club_id
     ${EVENT_POST}
     WHERE e.date >= $1::date AND e.date <= LEAST($2::date, $3::date)
     ORDER BY e.event_id ASC`,
    [dateStr(monday), dateStr(sunday), currentTerm().end]
  )

  const grid: Record<string, HeatmapSlot[]> = {}
  const seen = new Set<number>()
  for (const row of rows) {
    if (seen.has(row.event_id)) continue
    seen.add(row.event_id)
    const eventDate = dateStr(row.date)
    if (!eventDate) continue
    const [y, m, d] = eventDate.split("-").map(Number)
    const day = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" })
    const key = `${day}:${bucketHour(row.start_time)}`
    ;(grid[key] ??= []).push({
      event_id: row.event_id,
      event_name: row.event_name,
      club_name: row.club_name,
      start_time: row.start_time ? String(row.start_time).slice(0, 5) : null,
      post_url: row.post_url,
    })
  }

  return Object.fromEntries(Object.entries(grid).map(([key, slots]) => [key, fuzzyDedupSlots(slots)]))
}

// ── Student submissions ──────────────────────────────────────────────────────

export interface CommunityEventInput {
  club_name?: unknown
  event_name?: unknown
  event_category?: unknown
  event_categories?: unknown
  collaborators?: unknown
  corporate_partners?: unknown
  date?: unknown
  start_time?: unknown
  end_time?: unknown
  campus_location?: unknown
  event_room?: unknown
  virtual?: unknown
  has_free_food?: unknown
  is_open_to_public?: unknown
  event_link?: unknown
  description?: unknown
}

/** Thrown for input the student can fix; the route maps `status` straight through. */
export class EventValidationError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message)
    this.name = "EventValidationError"
  }
}

const TIME_RE = /^\d{1,2}:\d{2}(:\d{2})?$/

function normalizeTime(value: unknown, field: string, required: boolean): string | null {
  if (typeof value !== "string" || !value.trim()) {
    if (required) throw new EventValidationError(`${field} is required`)
    return null
  }
  const trimmed = value.trim()
  if (!TIME_RE.test(trimmed)) throw new EventValidationError("Invalid time format. Use HH:MM.")
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed
}

function normalizeCategories(input: CommunityEventInput): string[] {
  const raw = Array.isArray(input.event_categories)
    ? input.event_categories
    : input.event_category == null ? [] : [input.event_category]
  const categories: string[] = []
  for (const value of raw) {
    const cleaned = typeof value === "string" ? value.trim().toLowerCase() : ""
    if (cleaned && !categories.includes(cleaned)) categories.push(cleaned)
  }
  return categories
}

function uniquePartnerNames(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const unique: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const cleaned = typeof value === "string" ? value.trim().split(/\s+/).join(" ") : ""
    const normalized = normalizeClubText(cleaned)
    if (!cleaned || !normalized || seen.has(normalized)) continue
    seen.add(normalized)
    unique.push(cleaned)
  }
  return unique
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Create a student-submitted event.
 *
 * Runs in an explicit transaction on ONE client: the event, its companion
 * event_posts row, and any collaborator/sponsor rows must land together. A
 * partial write here produces an event that the feed cannot render, which is
 * exactly the state that made submissions look like they silently vanished.
 */
export async function createCommunityEvent(
  input: CommunityEventInput,
  submittedBy: string
): Promise<FormattedEvent & { collaborators: string[]; sponsors: string[] }> {
  const clubName = str(input.club_name)
  const eventName = str(input.event_name)
  const categories = normalizeCategories(input)
  const campusLocation = str(input.campus_location)
  const eventRoom = str(input.event_room)
  const eventLink = str(input.event_link)
  const description = str(input.description)
  const virtual = Boolean(input.virtual)
  const eventDate = str(input.date)

  if (!clubName) throw new EventValidationError("Club is required")
  if (!eventName) throw new EventValidationError("Event name is required")
  if (categories.length === 0) throw new EventValidationError("Pick at least one event category")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new EventValidationError("date (YYYY-MM-DD) is required")
  if (!virtual && !campusLocation) {
    throw new EventValidationError("Campus location is required for in-person events")
  }

  const startTime = normalizeTime(input.start_time, "start_time", true)!
  const endTime = normalizeTime(input.end_time, "end_time", false)

  const clubs = await loadClubs()
  const match = findMatchingClub(clubs, clubName)
  const primaryClubName = resolveCanonicalClubName(match ? match.name : clubName)

  const collaborators = uniquePartnerNames(input.collaborators)
    .map(name => {
      const found = findMatchingClub(clubs, name)
      return resolveCanonicalClubName(found ? found.name : name)
    })
    .filter(name => normalizeClubText(name) !== normalizeClubText(primaryClubName))
  const sponsors = uniquePartnerNames(input.corporate_partners)

  const participants = new Set(
    [primaryClubName, ...collaborators].map(normalizeClubText).filter(Boolean)
  )

  // Duplicate guard: same title, same date, same start time, and at least one
  // club in common. Two different clubs may legitimately run identically-named
  // events in the same slot, so the club overlap is what makes it a duplicate.
  const { rows: sameSlot } = await db.query(
    `SELECT e.event_id, e.event_name, c.name AS club_name
     FROM events e LEFT JOIN clubs c ON c.club_id = e.club_id
     WHERE e.date = $1::date AND e.start_time = $2::time`,
    [eventDate, startTime]
  )
  const normalizedNew = eventName.toLowerCase().split(/\s+/).join(" ")
  for (const existing of sameSlot) {
    if (existing.event_name.toLowerCase().split(/\s+/).join(" ") !== normalizedNew) continue
    const { rows: existingCollabs } = await db.query(
      "SELECT partner_name FROM collaborations WHERE event_id = $1",
      [existing.event_id]
    )
    const existingParticipants = new Set(
      [existing.club_name, ...existingCollabs.map(r => r.partner_name)]
        .filter((n): n is string => Boolean(n && n.trim()))
        .map(n => normalizeClubText(resolveCanonicalClubName(n)))
        .filter(Boolean)
    )
    for (const name of participants) {
      if (existingParticipants.has(name)) {
        throw new EventValidationError(
          "An event with the same title, date, and time already exists for one of the participating clubs.",
          409
        )
      }
    }
  }

  const client: PoolClient = await db.connect()
  let newEventId: number
  try {
    await client.query("BEGIN")

    let clubId: number | null = match?.club_id ?? null
    if (clubId == null) {
      const inserted = await client.query(
        "INSERT INTO clubs (name, is_active) VALUES ($1, TRUE) RETURNING club_id",
        [clubName]
      )
      clubId = inserted.rows[0].club_id as number
    }

    const dayOfWeek = (() => {
      const [y, m, d] = eventDate.split("-").map(Number)
      return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" })
    })()

    const eventInsert = await client.query(
      `INSERT INTO events (
         club_id, event_name, event_type, date, day_of_week, start_time, end_time,
         virtual, is_external, campus_location, event_room, has_free_food,
         is_open_to_public, event_link, promo_link, event_category
       ) VALUES ($1,$2,'promo',$3::date,$4,$5::time,$6::time,$7,FALSE,$8,$9,$10,$11,$12,$12,$13)
       RETURNING event_id`,
      [
        clubId, eventName, eventDate, dayOfWeek, startTime, endTime,
        virtual, campusLocation || null, eventRoom || null, Boolean(input.has_free_food),
        input.is_open_to_public !== false, eventLink || null, categories.join(", "),
      ]
    )
    newEventId = eventInsert.rows[0].event_id as number

    // The companion post row carries the description and keeps this event on
    // equal footing with scraped ones in every engagement-ordered query.
    await client.query(
      `INSERT INTO event_posts (
         event_id, post_type, post_datetime, likes, likes_estimated, comments,
         engagement_score, post_url, caption
       ) VALUES ($1, 'promo', NOW(), 0, FALSE, 0, 0, $2, $3)`,
      [newEventId, eventLink || null, description || null]
    )

    for (const name of collaborators) {
      await client.query(
        "INSERT INTO collaborations (event_id, partner_name) VALUES ($1, $2)",
        [newEventId, name]
      )
    }
    for (const name of sponsors) {
      await client.query(
        "INSERT INTO sponsors (event_id, sponsor_name) VALUES ($1, $2)",
        [newEventId, name]
      )
    }

    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    throw err
  } finally {
    client.release()
  }

  console.info("[events][created]", { eventId: newEventId, submittedBy, club: primaryClubName })

  const created = await getEventById(newEventId)
  if (!created) throw new Error("Event vanished immediately after creation")
  created.collaborators = collaborators
  created.sponsors = sponsors
  return created
}

// ── RSVPs ────────────────────────────────────────────────────────────────────

export async function getAttendees(eventId: number): Promise<AttendeeSnapshot> {
  const { rows } = await db.query(
    `SELECT user_id, user_name, user_major FROM event_rsvps
     WHERE event_id = $1 AND status = 'going'
     ORDER BY rsvp_time DESC NULLS LAST`,
    [eventId]
  )
  return {
    count: rows.length,
    preview: rows.slice(0, PREVIEW_LIMIT).map(r => ({
      user_id: r.user_id,
      user_name: r.user_name || "Anonymous",
      user_major: r.user_major || "",
    })),
  }
}

export async function getBatchAttendees(eventIds: number[]): Promise<Record<string, AttendeeSnapshot>> {
  const result: Record<string, AttendeeSnapshot> = {}
  for (const id of eventIds) result[String(id)] = { count: 0, preview: [] }
  if (eventIds.length === 0) return result

  const { rows } = await db.query(
    `SELECT event_id, user_id, user_name, user_major FROM event_rsvps
     WHERE event_id = ANY($1::int[]) AND status = 'going'
     ORDER BY event_id ASC, rsvp_time DESC NULLS LAST`,
    [eventIds]
  )
  for (const row of rows) {
    const entry = result[String(row.event_id)]
    if (!entry) continue
    entry.count += 1
    if (entry.preview.length < PREVIEW_LIMIT) {
      entry.preview.push({
        user_id: row.user_id,
        user_name: row.user_name || "Anonymous",
        user_major: row.user_major || "",
      })
    }
  }
  return result
}

export async function getBatchStatus(userId: string, eventIds: number[]): Promise<Record<string, string>> {
  if (eventIds.length === 0) return {}
  const { rows } = await db.query(
    "SELECT event_id, status FROM event_rsvps WHERE user_id = $1 AND event_id = ANY($2::int[])",
    [userId, eventIds]
  )
  return Object.fromEntries(rows.map(r => [String(r.event_id), r.status]))
}

export async function getUserRsvps(userId: string) {
  const { rows } = await db.query(
    `SELECT r.event_id, r.status, r.rsvp_time,
            e.event_name, e.date, e.start_time, e.event_category, e.virtual, e.has_free_food,
            c.name AS club_name
     FROM event_rsvps r
     JOIN events e ON e.event_id = r.event_id
     LEFT JOIN clubs c ON c.club_id = e.club_id
     WHERE r.user_id = $1 AND r.status = 'going'
     ORDER BY e.date ASC NULLS LAST`,
    [userId]
  )
  return rows.map(r => ({
    event_id: r.event_id,
    status: r.status,
    rsvp_time: r.rsvp_time instanceof Date ? r.rsvp_time.toISOString() : r.rsvp_time,
    event_name: r.event_name,
    date: dateStr(r.date),
    start_time: r.start_time,
    event_category: r.event_category,
    virtual: r.virtual,
    has_free_food: r.has_free_food,
    club_name: r.club_name ? getClubDisplayName(resolveCanonicalClubName(r.club_name)) : "NJIT",
  }))
}

export async function upsertRsvp(
  eventId: number,
  userId: string,
  profile: { user_name?: unknown; user_major?: unknown; user_interests?: unknown; user_clubs?: unknown },
  status: string
): Promise<void> {
  await db.query(
    `INSERT INTO event_rsvps (event_id, user_id, user_name, user_major, user_interests, user_clubs, status, rsvp_time)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (event_id, user_id) DO UPDATE SET
       status = EXCLUDED.status,
       user_name = EXCLUDED.user_name,
       user_major = EXCLUDED.user_major,
       user_interests = EXCLUDED.user_interests,
       user_clubs = EXCLUDED.user_clubs,
       rsvp_time = NOW()`,
    [
      eventId, userId,
      typeof profile.user_name === "string" ? profile.user_name : null,
      typeof profile.user_major === "string" ? profile.user_major : null,
      typeof profile.user_interests === "string" ? profile.user_interests : null,
      typeof profile.user_clubs === "string" ? profile.user_clubs : null,
      status,
    ]
  )
}

export async function deleteRsvp(eventId: number, userId: string): Promise<void> {
  await db.query("DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2", [eventId, userId])
}
