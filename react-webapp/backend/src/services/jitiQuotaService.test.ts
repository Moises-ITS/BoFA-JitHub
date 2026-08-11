// ─────────────────────────────────────────────────────────────────────────────
// services/jitiQuotaService.test.ts
// Every Redis key jiti touches, against an in-memory fake client. Covers the
// two-phase reserve/refund/reconcile arithmetic and the America/New_York
// midnight math (including across the DST boundary — the one place "seconds
// until midnight" quietly gets sign-flipped if you assume a 24h day).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fake Redis ───────────────────────────────────────────────────────────────

function makeFakeRedis() {
  const store = new Map<string, number>()
  const sets = new Map<string, Set<string>>()
  const expiries = new Set<string>()

  return {
    async incr(key: string) {
      const next = (store.get(key) ?? 0) + 1
      store.set(key, next)
      return next
    },
    async decr(key: string) {
      const next = (store.get(key) ?? 0) - 1
      store.set(key, next)
      return next
    },
    async incrBy(key: string, n: number) {
      const next = (store.get(key) ?? 0) + n
      store.set(key, next)
      return next
    },
    async decrBy(key: string, n: number) {
      const next = (store.get(key) ?? 0) - n
      store.set(key, next)
      return next
    },
    async get(key: string) {
      const v = store.get(key)
      return v === undefined ? null : String(v)
    },
    async expire(key: string, _seconds: number, mode?: 'NX' | 'XX' | 'GT' | 'LT') {
      if (mode === 'NX' && expiries.has(key)) return 0
      expiries.add(key)
      return 1
    },
    async sAdd(key: string, member: string) {
      const set = sets.get(key) ?? new Set<string>()
      const before = set.size
      set.add(member)
      sets.set(key, set)
      return set.size - before
    },
    _store: store,
    _sets: sets,
    _reset() {
      store.clear()
      sets.clear()
      expiries.clear()
    },
  }
}

const fakeRedis = makeFakeRedis()

vi.mock('../lib/redis.js', () => ({
  redisClient: fakeRedis,
  isRedisConfigured: () => true,
}))

const quota = await import('./jitiQuotaService.js')

beforeEach(() => {
  fakeRedis._reset()
})

// ── Per-user quota ───────────────────────────────────────────────────────────

describe('reserveUserQuota / refundUserQuota', () => {
  it('allows requests up to the limit, then rejects the next one without leaving a phantom increment', async () => {
    const limit = quota.getDailyUserLimit() // default 5
    const now = new Date('2026-06-15T16:00:00Z')

    for (let i = 1; i <= limit; i++) {
      const result = await quota.reserveUserQuota('user-1', now)
      expect(result.ok).toBe(true)
      expect(result.used).toBe(i)
    }

    const sixth = await quota.reserveUserQuota('user-1', now)
    expect(sixth.ok).toBe(false)
    expect(sixth.used).toBe(limit)

    const status = await quota.getUserQuotaStatus('user-1', now)
    expect(status.used).toBe(limit) // the rejected 6th attempt left no trace
  })

  it('refund brings the counter back to its pre-reservation value', async () => {
    const now = new Date('2026-06-15T16:00:00Z')
    await quota.reserveUserQuota('user-2', now)
    await quota.reserveUserQuota('user-2', now)
    expect((await quota.getUserQuotaStatus('user-2', now)).used).toBe(2)

    await quota.refundUserQuota('user-2', now)
    expect((await quota.getUserQuotaStatus('user-2', now)).used).toBe(1)
  })

  it('two different deviceIds under the same userId share one counter', async () => {
    // The quota key is userId+date only — deviceId never enters it, so calls
    // "from" two devices are indistinguishable at the quota layer.
    const now = new Date('2026-06-15T16:00:00Z')
    await quota.reserveUserQuota('user-3', now)
    await quota.trackDevice('user-3', 'device-A', now)
    await quota.reserveUserQuota('user-3', now)
    await quota.trackDevice('user-3', 'device-B', now)

    expect((await quota.getUserQuotaStatus('user-3', now)).used).toBe(2)
  })
})

// ── Global spend ledger ──────────────────────────────────────────────────────

