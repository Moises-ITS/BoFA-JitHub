// ─────────────────────────────────────────────────────────────────────────────
// routes/graph.test.ts
// Integration tests for /api/graph/* endpoints (Neo4j is mocked).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// Mock graphService before importing the router so the module is intercepted
vi.mock('../services/graphService.js', () => ({
  getNodes:        vi.fn(),
  getLinks:        vi.fn(),
  getShortestPath: vi.fn(),
}))

import * as graphService from '../services/graphService.js'
import graphRouter from './graph.js'

// ── App fixture ───────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())
app.use('/api/graph', graphRouter)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const sampleNodes = [
  { id: 'student-alice', label: 'Alice', type: 'student', details: { major: 'CS' } },
  { id: 'club-hackclub',  label: 'Hack Club', type: 'club', details: {} },
]

type GraphLinksResponse = Awaited<ReturnType<typeof graphService.getLinks>>

const sampleLinks: GraphLinksResponse = [
  { source: 'student-alice', target: 'club-hackclub', rel: 'MEMBER_OF', weight: 0.65, opacity: 0.75, style: 'solid' },
]

// ── GET /api/graph/nodes ──────────────────────────────────────────────────────

describe('GET /api/graph/nodes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with an array of nodes', async () => {
    vi.mocked(graphService.getNodes).mockResolvedValue(sampleNodes)

    const res = await request(app).get('/api/graph/nodes')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toEqual(sampleNodes)
  })

  it('each node has id, label, type, and details fields', async () => {
    vi.mocked(graphService.getNodes).mockResolvedValue(sampleNodes)

    const res = await request(app).get('/api/graph/nodes')

    for (const node of res.body) {
      expect(node).toHaveProperty('id')
      expect(node).toHaveProperty('label')
      expect(node).toHaveProperty('type')
      expect(node).toHaveProperty('details')
    }
  })

  it('returns 500 when Neo4j throws', async () => {
    vi.mocked(graphService.getNodes).mockRejectedValue(new Error('Neo4j unavailable'))

    const res = await request(app).get('/api/graph/nodes')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })

  it('returns empty array when no nodes exist', async () => {
    vi.mocked(graphService.getNodes).mockResolvedValue([])

    const res = await request(app).get('/api/graph/nodes')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

// ── GET /api/graph/links ──────────────────────────────────────────────────────

describe('GET /api/graph/links', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with an array of links', async () => {
    vi.mocked(graphService.getLinks).mockResolvedValue(sampleLinks)

    const res = await request(app).get('/api/graph/links')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toEqual(sampleLinks)
  })

  it('each link has source, target, rel, weight, opacity, and style fields', async () => {
    vi.mocked(graphService.getLinks).mockResolvedValue(sampleLinks)

    const res = await request(app).get('/api/graph/links')

    for (const link of res.body) {
      expect(link).toHaveProperty('source')
      expect(link).toHaveProperty('target')
      expect(link).toHaveProperty('rel')
      expect(link).toHaveProperty('weight')
      expect(link).toHaveProperty('opacity')
      expect(link).toHaveProperty('style')
    }
  })

  it('returns 500 when Neo4j throws', async () => {
    vi.mocked(graphService.getLinks).mockRejectedValue(new Error('Neo4j unavailable'))

    const res = await request(app).get('/api/graph/links')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})

// ── GET /api/graph/path ───────────────────────────────────────────────────────

describe('GET /api/graph/path', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when from param is missing', async () => {
    const res = await request(app).get('/api/graph/path?to=club-hackclub')

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when to param is missing', async () => {
    const res = await request(app).get('/api/graph/path?from=student-alice')

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when both params are missing', async () => {
    const res = await request(app).get('/api/graph/path')

    expect(res.status).toBe(400)
  })

  it('returns path with nodeIds and rels when both params are provided', async () => {
    const pathResult = { nodeIds: ['student-alice', 'club-hackclub'], rels: ['MEMBER_OF'] }
    vi.mocked(graphService.getShortestPath).mockResolvedValue(pathResult)

    const res = await request(app).get('/api/graph/path?from=student-alice&to=club-hackclub')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('nodeIds')
    expect(res.body).toHaveProperty('rels')
    expect(res.body.nodeIds).toEqual(['student-alice', 'club-hackclub'])
    expect(res.body.rels).toEqual(['MEMBER_OF'])
  })

  it('returns empty arrays when no path exists between nodes', async () => {
    vi.mocked(graphService.getShortestPath).mockResolvedValue({ nodeIds: [], rels: [] })

    const res = await request(app).get('/api/graph/path?from=a&to=b')

    expect(res.status).toBe(200)
    expect(res.body.nodeIds).toEqual([])
    expect(res.body.rels).toEqual([])
  })

  it('returns 500 when Neo4j throws', async () => {
    vi.mocked(graphService.getShortestPath).mockRejectedValue(new Error('Neo4j unavailable'))

    const res = await request(app).get('/api/graph/path?from=a&to=b')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})
