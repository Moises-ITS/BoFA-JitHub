import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGraphData } from './useGraphData'
import { useAuth } from '../../../context/AuthContext'
import type { GraphNode, GraphLink } from '../types/graphNodes'

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const apiNodes: GraphNode[] = [
  { id: 'neo-1', label: 'Alice', type: 'student', details: { major: 'CS', gpa: '3.9' } },
  { id: 'neo-2', label: 'Hack Club', type: 'club', details: {} },
]

const apiLinks: GraphLink[] = [
  { source: 'neo-1', target: 'neo-2', rel: 'MEMBER_OF', weight: 0.8, opacity: 0.75, style: 'solid' },
]

function mockFetchSuccess() {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.endsWith('/api/graph/nodes')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(apiNodes) })
    }
    if (url.endsWith('/api/graph/links')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(apiLinks) })
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`))
  }))
}

function mockFetchFailure() {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Failed to fetch'))))
}

function mockFetchNonOk() {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
  ))
}

describe('useGraphData', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' },
      token: 'test-token',
      loading: false,
    } as ReturnType<typeof useAuth>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not fetch while auth is still loading', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      token: null,
      loading: true,
    } as ReturnType<typeof useAuth>)

    const { result } = renderHook(() => useGraphData())

    expect(result.current.loading).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not render mock data when the user is unauthenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      token: null,
      loading: false,
    } as ReturnType<typeof useAuth>)

    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.nodes).toEqual([])
    expect(result.current.links).toEqual([])
    expect(result.current.error).toContain('Sign in')
  })

  it('returns nodes and links from the backend when API succeeds', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001')
    mockFetchSuccess()

    const { result } = renderHook(() => useGraphData())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.nodes).toEqual(apiNodes)
    expect(result.current.links).toEqual(apiLinks)
    expect(result.current.error).toBeNull()
  })

  it('calls the correct API endpoints with auth headers', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001')
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('nodes')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useGraphData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/graph/nodes',
      { headers: { Authorization: 'Bearer test-token' } },
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/graph/links',
      { headers: { Authorization: 'Bearer test-token' } },
    )
  })

  it('returns an empty graph and sets error when fetch throws', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001')
    mockFetchFailure()

    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.nodes).toEqual([])
    expect(result.current.links).toEqual([])
    expect(result.current.error).toContain('Failed to fetch')
  })

  it('returns an empty graph and sets error when nodes endpoint returns non-ok status', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001')
    mockFetchNonOk()

    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.nodes).toEqual([])
    expect(result.current.links).toEqual([])
    expect(result.current.error).toContain('500')
  })

  it('starts in loading state and finishes loading after fetch completes', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001')
    mockFetchSuccess()

    const { result } = renderHook(() => useGraphData())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('finishes loading even when backend is unreachable', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001')
    mockFetchFailure()

    const { result } = renderHook(() => useGraphData())

    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})
