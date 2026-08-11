import { useState, useMemo, useEffect } from 'react';
import type {
  Opportunity,
  OpportunityType,
  TrackedApplication,
  ApplicationStatus,
  CreateOpportunityInput,
} from '../types/opportunities';


export type FilterType = OpportunityType | 'all';

/**
 * Display names for the `districtId` slugs carried on opportunities — these are
 * NJIT departments, i.e. what a student picks as their major. Only entries whose
 * auto-generated title case reads wrong need listing here; anything missing
 * falls back to `formatMajorLabel()` below, so a new department slug appearing
 * in API data shows up in the dropdown without a code change.
 *
 * NOTE these slugs are unrelated to the ids in pages/districts/data/districts.ts
 * ("ai", "bio", "engineering", …) despite both being called districts.
 */
const MAJOR_LABELS: Record<string, string> = {
  'electrical-computer-engineering': 'Electrical & Computer Engineering',
  'mechanical-industrial-engineering': 'Mechanical & Industrial Engineering',
  'chemical-materials-engineering': 'Chemical & Materials Engineering',
  'civil-environmental-engineering': 'Civil & Environmental Engineering',
  'chemistry-environmental-science': 'Chemistry & Environmental Science',
  'humanities-social-sciences': 'Humanities & Social Sciences',
  'applied-engineering-technology': 'Applied Engineering & Technology',
  'architecture-design': 'Architecture & Design',
};

export function formatMajorLabel(id: string): string {
  if (id === 'all') return 'All majors';
  return (
    MAJOR_LABELS[id] ??
    id.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  );
}

import { apiFetch, API_BASE_URL as API } from '@/lib/api';

