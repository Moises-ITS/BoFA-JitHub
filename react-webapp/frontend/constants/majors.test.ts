import { describe, it, expect } from 'vitest'
import { NJIT_MAJORS, NJIT_MAJOR_SLUGS, MAJOR_SLUG_TO_LABEL, majorSlug } from './majors'

describe('majorSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(majorSlug('Computer Science')).toBe('computer-science')
    expect(majorSlug('Materials Science and Engineering')).toBe('materials-science-and-engineering')
  })

  it('normalizes prose and slug spellings of the same major to one value', () => {
    expect(majorSlug('  Computer  Science ')).toBe(majorSlug('computer-science'))
    expect(majorSlug('Pre-Medical Studies')).toBe('pre-medical-studies')
  })
})

describe('NJIT_MAJORS', () => {
  it('has no duplicates', () => {
    expect(new Set(NJIT_MAJORS).size).toBe(NJIT_MAJORS.length)
  })

  it('produces a unique slug per major, so no dropdown entry shadows another', () => {
    expect(new Set(NJIT_MAJOR_SLUGS).size).toBe(NJIT_MAJORS.length)
  })

  it('maps every slug back to its display name', () => {
    for (const major of NJIT_MAJORS) {
      expect(MAJOR_SLUG_TO_LABEL[majorSlug(major)]).toBe(major)
    }
  })
})
