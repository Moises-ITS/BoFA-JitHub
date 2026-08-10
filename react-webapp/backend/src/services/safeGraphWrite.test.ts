// ─────────────────────────────────────────────────────────────────────────────
// services/safeGraphWrite.test.ts
// safeGraphWrite() is the seam that keeps Neo4j from being able to fail account
// creation. If it ever starts rethrowing, signup silently becomes coupled to
// the graph again — the exact failure this was written to remove — and nothing
// else in the suite would notice. Hence direct coverage.
//
// The module is imported dynamically AFTER stubbing config/neo4j, because
// graphService imports the driver at module load and building a real driver
// needs credentials this test has no business requiring.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../config/neo4j.js', () => ({
  driver: { session: () => ({ run: vi.fn(), close: vi.fn() }) },
}))

const { safeGraphWrite } = await import('./graphService.js')

describe('safeGraphWrite', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the write result when the graph write succeeds', async () => {
    const result = await safeGraphWrite(
      { op: 'createStudentNode', userId: 'user-1' },
      async () => 'user-1'
    )
    expect(result).toBe('user-1')
  })

  it('returns null instead of throwing when the graph is unreachable', async () => {
    const result = await safeGraphWrite(
      { op: 'createStudentNode', userId: 'user-2' },
      async () => {
        throw new Error('Could not perform discovery. No routing servers available.')
      }
    )
    // null is what leaves users.graph_node_id NULL, which is what puts the row
    // on the reconcile queue. A throw here would 500 the signup instead.
    expect(result).toBeNull()
  })

  it('logs the failure with enough context to find the affected user', async () => {
    const errorSpy = vi.spyOn(console, 'error')
    await safeGraphWrite(
      { op: 'createProfessorNode', userId: 'user-3' },
      async () => {
        throw new Error('boom')
      }
    )
    expect(errorSpy).toHaveBeenCalledWith(
      '[graph][deferred]',
      expect.objectContaining({ op: 'createProfessorNode', userId: 'user-3', message: 'boom' })
    )
  })

  it('does not swallow non-Error throws', async () => {
    const errorSpy = vi.spyOn(console, 'error')
    const result = await safeGraphWrite({ op: 'createStudentNode', userId: 'user-4' }, async () => {
      throw 'string failure'
    })
    expect(result).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith(
      '[graph][deferred]',
      expect.objectContaining({ message: 'string failure' })
    )
  })
})
