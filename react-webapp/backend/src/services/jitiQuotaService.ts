/**
 * jitiQuotaService.ts — every Redis key Jiti touches: per-user daily quota,
 * the global daily spend ledger, and device analytics. No HTTP shapes, no
 * Anthropic SDK knowledge — jitiService owns turning these results into API
 * responses and request payloads.
 *
 * TWO-PHASE RESERVE/REFUND/RECONCILE
 * ------------------------------------
 * Every request reserves a slot (INCR the user counter) and a worst-case
 * dollar amount (INCRBY the reserve estimate onto the global ledger) BEFORE
 * calling Anthropic. If either reservation fails its ceiling, Anthropic is
 * never called — see jitiService.chat(). If Anthropic itself fails, both
 * reservations are refunded. On success, the ledger is reconciled against the
 * real `usage` object, because the flat reservation is a worst-case estimate
 * and a cache hit costs far less than a cache write.
 *
 * All dates are America/New_York (the ceiling resets align with campus days,
 * not UTC midnight) via nyDateString/secondsUntilMidnightNY below.
 */

import { redisClient } from "../lib/redis.js"
import type { RedisClientType } from "redis"

// ── Config (env-overridable) ────────────────────────────────────────────────

export function getDailyUserLimit(): number {
  const n = Number(process.env.JITI_DAILY_USER_LIMIT)
  return Number.isFinite(n) && n > 0 ? n : 5
}

export function getGlobalDailyCeilingCents(): number {
  const n = Number(process.env.JITI_GLOBAL_DAILY_CENTS)
  return Number.isFinite(n) && n > 0 ? n : 65
}

export function getReserveCents(): number {
  const n = Number(process.env.JITI_RESERVE_CENTS)
  return Number.isFinite(n) && n > 0 ? n : 3
}

// ── America/New_York date math ──────────────────────────────────────────────

const NY_TZ = "America/New_York"

interface NyParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
}

function nyParts(date: Date): NyParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0")
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  }
}

/** `YYYY-MM-DD` for the quota/ledger key suffix, in America/New_York. */
export function nyDateString(now: Date = new Date()): string {
  const { year, month, day } = nyParts(now)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * Converts a America/New_York wall-clock time (y/m/d/h/mi/s, no offset) to
 * the UTC instant it represents. One-step convergence: guess the offset is
 * zero, see what NY wall time that guess actually lands on, and correct by
 * the difference. This is stable across the DST boundary because the
 * correction is computed from the ACTUAL offset at the guessed instant, not
 * an assumed one — the only case it would need a second iteration is a wall
 * time that falls inside the one skipped/repeated hour on the transition day
 * itself, and midnight is never that hour for US DST rules.
 */
function nyWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number): Date {
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, second)
  const guessed = nyParts(new Date(guessUtcMs))
  const gotUtcMs = Date.UTC(guessed.year, guessed.month - 1, guessed.day, guessed.hour, guessed.minute, guessed.second)
  const wantUtcMs = Date.UTC(year, month - 1, day, hour, minute, second)
  return new Date(guessUtcMs + (wantUtcMs - gotUtcMs))
}

/** The UTC instant of the next America/New_York midnight after `now`. */
export function nyNextMidnightUtc(now: Date = new Date()): Date {
  const { year, month, day } = nyParts(now)
  // Date.UTC normalizes day+1 across month/year boundaries for us.
  const rolled = new Date(Date.UTC(year, month - 1, day + 1))
  return nyWallTimeToUtc(rolled.getUTCFullYear(), rolled.getUTCMonth() + 1, rolled.getUTCDate(), 0, 0, 0)
}

/** Seconds from `now` until the next America/New_York midnight, for EXPIRE. */
export function secondsUntilMidnightNY(now: Date = new Date()): number {
  const midnight = nyNextMidnightUtc(now)
  return Math.max(1, Math.round((midnight.getTime() - now.getTime()) / 1000))
}

/** ISO8601 `resetAt` for API responses — the same instant the Redis keys expire at. */
export function resetAtISOString(now: Date = new Date()): string {
  return nyNextMidnightUtc(now).toISOString()
}

// ── Redis access ─────────────────────────────────────────────────────────────

function requireRedis(): RedisClientType {
  if (!redisClient) {
    throw new Error("[jiti][quota] Redis is not configured — Jiti has no state store")
  }
  return redisClient
}

// ── Per-user quota ───────────────────────────────────────────────────────────

export interface QuotaReserveResult {
  ok: boolean
  used: number
  limit: number
  resetAt: string
}

function userQuotaKey(userId: string, now: Date): string {
  return `jiti:quota:user:${userId}:${nyDateString(now)}`
}

