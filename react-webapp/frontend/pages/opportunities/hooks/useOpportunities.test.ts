import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { NJIT_MAJORS, majorSlug } from '@/constants/majors'
import { useOpportunities, formatMajorLabel } from './useOpportunities'

function opportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    type: 'internship',
    title: 'Backend Intern',
    org: 'Acme',
    city: 'Newark',
    state: 'NJ',
    lat: 40.7,
    lng: -74.2,
    tags: [] as string[],
    description: 'Build things.',
    ...overrides,
  }
}

function mockFeed(rows: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => rows })))
}

beforeEach(() => { mockFeed([]) })
afterEach(() => { vi.unstubAllGlobals() })

describe('formatMajorLabel', () => {
  it('resolves an onboarding major slug to its display name', () => {
    expect(formatMajorLabel('computer-science')).toBe('Computer Science')
  })

  it('still resolves department slugs and falls back to title case', () => {
    expect(formatMajorLabel('architecture-design')).toBe('Architecture & Design')
    expect(formatMajorLabel('some-new-slug')).toBe('Some New Slug')
    expect(formatMajorLabel('all')).toBe('All majors')
  })
})

describe('majorOptions', () => {
  it('offers every onboarding major even when the feed is empty', async () => {
    const { result } = renderHook(() => useOpportunities())
    await waitFor(() => expect(result.current.majorOptions.length).toBeGreaterThan(1))

    const options = result.current.majorOptions
    expect(options[0]).toBe('all')
    for (const major of NJIT_MAJORS) {
      expect(options).toContain(majorSlug(major))
    }
  })

  it('unions in a department slug that only exists in API rows', async () => {
    mockFeed([opportunity({ districtId: 'architecture-design' })])
    const { result } = renderHook(() => useOpportunities())
    await waitFor(() => expect(result.current.majorOptions).toContain('architecture-design'))
  })
})

describe('filtering by major', () => {
  it('matches a listing tagged in prose against the slug the dropdown sets', async () => {
    mockFeed([
      opportunity({ id: 'cs', tags: ['Computer Science', 'Summer 2026'] }),
      opportunity({ id: 'me', tags: ['Mechanical Engineering'] }),
    ])
    const { result } = renderHook(() => useOpportunities())
    await waitFor(() => expect(result.current.sortedFiltered).toHaveLength(2))

    act(() => result.current.setDistrictFilter('computer-science'))
    await waitFor(() => expect(result.current.sortedFiltered.map((o) => o.id)).toEqual(['cs']))
  })

  it('normalizes a prose ?district= param to the slug the select renders', async () => {
    mockFeed([opportunity({ id: 'cs', tags: ['computer science'] })])
    const { result } = renderHook(() => useOpportunities('Computer Science'))
    await waitFor(() => expect(result.current.sortedFiltered).toHaveLength(1))

    expect(result.current.districtFilter).toBe('computer-science')
    expect(result.current.majorOptions).toContain('computer-science')
  })
})
