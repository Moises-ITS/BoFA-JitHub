// ─────────────────────────────────────────────────────────────────────────────
// services/jitiService.test.ts
// The orchestrator: request validation, the reserve/refund/reconcile dance
// around a mocked Anthropic client, and the shape of the request actually
// sent to Anthropic (cache boundary, max_tokens). Redis is an in-memory fake
// (same shape as jitiQuotaService.test.ts); the corpus is mocked out entirely
// since its own correctness is covered in jitiCorpusService.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fake Redis (mirrors jitiQuotaService.test.ts) ──────────────────────────

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

const createMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/anthropic.js', () => ({
  anthropicClient: { messages: { create: createMock } },
  isAnthropicConfigured: () => true,
}))

vi.mock('./jitiCorpusService.js', () => ({
  initCorpus: vi.fn().mockResolvedValue(undefined),
  getCachedSystemBlock: vi.fn().mockReturnValue('STATIC CLUB INDEX — this never changes.'),
}))

const jiti = await import('./jitiService.js')
const quota = await import('./jitiQuotaService.js')

const NOW = new Date('2026-06-15T16:00:00Z')

function successResponse(usage: Partial<Record<string, number>> = {}) {
  return {
    id: 'msg_test',
    content: [{ type: 'text', text: 'Here is what I found about that club.' }],
    usage: {
      input_tokens: usage.input_tokens ?? 20,
      output_tokens: usage.output_tokens ?? 30,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 11000,
    },
  }
}

beforeEach(() => {
  fakeRedis._reset()
  createMock.mockReset()
  createMock.mockResolvedValue(successResponse())
})

// ── validateChatInput ────────────────────────────────────────────────────────

describe('validateChatInput', () => {
  it('rejects an empty question before any Redis call', () => {
    expect(() => jiti.validateChatInput({ question: '', deviceId: 'abc' })).toThrow(jiti.ValidationError)
  })

  it('rejects a question over 500 characters', () => {
    expect(() => jiti.validateChatInput({ question: 'a'.repeat(501), deviceId: 'abc' })).toThrow(jiti.ValidationError)
  })

  it('rejects a malformed deviceId', () => {
    expect(() => jiti.validateChatInput({ question: 'hi', deviceId: 'has a space' })).toThrow(jiti.ValidationError)
  })

  it('truncates history longer than 6 entries to the last 6', () => {
    const history = Array.from({ length: 9 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }))
    const result = jiti.validateChatInput({ question: 'What clubs exist?', deviceId: 'device-1', history })
    expect(result.history).toHaveLength(6)
    expect(result.history[0].content).toBe('message 3') // the last 6 of 0..8
    expect(result.history[5].content).toBe('message 8')
  })

  it('drops malformed history entries instead of throwing', () => {
    const result = jiti.validateChatInput({
      question: 'hi',
      deviceId: 'device-1',
      history: [{ role: 'user', content: 'ok' }, { role: 'bogus', content: 'x' }, null, 'nope'],
    })
    expect(result.history).toEqual([{ role: 'user', content: 'ok' }])
  })
})

// ── chat() — request shape sent to Anthropic ────────────────────────────────

describe('chat — request shape', () => {
  it('sends max_tokens matching JITI_MAX_OUTPUT_TOKENS (default 300)', async () => {
    await jiti.chat('user-shape', { question: 'What is Hack Club?', deviceId: 'device-1', history: [] }, NOW)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock.mock.calls[0][0].max_tokens).toBe(300)
  })

  it('system is exactly one cached text block containing only static instructions + index', async () => {
    const question = 'UNIQUE_QUESTION_MARKER_12345'
    const deviceId = 'UNIQUE_DEVICE_MARKER'
    const userId = 'UNIQUE_USER_MARKER'
    await jiti.chat(userId, { question, deviceId, history: [] }, NOW)

    const args = createMock.mock.calls[0][0]
    expect(Array.isArray(args.system)).toBe(true)
    expect(args.system).toHaveLength(1)

    const block = args.system[0]
    expect(block.type).toBe('text')
    expect(block.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    expect(block.text).toContain('STATIC CLUB INDEX')
    expect(block.text).not.toContain(question)
    expect(block.text).not.toContain(deviceId)
    expect(block.text).not.toContain(userId)
  })

  it('puts the question and history in messages, after the cache breakpoint', async () => {
    await jiti.chat(
      'user-msgs',
      {
        question: 'And what about robotics clubs?',
        deviceId: 'device-1',
        history: [{ role: 'user', content: 'Tell me about Hack Club' }, { role: 'assistant', content: 'Hack Club is...' }],
      },
      NOW
    )
    const args = createMock.mock.calls[0][0]
    expect(args.messages).toEqual([
      { role: 'user', content: 'Tell me about Hack Club' },
      { role: 'assistant', content: 'Hack Club is...' },
      { role: 'user', content: 'And what about robotics clubs?' },
    ])
  })

  it('never sends the thinking or output_config.effort params', async () => {
    await jiti.chat('user-flags', { question: 'hi', deviceId: 'device-1', history: [] }, NOW)
    const args = createMock.mock.calls[0][0]
    expect(args.thinking).toBeUndefined()
    expect(args.output_config).toBeUndefined()
  })
})

