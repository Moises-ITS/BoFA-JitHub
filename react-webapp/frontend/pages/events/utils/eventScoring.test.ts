// ─────────────────────────────────────────────────────────────────────────────
// eventScoring.test.ts — the personalization engine, finally testable now that
// it lives outside the modal component. These tests pin the BEHAVIOR of the
// hand-tuned weights (what kind of signal moves the score, and the bounds),
// not the exact numbers — retuning a weight shouldn't break the suite, but
// breaking club matching or the cap should.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { matchScore, explainMatch, type UserProfile } from './eventScoring'
import type { EdenEvent } from '../types/events'

const emptyProfile: UserProfile = { major: '', interests: [], clubs: [] }

const csProfile: UserProfile = {
  major: 'Computer Science',
  interests: ['Machine Learning', 'Programming'],
  clubs: ['ACM'],
  looking_for: ['Internship'],
  year: 'Junior',
}

const hackathon: EdenEvent = {
  event_id: 1,
  event_name: 'Spring Hackathon',
  club_name: 'IEEE',
  event_category: 'hackathon',
}

describe('matchScore', () => {
  it('returns -1 when the profile has nothing to match on', () => {
    expect(matchScore(hackathon, emptyProfile)).toBe(-1)
  })

  it('scores interest/major-aligned events above unrelated ones', () => {
    const bakeSale: EdenEvent = { event_id: 2, event_name: 'Bake Sale', club_name: 'Chess Club', event_category: 'fundraiser' }
    expect(matchScore(hackathon, csProfile)).toBeGreaterThan(matchScore(bakeSale, csProfile))
  })

  it("boosts events hosted by the student's own club (name matching is punctuation/case-insensitive)", () => {
    const acmEvent: EdenEvent = { ...hackathon, event_id: 3, club_name: 'A.C.M.' } // matches profile club "ACM"
    expect(matchScore(acmEvent, csProfile)).toBeGreaterThan(matchScore(hackathon, csProfile))
  })

  it('never exceeds 100 even for a perfect-storm event', () => {
    const perfect: EdenEvent = {
      ...hackathon,
      club_name: 'ACM',
      engagement_score: 99,
      has_free_food: true,
    }
    expect(matchScore(perfect, csProfile)).toBeLessThanOrEqual(100)
  })
})

describe('explainMatch', () => {
  it('cites club membership when the student belongs to the hosting club', () => {
    const acmEvent: EdenEvent = { ...hackathon, club_name: 'ACM' }
    expect(explainMatch(acmEvent, csProfile)).toContain("member of ACM")
  })

  it('always returns a sentence, even with nothing specific to cite', () => {
    const generic: EdenEvent = { event_id: 4, event_name: 'Mystery Meetup', club_name: 'Unknown Org' }
    const text = explainMatch(generic, { major: 'Underwater Basket Weaving', interests: [], clubs: [] })
    expect(text.length).toBeGreaterThan(10)
  })
})
