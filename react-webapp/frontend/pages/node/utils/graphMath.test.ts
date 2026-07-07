// ─────────────────────────────────────────────────────────────────────────────
// graphMath.test.ts — the graph's visual grammar, pinned. These functions run
// per link per tick; a regression here silently distorts the whole graph
// rather than throwing, so tests are the only tripwire.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  clamp01,
  edgeStrength,
  edgeWidthFromStrength,
  edgeOpacityFromStrength,
  edgePairKey,
  edgeDashForLink,
  edgeStrokeColorForLink,
  curvePathBetweenNodes,
} from './graphMath'
import { EDGE_WIDTH_MIN, EDGE_WIDTH_MAX } from '../constants/graphMotion'
import type { GraphLink } from '../types/graphNodes'

const link = (overrides: Partial<GraphLink>): GraphLink => ({
  source: 'a',
  target: 'b',
  rel: 'MEMBER_OF',
  weight: 0.5,
  opacity: 0.65,
  style: 'solid',
  ...overrides,
})

describe('clamp01', () => {
  it('clamps into [0, 1]', () => {
    expect(clamp01(-5)).toBe(0)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(7)).toBe(1)
  })
})

describe('edge styling grammar', () => {
  it('edgeStrength stays in [0,1] and rises with weight', () => {
    const weak = edgeStrength(link({ weight: 0.1 }))
    const strong = edgeStrength(link({ weight: 0.95 }))
    expect(weak).toBeGreaterThanOrEqual(0)
    expect(strong).toBeLessThanOrEqual(1)
    expect(strong).toBeGreaterThan(weak)
  })

  it('width and opacity stay within their design bounds across the whole domain', () => {
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const w = edgeWidthFromStrength(s)
      expect(w).toBeGreaterThanOrEqual(EDGE_WIDTH_MIN)
      expect(w).toBeLessThanOrEqual(EDGE_WIDTH_MAX)
      const o = edgeOpacityFromStrength(s)
      expect(o).toBeGreaterThan(0)
      expect(o).toBeLessThanOrEqual(0.3)
    }
  })

  it('company links are always solid; interest links are dashed', () => {
    expect(edgeDashForLink(link({ rel: 'WORKS_AT', style: 'dashed' }))).toBeNull()
    expect(edgeDashForLink(link({ rel: 'INTERESTED_IN' }))).toBe('5,4')
  })

  it('student↔student connections render purple', () => {
    expect(edgeStrokeColorForLink(link({ rel: 'CONNECTED_TO' }))).toBe('#8b5cf6')
  })

  it('edgePairKey is order-independent (one key per undirected pair)', () => {
    expect(edgePairKey('alice', 'bob')).toBe(edgePairKey('bob', 'alice'))
  })
})

describe('curvePathBetweenNodes', () => {
  it('produces a quadratic SVG path and survives null endpoints', () => {
    expect(curvePathBetweenNodes({ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 10 })).toMatch(/^M.+ Q.+/)
    expect(curvePathBetweenNodes(null, undefined)).toMatch(/^M/)
  })
})