// ── chat() — quota enforcement ──────────────────────────────────────────────

describe('chat — per-user quota', () => {
  it('allows up to the daily limit, then throws QuotaExceededError without calling Anthropic', async () => {
    const limit = quota.getDailyUserLimit()
    for (let i = 0; i < limit; i++) {
      await jiti.chat('user-quota', { question: `question ${i}`, deviceId: 'device-1', history: [] }, NOW)
    }
    expect(createMock).toHaveBeenCalledTimes(limit)

    await expect(
      jiti.chat('user-quota', { question: 'one too many', deviceId: 'device-1', history: [] }, NOW)
    ).rejects.toBeInstanceOf(jiti.QuotaExceededError)

    // The 6th call must not have reached Anthropic at all.
    expect(createMock).toHaveBeenCalledTimes(limit)
  })

  it('two different deviceIds under one userId share a single quota counter', async () => {
    await jiti.chat('user-multidevice', { question: 'q1', deviceId: 'device-A', history: [] }, NOW)
    await jiti.chat('user-multidevice', { question: 'q2', deviceId: 'device-B', history: [] }, NOW)
    const status = await quota.getUserQuotaStatus('user-multidevice', NOW)
    expect(status.used).toBe(2)
  })

  it('refunds the user quota when Anthropic throws', async () => {
    createMock.mockRejectedValueOnce(new Error('upstream exploded'))

    await expect(
      jiti.chat('user-refund', { question: 'hi', deviceId: 'device-1', history: [] }, NOW)
    ).rejects.toBeInstanceOf(jiti.UpstreamFailureError)

    const status = await quota.getUserQuotaStatus('user-refund', NOW)
    expect(status.used).toBe(0) // back to its pre-call value
  })

  it('refunds the global spend ledger when Anthropic throws', async () => {
    createMock.mockRejectedValueOnce(new Error('upstream exploded'))
    const key = `jiti:spend:global:${quota.nyDateString(NOW)}`

    await expect(
      jiti.chat('user-refund-ledger', { question: 'hi', deviceId: 'device-1', history: [] }, NOW)
    ).rejects.toBeInstanceOf(jiti.UpstreamFailureError)

    expect(fakeRedis._store.get(key) ?? 0).toBe(0)
  })
})

describe('chat — global capacity', () => {
  it('returns AtCapacityError when the ledger would exceed the ceiling, rolling back both the ledger and the user quota, without calling Anthropic', async () => {
    const ledgerKey = `jiti:spend:global:${quota.nyDateString(NOW)}`
    fakeRedis._store.set(ledgerKey, 64) // one 3-cent reservation from the default 65-cent ceiling

    await expect(
      jiti.chat('user-capacity', { question: 'hi', deviceId: 'device-1', history: [] }, NOW)
    ).rejects.toBeInstanceOf(jiti.AtCapacityError)

    expect(createMock).not.toHaveBeenCalled()
    expect(fakeRedis._store.get(ledgerKey)).toBe(64) // rolled back
    expect((await quota.getUserQuotaStatus('user-capacity', NOW)).used).toBe(0) // rolled back
  })
})

describe('chat — reconcile', () => {
  it('applies the real usage-derived cost to the ledger, not the flat reservation', async () => {
    // input 20 + cache_write 0 + cache_read 11000 + output 30 tokens:
    // (20*100 + 11000*10 + 30*500) / 1e6 = (2000 + 110000 + 15000) / 1e6 = 0.127 -> rounds to 0 cents.
    createMock.mockResolvedValueOnce(successResponse())
    const ledgerKey = `jiti:spend:global:${quota.nyDateString(NOW)}`

    await jiti.chat('user-reconcile', { question: 'hi', deviceId: 'device-1', history: [] }, NOW)

    // Reserved 3 cents up front, reconciled down to the ~0.13-cent actual cost.
    expect(fakeRedis._store.get(ledgerKey)).toBe(0)
  })

  it('still returns the answer when reconciliation itself fails', async () => {
    // Anthropic has already run and billed us by this point. If a transient
    // Redis error during reconcile were allowed to propagate, the request would
    // 500 — the student loses their quota slot AND the answer we already paid
    // for, which is strictly worse than a ledger that is off by the
    // reserve/actual delta until the key expires at midnight.
    createMock.mockResolvedValueOnce(successResponse())
    // incrBy is called twice per turn: once to RESERVE the flat estimate, then
    // again to reconcile against real usage. Only the second one may fail here —
    // a reserve failure is a different path that legitimately aborts the turn.
    const realIncrBy = fakeRedis.incrBy.bind(fakeRedis)
    let incrByCalls = 0
    const incrBySpy = vi.spyOn(fakeRedis, 'incrBy').mockImplementation(async (key, n) => {
      incrByCalls += 1
      if (incrByCalls === 2) throw new Error('READONLY replica')
      return realIncrBy(key, n)
    })

    const result = await jiti.chat(
      'user-reconcile-fail',
      { question: 'hi', deviceId: 'device-1', history: [] },
      NOW,
    )

    expect(result.answer).toBeTruthy()
    expect(incrByCalls).toBe(2) // proves the reconcile was actually attempted
    incrBySpy.mockRestore()
  })
})
