// ─────────────────────────────────────────────────────────────────────────────
// lib/api.test.ts — the shared fetch helpers every page depends on.
// If these break, every network call in the app breaks with them, which is
// exactly why they get direct tests instead of relying on page-level coverage.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiFetch, eventsFetch, authHeaders, withTimeout, TimeoutError, API_BASE_URL, EVENTS_API_BASE_URL } from './api'

type FetchMock = ReturnType<typeof vi.fn>

function stubFetch(response: { ok: boolean; status: number; body?: unknown; json?: () => Promise<unknown> }): FetchMock {
  const mock = vi.fn(() =>
    Promise.resolve({
      ok: response.ok,
      status: response.status,
      json: response.json ?? (() => Promise.resolve(response.body ?? {})),
    })
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('apiFetch', () => {
  it('returns ok/status/data for a successful response', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'u1' } })

    const result = await apiFetch<{ id: string }>('/api/auth/me', 'tok')

    expect(result).toEqual({ ok: true, status: 200, data: { id: 'u1' } })
  })

  it('prefixes API_BASE_URL and attaches Bearer + Content-Type headers', async () => {
    const mock = stubFetch({ ok: true, status: 200 })

    await apiFetch('/api/things', 'tok', { method: 'POST', body: '{}' })

    expect(mock).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/things`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('does not throw on non-2xx — callers decide what a status means', async () => {
    stubFetch({ ok: false, status: 403, body: { error: 'nope', code: 'PROFILE_REQUIRED' } })

    const result = await apiFetch<{ error?: string; code?: string }>('/api/auth/me', 'tok')

    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
    expect(result.data.code).toBe('PROFILE_REQUIRED')
  })

  it('degrades a non-JSON body to an empty object instead of throwing', async () => {
    stubFetch({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError('not json')) })

    const result = await apiFetch('/api/auth/me', 'tok')

    expect(result).toEqual({ ok: false, status: 502, data: {} })
  })

  it('aborts a hung request after the timeout', async () => {
    vi.useFakeTimers()
    // A fetch that never resolves on its own — only the abort signal ends it,
    // which is exactly the "backend accepted the connection then went silent"
    // failure mode the timeout exists for.
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        )
      })
    ))

    const pending = apiFetch('/api/auth/me', 'tok')
    const assertion = expect(pending).rejects.toThrow(/aborted/i)
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
  })
})

describe('eventsFetch', () => {
  it('hits the backend /api prefix and sends NO Authorization header when unauthenticated', async () => {
    const mock = stubFetch({ ok: true, status: 200, body: [] })

    await eventsFetch('/events/upcoming?limit=3')

    const [url, init] = mock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${EVENTS_API_BASE_URL}/events/upcoming?limit=3`)
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('attaches the Bearer token for authenticated writes', async () => {
    const mock = stubFetch({ ok: true, status: 201, body: {} })

    await eventsFetch('/events/community', 'tok', { method: 'POST' })

    const [, init] = mock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('derives the events base from the single backend origin', () => {
    // Guards the regression this rename fixed: the events half of the app used
    // to read its own env var, which was set nowhere and silently pointed at
    // localhost:8000 in every build.
    expect(EVENTS_API_BASE_URL).toBe(`${API_BASE_URL}/api`)
  })
})

describe('authHeaders', () => {
  it('builds a Bearer header object for raw-Response callers', () => {
    expect(authHeaders('tok')).toEqual({ Authorization: 'Bearer tok' })
  })
})

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('passes the resolved value straight through when the promise wins', async () => {
    await expect(withTimeout(Promise.resolve('done'), 1_000, 'fast')).resolves.toBe('done')
  })

  it('propagates the original rejection rather than masking it as a timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('upstream blew up')), 1_000, 'fast'))
      .rejects.toThrow('upstream blew up')
  })

  it('rejects with a TimeoutError when the promise never settles', async () => {
    // This is the regression guard for the production change-password bug: an
    // SDK call that hangs forever used to leave the caller pending forever too,
    // which surfaced as a button spinning with no error and nothing logged.
    vi.useFakeTimers()
    const pending = withTimeout(new Promise(() => {}), 5_000, 'clerk.updatePassword')
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError)
    await vi.advanceTimersByTimeAsync(5_001)
    await assertion
  })

  it('names the labelled operation in the timeout message', async () => {
    vi.useFakeTimers()
    const pending = withTimeout(new Promise(() => {}), 2_000, 'clerk.updatePassword')
    const assertion = expect(pending).rejects.toThrow(/clerk\.updatePassword did not settle within 2000ms/)
    await vi.advanceTimersByTimeAsync(2_001)
    await assertion
  })

  it('clears its timer when the promise resolves first, so no stray timer is left armed', async () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    await withTimeout(Promise.resolve('quick'), 10_000, 'fast')
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})
