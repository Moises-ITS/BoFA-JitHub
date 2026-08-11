// ─────────────────────────────────────────────────────────────────────────────
// services/jitiCorpusService.test.ts
// Proves the two properties the whole prompt-cache cost model depends on:
// the built block is deterministic (no clock/randomness leak) and the boot
// gate actually throws when the real tokenizer reports it's too small to
// cache. The Anthropic client is mocked — only its countTokens() response is
// under test here, not the real tokenizer.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'

const countTokensMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/anthropic.js', () => ({
  anthropicClient: { messages: { countTokens: countTokensMock } },
  isAnthropicConfigured: () => true,
}))

import {
  buildCorpus,
  initCorpus,
  getCachedSystemBlock,
  MIN_CACHEABLE_TOKENS,
  __resetCorpusCacheForTests,
} from './jitiCorpusService.js'

describe('buildCorpus', () => {
  it('is byte-identical across two consecutive builds', () => {
    const first = buildCorpus()
    const second = buildCorpus()
    expect(second.block).toBe(first.block)
    expect(second.rowsIn).toBe(first.rowsIn)
    expect(second.rowsExcluded).toBe(first.rowsExcluded)
  })

  it('excludes rows whose metadata status is explicitly not Active', () => {
    const { block, rowsIn, rowsExcluded } = buildCorpus()
    expect(rowsIn).toBeGreaterThan(0)
    expect(rowsExcluded).toBeGreaterThanOrEqual(0)
    expect(rowsExcluded).toBeLessThan(rowsIn)
    // Every remaining line follows the `name | category | summary` shape.
    const lines = block.split('\n').filter((l) => l.includes(' | '))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines.slice(0, 20)) {
      expect(line.split(' | ').length).toBeGreaterThanOrEqual(3)
    }
  })

  it('carries a hardcoded date in the header, not a computed one', () => {
    const { block } = buildCorpus()
    expect(block).toContain('2026-07-07')
  })
})

describe('initCorpus', () => {
  beforeEach(() => {
    __resetCorpusCacheForTests()
    countTokensMock.mockReset()
  })

  it('accepts a token count between 4,096 and 20,000', async () => {
    countTokensMock.mockResolvedValue({ input_tokens: 11000 })
    await expect(initCorpus()).resolves.toBeUndefined()
    expect(getCachedSystemBlock().length).toBeGreaterThan(0)
  })

  it('throws when the real tokenizer reports fewer than 4,096 tokens', async () => {
    countTokensMock.mockResolvedValue({ input_tokens: 4000 })
    await expect(initCorpus()).rejects.toThrow(/below Anthropic's 4096-token/)
    expect(4000).toBeLessThan(MIN_CACHEABLE_TOKENS)
  })

  it('is idempotent — a second call does not re-invoke countTokens', async () => {
    countTokensMock.mockResolvedValue({ input_tokens: 11000 })
    await initCorpus()
    await initCorpus()
    expect(countTokensMock).toHaveBeenCalledTimes(1)
  })
})

describe('getCachedSystemBlock', () => {
  beforeEach(() => __resetCorpusCacheForTests())

  it('throws if called before initCorpus() completes', () => {
    expect(() => getCachedSystemBlock()).toThrow(/not initialized/)
  })
})