describe('reserveGlobalSpend / refundGlobalSpend', () => {
  it('rejects when the reservation would exceed the ceiling, and rolls the ledger back', async () => {
    const now = new Date('2026-06-15T16:00:00Z')
    const key = `jiti:spend:global:${quota.nyDateString(now)}`
    fakeRedis._store.set(key, 64) // one reservation away from the default 65-cent ceiling

    const result = await quota.reserveGlobalSpend(now)

    expect(result.ok).toBe(false)
    expect(fakeRedis._store.get(key)).toBe(64) // rolled back, not left at 67
  })

  it('accepts when the reservation fits under the ceiling', async () => {
    const now = new Date('2026-06-15T16:00:00Z')
    const key = `jiti:spend:global:${quota.nyDateString(now)}`
    fakeRedis._store.set(key, 60)

    const result = await quota.reserveGlobalSpend(now)

    expect(result.ok).toBe(true)
    expect(fakeRedis._store.get(key)).toBe(63)
  })

  it('refund subtracts the reservation back out', async () => {
    const now = new Date('2026-06-15T16:00:00Z')
    const key = `jiti:spend:global:${quota.nyDateString(now)}`
    await quota.reserveGlobalSpend(now)
    expect(fakeRedis._store.get(key)).toBe(quota.getReserveCents())

    await quota.refundGlobalSpend(quota.getReserveCents(), now)
    expect(fakeRedis._store.get(key)).toBe(0)
  })
})

describe('reconcileGlobalSpend', () => {
  it('applies the real usage-derived delta, not the flat reservation', async () => {
    const now = new Date('2026-06-15T16:00:00Z')
    const key = `jiti:spend:global:${quota.nyDateString(now)}`
    const reserve = quota.getReserveCents() // 3
    await quota.reserveGlobalSpend(now)
    expect(fakeRedis._store.get(key)).toBe(reserve)

    // A cache-hit request costs far less than the flat cache-write reservation.
    await quota.reconcileGlobalSpend(1, reserve, now)

    expect(fakeRedis._store.get(key)).toBe(1) // NOT still `reserve`
  })

  it('rounds the actual cost to the nearest cent before applying (integer ledger)', async () => {
    const now = new Date('2026-06-15T16:00:00Z')
    const key = `jiti:spend:global:${quota.nyDateString(now)}`
    const reserve = quota.getReserveCents()
    await quota.reserveGlobalSpend(now)

    await quota.reconcileGlobalSpend(2.4, reserve, now)

    expect(fakeRedis._store.get(key)).toBe(2)
    expect(Number.isInteger(fakeRedis._store.get(key))).toBe(true)
  })
})

// ── America/New_York midnight math ──────────────────────────────────────────

describe('secondsUntilMidnightNY across the DST boundary', () => {
  it('November — DST end (fall back, EDT -04:00 -> EST -05:00 at 06:00 UTC on 2020-11-01)', () => {
    // 2020-11-01T10:00:00Z is already EST (offset -05:00) -> NY local 05:00.
    const now = new Date('2020-11-01T10:00:00Z')
    expect(quota.nyDateString(now)).toBe('2020-11-01')

    // Next NY midnight is 2020-11-02T00:00:00 EST == 2020-11-02T05:00:00Z.
    const midnight = quota.nyNextMidnightUtc(now)
    expect(midnight.toISOString()).toBe('2020-11-02T05:00:00.000Z')
    expect(quota.secondsUntilMidnightNY(now)).toBe(19 * 3600)
  })

  it('March — DST start (spring forward, EST -05:00 -> EDT -04:00 at 07:00 UTC on 2020-03-08)', () => {
    // 2020-03-08T10:00:00Z is already EDT (offset -04:00) -> NY local 06:00.
    const now = new Date('2020-03-08T10:00:00Z')
    expect(quota.nyDateString(now)).toBe('2020-03-08')

    // Next NY midnight is 2020-03-09T00:00:00 EDT == 2020-03-09T04:00:00Z.
    const midnight = quota.nyNextMidnightUtc(now)
    expect(midnight.toISOString()).toBe('2020-03-09T04:00:00.000Z')
    expect(quota.secondsUntilMidnightNY(now)).toBe(18 * 3600)
  })

  it('a target midnight that falls before the same day\'s later transition still uses the correct offset', () => {
    // 2020-11-01T03:00:00Z is still EDT (-04:00) -> NY local 2020-10-31T23:00 EDT.
    // The books-closing midnight (2020-11-01T00:00 EDT) is BEFORE that day's
    // 2am transition, so it must resolve using the EDT offset, not EST.
    const now = new Date('2020-11-01T03:00:00Z')
    expect(quota.nyDateString(now)).toBe('2020-10-31')

    const midnight = quota.nyNextMidnightUtc(now)
    expect(midnight.toISOString()).toBe('2020-11-01T04:00:00.000Z') // 00:00 EDT
    expect(quota.secondsUntilMidnightNY(now)).toBe(3600)
  })
})
