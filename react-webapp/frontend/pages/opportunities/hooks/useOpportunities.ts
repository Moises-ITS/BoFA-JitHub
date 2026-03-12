import { useState, useCallback } from 'react';
import {
  Step,
  UserProfile,
  Opportunity,
  FilterState,
  OpportunityType,
} from '../types/opportunities';

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: '1',
    title: 'Undergraduate Research Assistant — NLP Lab',
    organization: 'NJIT CSLA',
    type: 'research',
    matchScore: 95,
    deadline: 'Apr 15, 2025',
    tags: ['Python', 'NLP', 'PyTorch'],
    description:
      'Join Prof. Olariu\'s NLP group to work on large-language-model alignment and evaluation benchmarks for low-resource languages.',
    location: 'Newark, NJ (on-campus)',
    applied: false,
    saved: true,
    postedDaysAgo: 2,
  },
  {
    id: '2',
    title: 'Software Engineering Intern',
    organization: 'Prudential Financial',
    type: 'internship',
    matchScore: 88,
    deadline: 'Mar 31, 2025',
    tags: ['React', 'Java', 'AWS'],
    description:
      'Summer 2025 SWE internship on Prudential\'s digital transformation team. Build full-stack features for client-facing financial dashboards.',
    location: 'Newark, NJ (hybrid)',
    applied: true,
    saved: false,
    postedDaysAgo: 5,
  },
  {
    id: '3',
    title: 'Cybersecurity Research Fellowship',
    organization: 'NJIT CAIT',
    type: 'fellowship',
    matchScore: 82,
    deadline: 'Apr 1, 2025',
    tags: ['Networking', 'Linux', 'Pen Testing'],
    description:
      'Paid research fellowship focusing on IoT device security and vulnerability disclosure. Includes stipend + conference travel funding.',
    location: 'Newark, NJ (on-campus)',
    applied: false,
    saved: false,
    postedDaysAgo: 8,
  },
  {
    id: '4',
    title: 'Teaching Assistant — CS 435 Data Structures',
    organization: 'NJIT Ying Wu College',
    type: 'ta',
    matchScore: 79,
    tags: ['Java', 'Algorithms', 'Teaching'],
    description:
      'Lead recitation sections, hold office hours, and grade assignments for CS 435. Must have completed the course with a B+ or higher.',
    location: 'Newark, NJ (on-campus)',
    applied: false,
    saved: false,
    postedDaysAgo: 3,
  },
  {
    id: '5',
    title: 'ACM Chapter — Project Lead',
    organization: 'NJIT ACM',
    type: 'club',
    matchScore: 76,
    tags: ['Leadership', 'Open Source', 'Project Mgmt'],
    description:
      'Lead a semester-long software project team of 5–8 students. Present at regional ACM-ICPC and SRC competitions.',
    location: 'Newark, NJ',
    applied: false,
    saved: true,
    postedDaysAgo: 1,
  },
  {
    id: '6',
    title: 'Junior Full-Stack Developer',
    organization: 'Audible (Amazon)',
    type: 'job',
    matchScore: 74,
    deadline: 'May 1, 2025',
    tags: ['TypeScript', 'Node.js', 'PostgreSQL'],
    description:
      'Full-time role on the Content Discovery team. Own features from design doc through production. New grad & recent grads welcome.',
    location: 'Newark, NJ (hybrid)',
    applied: false,
    saved: false,
    postedDaysAgo: 12,
  },
  {
    id: '7',
    title: 'Machine Learning Intern',
    organization: 'Cognizant',
    type: 'internship',
    matchScore: 71,
    deadline: 'Apr 10, 2025',
    tags: ['Python', 'TensorFlow', 'SQL'],
    description:
      'Work alongside senior data scientists to build predictive models for enterprise clients. Competitive stipend + housing assistance.',
    location: 'Teaneck, NJ (on-site)',
    applied: false,
    saved: false,
    postedDaysAgo: 7,
  },
  {
    id: '8',
    title: 'Cloud Infrastructure Research',
    organization: 'Bell Labs (Nokia)',
    type: 'research',
    matchScore: 68,
    deadline: 'Mar 28, 2025',
    tags: ['Kubernetes', 'Go', 'Distributed Systems'],
    description:
      'Part-time research collaboration with Bell Labs on edge-cloud orchestration. Co-authorship opportunities on publications.',
    location: 'Murray Hill, NJ (hybrid)',
    applied: false,
    saved: false,
    postedDaysAgo: 14,
  },
];

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useOpportunities() {
  const [step, setStep] = useState<Step>('profile');
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    major: '',
    year: '',
    gpa: '',
    interests: [],
  });
  const [opportunities, setOpportunities] =
    useState<Opportunity[]>(MOCK_OPPORTUNITIES);
  const [filters, setFilters] = useState<FilterState>({
    types: new Set<OpportunityType>(),
    minMatch: 60,
  });

  const submitProfile = useCallback((p: UserProfile) => {
    setProfile(p);
    setStep('scan');
  }, []);

  const finishScan = useCallback(() => {
    setStep('feed');
  }, []);

  const goToStep = useCallback((s: Step) => {
    setStep(s);
  }, []);

  const toggleType = useCallback((type: OpportunityType) => {
    setFilters(prev => {
      const next = new Set(prev.types);
      next.has(type) ? next.delete(type) : next.add(type);
      return { ...prev, types: next };
    });
  }, []);

  const setMinMatch = useCallback((val: number) => {
    setFilters(prev => ({ ...prev, minMatch: val }));
  }, []);

  const toggleApplied = useCallback((id: string) => {
    setOpportunities(prev =>
      prev.map(o => (o.id === id ? { ...o, applied: !o.applied } : o))
    );
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setOpportunities(prev =>
      prev.map(o => (o.id === id ? { ...o, saved: !o.saved } : o))
    );
  }, []);

  const typeCounts = opportunities.reduce<Partial<Record<OpportunityType, number>>>(
    (acc, o) => ({ ...acc, [o.type]: (acc[o.type] ?? 0) + 1 }),
    {}
  );

  const filtered = opportunities.filter(o => {
    if (filters.types.size > 0 && !filters.types.has(o.type)) return false;
    if (o.matchScore < filters.minMatch) return false;
    return true;
  });

  return {
    step,
    profile,
    submitProfile,
    finishScan,
    goToStep,
    opportunities: filtered,
    allOpportunities: opportunities,
    typeCounts,
    filters,
    toggleType,
    setMinMatch,
    toggleApplied,
    toggleSaved,
  };
}