function getDaysUntilDeadline(deadline?: string) {
  if (!deadline) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

export function useOpportunities(initialDistrict?: string | null) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [tracked, setTracked] = useState<TrackedApplication[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [apiOpps, setApiOpps] = useState<Opportunity[]>([]);
  // `districtFilter` IS the major filter — the department slug on an opportunity.
  // The name is kept because it is also driven by the ?district= URL param that
  // the campus graph links in with; the UI just labels it "Major".
  const [districtFilter, setDistrictFilter] = useState<string | null>(initialDistrict ?? null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetch(`${API}/api/opportunities?limit=300`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((rows: Opportunity[]) => setApiOpps(rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDistrictFilter(initialDistrict ?? null);
  }, [initialDistrict]);

  // Every listing shown is a real row from /api/opportunities — i.e. submitted by
  // a student. The 36-entry MOCK_OPPORTUNITIES array that used to be merged in
  // here was deleted: it was hardcoded sample data (Google, Apple, Microsoft
  // internships) indistinguishable from real listings in the UI, so students
  // could open one and find nothing to apply to. An empty feed is honest; a feed
  // padded with fake listings is not.
  const allOpportunities = apiOpps;

  const districtScoped = useMemo(() => {
    if (!districtFilter) return allOpportunities;
    const id = districtFilter.toLowerCase();
    return allOpportunities.filter((opportunity) =>
      (opportunity.districtId && opportunity.districtId.toLowerCase() === id) ||
      opportunity.tags.some((tag) => tag.toLowerCase() === id)
    );
  }, [allOpportunities, districtFilter]);

  // Derived from the data, not a hardcoded list, so a department that only
  // exists in API rows still appears. Built from ALL opportunities rather than
  // districtScoped — otherwise picking a major would collapse the dropdown to
  // just that one option and strand the user there.
  const majorOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const opportunity of allOpportunities) {
      if (opportunity.districtId) ids.add(opportunity.districtId);
    }
    // districtScoped matches a districtId OR a tag, so an incoming ?district=
    // (e.g. a campus-graph link using a tag like "SWE") can be a value no
    // opportunity carries as districtId. Keep it in the list regardless —
    // without it the <select> has no matching option and renders blank while
    // the filter is silently active.
    if (districtFilter) ids.add(districtFilter);
    return ['all', ...Array.from(ids).sort((a, b) => formatMajorLabel(a).localeCompare(formatMajorLabel(b)))];
  }, [allOpportunities, districtFilter]);

  // The urgency filter (all / due-soon / this-week / this-month) was removed:
  // it hid community submissions whose deadline is absent or far out, which is
  // most of them. Deadline proximity still influences ordering through
  // bestMatchScore below — it just no longer removes anything from the feed.
  const filtered = useMemo(() => (
    filter === 'all'
      ? districtScoped
      : districtScoped.filter((opportunity) => opportunity.type === filter)
  ), [filter, districtScoped]);

  // Title/role only. Org and tag matching was removed so this bar does exactly
  // what its placeholder promises — filtering by role — and the major dropdown
  // owns the "what field is this in" axis instead of it leaking into free text.
  // Substring (not \b word-boundary) so partial typing like "engin" matches
  // while the user is still mid-word.
  const searchScoped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filtered;
    const terms = q.split(/\s+/).filter(Boolean);
    return filtered.filter((opportunity) => {
      const title = opportunity.title.toLowerCase();
      return terms.every((term) => title.includes(term));
    });
  }, [filtered, searchQuery]);

  const sortedFiltered = useMemo(() => {
    const indexMap = new Map(allOpportunities.map((opportunity, index) => [opportunity.id, index]));
    const trackedMap = new Map(tracked.map((item) => [item.opportunityId, item]));

    const bestMatchScore = (opportunity: Opportunity) => {
      let score = opportunity.matchPct ?? 0;
      if (districtFilter && opportunity.districtId?.toLowerCase() === districtFilter.toLowerCase()) {
        score += 40;
      }
      if (trackedMap.has(opportunity.id)) {
        score += 18;
      }
      score += Math.max(0, 15 - Math.min(getDaysUntilDeadline(opportunity.deadline), 15));
      if (opportunity.type === 'internship') score += 6;
      return score;
    };

    // The user-facing Sort control is gone; best-match is now the single fixed
    // ordering. It already folds in the old dropdown's axes — deadline proximity
    // and saved-status both feed bestMatchScore — so removing the control did
    // not remove the behaviour, only the choice.
    return [...searchScoped].sort((a, b) => {
      const delta = bestMatchScore(b) - bestMatchScore(a);
      if (delta !== 0) return delta;

      const aIndex = indexMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = indexMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }, [allOpportunities, districtFilter, searchScoped, tracked]);

  const counts = useMemo(() => ({
    all: districtScoped.length,
    scholarship: districtScoped.filter((opportunity) => opportunity.type === 'scholarship').length,
    internship: districtScoped.filter((opportunity) => opportunity.type === 'internship').length,
    networking: districtScoped.filter((opportunity) => opportunity.type === 'networking').length,
  }), [districtScoped]);

  function trackApplication(opportunityId: string, status: ApplicationStatus) {
    setTracked((previous) => {
      const existingIndex = previous.findIndex((item) => item.opportunityId === opportunityId);
      if (existingIndex >= 0) {
        const next = [...previous];
        next[existingIndex] = { ...next[existingIndex], status };
        return next;
      }
      return [...previous, { opportunityId, status, appliedDate: new Date().toISOString() }];
    });
  }

  function getTracked(opportunityId: string): TrackedApplication | undefined {
    return tracked.find((item) => item.opportunityId === opportunityId);
  }

  function untrackApplication(opportunityId: string) {
    setTracked((previous) => previous.filter((item) => item.opportunityId !== opportunityId));
  }

  async function createOpportunity(input: CreateOpportunityInput, token: string) {
    const { ok, data: payload } = await apiFetch<Opportunity & { error?: string }>('/api/opportunities', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!ok) {
      throw new Error(payload.error ?? 'Could not create opportunity');
    }

    const created = payload as Opportunity;
    setApiOpps((previous) => [created, ...previous.filter((opportunity) => opportunity.id !== created.id)]);
    return created;
  }

  return {
    filtered,
    sortedFiltered,
    counts,
    filter,
    setFilter,
    activeId,
    setActiveId,
    tracked,
    trackApplication,
    untrackApplication,
    getTracked,
    createOpportunity,
    districtFilter,
    setDistrictFilter,
    majorOptions,
    searchQuery,
    setSearchQuery,
  };
}
