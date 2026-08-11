// ─────────────────────────────────────────────────────────────────────────────
// hooks/useGraphData.test.ts
//
// Tests the hook's CURRENT contract:
//  - it fetches only once an auth token exists (useAuth is mocked below —
//    pulling in the real AuthProvider would drag Clerk into a unit test)
//  - requests carry the Bearer token and hit the canonical API_BASE_URL
//  - on any failure it falls back to mock data and surfaces the error
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGraphData } from './useGraphData'
import { mockNodes, mockLinks } from '../data/mockGraphData'
import { API_BASE_URL } from '@/lib/api'
import type { GraphNode, GraphLink } from '../types/graphNodes'

// ── Auth mock ─────────────────────────────────────────────────────────────────
// The hook only reads { token, user } from useAuth. A mutable holder lets each
// test flip auth state without re-mocking the module.

const authState: { token: string | null; user: { id: string } | null } = {
  token: 'test-token',
  user: { id: 'user-1' },
}

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

const apiNodes: GraphNode[] = [
  { id: 'neo-1', label: 'Alice', type: 'student', details: { major: 'CS', gpa: '3.9' } },
  { id: 'neo-2', label: 'Hack Club', type: 'club', details: {} },
]

const apiLinks: GraphLink[] = [
  { source: 'neo-1', target: 'neo-2', rel: 'MEMBER_OF', weight: 0.8, opacity: 0.75, style: 'solid' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchSuccess() {
  const fetchMock = vi.fn((url: string) => {
    if (url.endsWith('/api/graph/nodes')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(apiNodes) })
    }
    if (url.endsWith('/api/graph/links')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(apiLinks) })
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function mockFetchFailure() {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Failed to fetch'))))
}

function mockFetchNonOk() {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
  ))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGraphData', () => {
  beforeEach(() => {
    authState.token = 'test-token'
    authState.user = { id: 'user-1' }
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── No auth token yet ───────────────────────────────────────────────────────

  it('does not fetch until an auth token is available', async () => {
    authState.token = null
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useGraphData())

    // The hook idles (stays in loading) rather than swapping in mock data —
    // this prevents a flash of fake nodes while Clerk is still resolving.
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled())
    expect(result.current.loading).toBe(true)
    expect(result.current.nodes).toEqual([])
    expect(result.current.links).toEqual([])
  })

  // ── Successful API fetch ────────────────────────────────────────────────────

  it('returns nodes and links from the backend when API succeeds', async () => {
    mockFetchSuccess()

    const { result } = renderHook(() => useGraphData())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.nodes).toEqual(apiNodes)
    expect(result.current.links).toEqual(apiLinks)
    expect(result.current.error).toBeNull()
  })

  it('calls the canonical endpoints with the Bearer token', async () => {
    const fetchMock = mockFetchSuccess()

    const { result } = renderHook(() => useGraphData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // The hook goes through the shared apiFetch, which adds Content-Type and
    // an abort signal on top of the Bearer header — assert on what matters
    // (URL + auth) rather than pinning the whole init object, so helper
    // internals can evolve without breaking this test.
    const expectedInit = expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    })
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/graph/nodes`, expectedInit)
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/graph/links`, expectedInit)
  })

  // ── Network failure fallback ────────────────────────────────────────────────

  it('falls back to mock data and sets error when fetch throws', async () => {
    mockFetchFailure()

    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.nodes).toEqual(mockNodes)
    expect(result.current.links).toEqual(mockLinks)
    expect(result.current.error).toContain('Failed to fetch')
  })

  it('falls back to mock data and sets error when nodes endpoint returns non-ok status', async () => {
    mockFetchNonOk()

    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.nodes).toEqual(mockNodes)
    expect(result.current.links).toEqual(mockLinks)
    expect(result.current.error).toContain('500')
  })

  // ── Loading state ───────────────────────────────────────────────────────────

  it('starts in loading state and finishes loading after fetch completes', async () => {
    mockFetchSuccess()

    const { result } = renderHook(() => useGraphData())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('finishes loading even when backend is unreachable', async () => {
    mockFetchFailure()

    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})