/** INCR then check against the limit; DECRs back out on the spot if it exceeds. */
export async function reserveUserQuota(userId: string, now: Date = new Date()): Promise<QuotaReserveResult> {
  const client = requireRedis()
  const limit = getDailyUserLimit()
  const key = userQuotaKey(userId, now)
  const resetAt = resetAtISOString(now)

  const used = await client.incr(key)
  if (used === 1) {
    await client.expire(key, secondsUntilMidnightNY(now), "NX")
  }

  if (used > limit) {
    await client.decr(key)
    console.info("[jiti][quota]", { userId, used: used - 1, limit, decision: "QUOTA_EXCEEDED" })
    return { ok: false, used: used - 1, limit, resetAt }
  }

  console.info("[jiti][quota]", { userId, used, limit, decision: "RESERVED" })
  return { ok: true, used, limit, resetAt }
}

/** Backs a reservation out — used when Anthropic fails, or when the global
 * ledger rejects a request the user quota already accepted. */
export async function refundUserQuota(userId: string, now: Date = new Date()): Promise<void> {
  const client = requireRedis()
  const key = userQuotaKey(userId, now)
  const used = await client.decr(key)
  console.info("[jiti][quota]", { userId, used, decision: "REFUNDED" })
}

export interface QuotaStatus {
  used: number
  limit: number
  remaining: number
  resetAt: string
}

/** Read-only — no reservation, no side effects. Backs GET /api/jiti/status. */
export async function getUserQuotaStatus(userId: string, now: Date = new Date()): Promise<QuotaStatus> {
  const client = requireRedis()
  const limit = getDailyUserLimit()
  const key = userQuotaKey(userId, now)
  const raw = await client.get(key)
  const used = raw ? Number(raw) : 0
  return { used, limit, remaining: Math.max(0, limit - used), resetAt: resetAtISOString(now) }
}

// ── Global spend ledger ──────────────────────────────────────────────────────

export interface SpendReserveResult {
  ok: boolean
  ledgerBefore: number
  ledgerAfter: number
  reserve: number
  ceiling: number
}

function globalSpendKey(now: Date): string {
  return `jiti:spend:global:${nyDateString(now)}`
}

/** INCRBY the flat per-request reservation; DECRBY back out if it would blow the ceiling. */
export async function reserveGlobalSpend(now: Date = new Date()): Promise<SpendReserveResult> {
  const client = requireRedis()
  const reserve = getReserveCents()
  const ceiling = getGlobalDailyCeilingCents()
  const key = globalSpendKey(now)

  const after = await client.incrBy(key, reserve)
  if (after === reserve) {
    await client.expire(key, secondsUntilMidnightNY(now), "NX")
  }
  const ledgerBefore = after - reserve
  const ok = after <= ceiling

  console.info("[jiti][spend]", { ledgerBefore, reserve, ceiling, decision: ok ? "RESERVED" : "AT_CAPACITY" })

  if (!ok) {
    await client.decrBy(key, reserve)
    return { ok: false, ledgerBefore, ledgerAfter: ledgerBefore, reserve, ceiling }
  }
  return { ok: true, ledgerBefore, ledgerAfter: after, reserve, ceiling }
}

/** Backs a ledger reservation out — used when Anthropic fails after both reservations succeeded. */
export async function refundGlobalSpend(reserveCents: number, now: Date = new Date()): Promise<void> {
  const client = requireRedis()
  const key = globalSpendKey(now)
  await client.decrBy(key, reserveCents)
  console.info("[jiti][spend]", { decision: "REFUNDED", reserveCents })
}

/**
 * True-up against the real `usage` object from a successful Anthropic call.
 * `actualCents` is rounded to the nearest cent before applying — the ledger
 * key is an integer counter, and Redis INCRBY rejects non-integers outright.
 * The delta is commonly negative (a cache hit is far cheaper than the flat
 * reservation, which is sized for a cache WRITE) — that's the expected,
 * intentional case, not a bug.
 */
export async function reconcileGlobalSpend(actualCents: number, reserveCents: number, now: Date = new Date()): Promise<void> {
  const client = requireRedis()
  const key = globalSpendKey(now)
  const rounded = Math.round(actualCents)
  const delta = rounded - reserveCents
  if (delta !== 0) {
    await client.incrBy(key, delta)
  }
  console.info("[jiti][spend]", { actualCents: rounded, reserveCents, delta })
}

// ── Device analytics (never enforcement) ────────────────────────────────────

/** Records which device IDs hit Jiti under a given user/day. Purely for
 * analytics — never read for quota or capacity decisions. */
export async function trackDevice(userId: string, deviceId: string, now: Date = new Date()): Promise<void> {
  const client = requireRedis()
  const key = `jiti:devices:user:${userId}:${nyDateString(now)}`
  await client.sAdd(key, deviceId)
  await client.expire(key, secondsUntilMidnightNY(now), "NX")
}
