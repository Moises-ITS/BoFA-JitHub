import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOpportunities } from './hooks/useOpportunities';
import type { FilterType, SortType, UrgencyFilter } from './hooks/useOpportunities';
import SmartFeed from './components/SmartFeed';
import ApplicationTracker from './components/ApplicationTracker';
import GlobeView from './components/GlobeView';
import SubmitOpportunityModal from './components/SubmitOpportunityModal';
import { useAuth } from '../../context/AuthContext';
import { getCountry } from './utils/getCountry';
import './Opportunities.css';


type SideTab = 'feed' | 'tracker';


export default function OpportunitiesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const districtParam = searchParams.get('district');
  const { token } = useAuth();
  const {
    filtered, sortedFiltered, counts, filter, setFilter,
    activeId, setActiveId,
    tracked, trackApplication, untrackApplication, getTracked, createOpportunity,
    districtFilter, setDistrictFilter,
    locationFilter, setLocationFilter, locationOptions,
    sortBy, setSortBy, urgencyFilter, setUrgencyFilter,
    searchQuery, setSearchQuery,
  } = useOpportunities(districtParam);


  const [sideTab, setSideTab] = useState<SideTab>('feed');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);


  async function handleCreateOpportunity(
    payload: Parameters<typeof createOpportunity>[0],
  ) {
    if (!token) throw new Error('You must be signed in to submit opportunities');
    setSubmitLoading(true);
    try {
      await createOpportunity(payload, token);
      setFilter('all');
      setActiveId(null);
      setSideTab('feed');
      setSubmitOpen(false);
    } finally {
      setSubmitLoading(false);
    }
  }


  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'scholarship', label: 'Scholarships' },
    { key: 'internship', label: 'Internships' },
    { key: 'networking', label: 'Networking' },
  ];

  function getLocationLabel(option: string) {
    if (option === 'all') return 'All locations';
    if (option === 'USA') return 'United States';
    return option;
  }

  const sortOptions: { key: SortType; label: string }[] = [
    { key: 'best-match', label: 'Best Match' },
    { key: 'due-soon', label: 'Due Soon' },
    { key: 'newest', label: 'Newest' },
    { key: 'saved-first', label: 'Saved First' },
  ];

  const urgencyOptions: { key: UrgencyFilter; label: string }[] = [
    { key: 'all', label: 'All dates' },
    { key: 'due-soon', label: 'Due Soon' },
    { key: 'this-week', label: 'This Week' },
    { key: 'this-month', label: 'This Month' },
  ];


  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (districtFilter) next.set('district', districtFilter);
      else next.delete('district');
      return next;
    });
  }, [districtFilter, setSearchParams]);


  const activeCount =
    counts[filter === 'all' ? 'all' : (filter as keyof typeof counts)];

  const selectedOpportunity =
    sortedFiltered.find((opportunity) => opportunity.id === activeId) ?? null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 86400000;
  const daysUntil = (deadline?: string) => {
    if (!deadline) return Number.POSITIVE_INFINITY;
    const due = new Date(deadline);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / msPerDay);
  };

  const dueThisWeek = sortedFiltered.filter((opportunity) => {
    const days = daysUntil(opportunity.deadline);
    return Number.isFinite(days) && days >= 0 && days <= 7;
  }).length;

  const trackedInView = tracked.filter((item) =>
    sortedFiltered.some((opportunity) => opportunity.id === item.opportunityId),
  ).length;

  const insightCards = [
    { label: 'Open Now', value: sortedFiltered.length, tone: 'blue' },
    { label: 'Due This Week', value: dueThisWeek, tone: 'red' },
    { label: 'Saved / Applied', value: trackedInView, tone: 'green' },
  ] as const;
  const selectedTracked = selectedOpportunity ? getTracked(selectedOpportunity.id) : undefined;
  const hasActiveFilters =
    filter !== 'all' ||
    locationFilter !== 'all' ||
    urgencyFilter !== 'all' ||
    districtFilter !== null ||
    searchQuery !== '';
  const focusedLabel = selectedOpportunity
    ? `${selectedOpportunity.city}, ${getLocationLabel(getCountry(selectedOpportunity.city).country)}`
    : null;

  const whyThisMatters = selectedOpportunity
    ? [
        (() => {
          const days = daysUntil(selectedOpportunity.deadline);
          if (!Number.isFinite(days)) return 'Flexible timeline with no posted deadline.';
          if (days < 0) return 'Deadline recently passed, so this one may need verification.';
          if (days === 0) return 'Deadline is today, making this the highest-priority action.';
          if (days <= 7) return `Deadline closes in ${days} day${days === 1 ? '' : 's'}, so it deserves fast follow-up.`;
          return `Deadline is ${days} days out, which gives you room to prepare a stronger application.`;
        })(),
        `${getLocationLabel(getCountry(selectedOpportunity.city).country)} opportunity anchored in ${selectedOpportunity.city}, ${selectedOpportunity.state}.`,
        selectedOpportunity.districtId
          ? `Strong tie to the ${selectedOpportunity.districtId.replace(/-/g, ' ')} district, which makes it feel more tailored to this experience.`
          : `${selectedOpportunity.type === 'networking' ? 'Great relationship-building opportunity' : 'Clear career-building opportunity'} with a focused ${selectedOpportunity.type} path.`,
      ]
    : [
        'Pick a pin on the globe or a card in the feed to see why an opportunity stands out.',
        'This panel will surface urgency, location context, and why it is worth attention.',
      ];

  useEffect(() => {
    if (activeId && !sortedFiltered.some((opportunity) => opportunity.id === activeId)) {
      setActiveId(null);
    }
  }, [activeId, setActiveId, sortedFiltered]);


  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: '#06091a',
        color: '#e2e8f0',
        height: 'calc(100vh - 112px)',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* ── Left: Globe panel (space + spinning Earth) ── */}
      <div className="globe-panel">
        <GlobeView opportunities={filtered} activeId={activeId} />
      </div>


      {/* ── Right: Opportunities panel ── */}
      <div className="right-panel">


        {/* Header with filters */}
        <div className="right-panel-header">
          <div className="right-panel-top-row">
            <div>
              <div className="right-panel-title">Opportunities</div>
              <div className="right-panel-subtitle">
                {activeCount}{' '}
                {filter === 'all' ? '' : filter + ' '}
                opportunit{activeCount !== 1 ? 'ies' : 'y'} available
              </div>
            </div>
            <button
              className="map-submit-btn"
              onClick={() => setSubmitOpen(true)}
            >
              Submit Opportunity
            </button>
          </div>


          <div className="map-filters" style={{ marginTop: 10 }}>
            {filterOptions.map(({ key, label }) => (
              <button
                key={key}
                className={`map-filter-btn ${key} ${filter === key ? 'active' : ''}`}
                onClick={() => {
                  setFilter(key);
                  setActiveId(null);
                }}
              >
                {label}
                <span className="map-filter-count">
                  {key === 'all'
                    ? counts.all
                    : counts[key as keyof typeof counts]}
                </span>
              </button>
            ))}
          </div>

          <div className="opportunities-search-wrap">
            <svg className="opportunities-search-icon" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <input
              className="opportunities-search-input"
              type="text"
              placeholder="Search by title, org, or tag…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveId(null); }}
            />
            {searchQuery && (
              <button
                className="opportunities-search-clear"
                onClick={() => { setSearchQuery(''); setActiveId(null); }}
                aria-label="Clear search"
              >×</button>
            )}
          </div>

          <div className="opportunities-location-filter">
            <label
              className="opportunities-location-label"
              htmlFor="opportunities-location"
            >
              Location
            </label>
            <select
              id="opportunities-location"
              className="opportunities-location-select"
              value={locationFilter}
              onChange={(event) => {
                setLocationFilter(event.target.value);
                setActiveId(null);
              }}
            >
              {locationOptions.map((option) => (
                <option key={option} value={option}>
                  {getLocationLabel(option)}
                </option>
              ))}
            </select>
          </div>

          {districtFilter && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  color: '#cbd5e1',
                  fontSize: '12px',
                }}
              >
                District:{' '}
                <strong style={{ color: '#93c5fd' }}>{districtFilter}</strong>
                <button
                  onClick={() => setDistrictFilter(null)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#93c5fd',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                  aria-label="Clear district filter"
                >
                  ×
                </button>
              </span>
              <button
                onClick={() => navigate('/research')}
                style={{
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  background: 'rgba(15, 23, 42, 0.55)',
                  color: '#e2e8f0',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Back to Research District
              </button>
            </div>
          )}
        </div>


        {/* Feed / Tracker tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {(['feed', 'tracker'] as SideTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSideTab(tab)}
              style={{
                flex: 1,
                padding: '11px 0',
                background: 'none',
                border: 'none',
                borderBottom:
                  sideTab === tab
                    ? '2px solid #CC0000'
                    : '2px solid transparent',
                color: sideTab === tab ? 'var(--text)' : 'var(--muted)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'color 0.15s',
              }}
            >
              {tab === 'feed'
                ? 'Feed'
                : `Tracker${tracked.length > 0 ? ` (${tracked.length})` : ''}`}
            </button>
          ))}
        </div>


        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {sideTab === 'feed' ? (
            <SmartFeed
              opportunities={sortedFiltered}
              tracked={tracked}
              activeId={activeId}
              sortBy={sortBy}
              urgencyFilter={urgencyFilter}
              sortOptions={sortOptions}
              urgencyOptions={urgencyOptions}
              insightCards={insightCards}
              selectedOpportunity={selectedOpportunity}
              selectedTracked={selectedTracked}
              focusedLabel={focusedLabel}
              whyThisMatters={whyThisMatters}
              hasActiveFilters={hasActiveFilters}
              onSelect={(id) => {
                setActiveId(id);
                setSideTab('feed');
              }}
              onDeselect={() => setActiveId(null)}
              onClearFilters={() => {
                setFilter('all');
                setLocationFilter('all');
                setUrgencyFilter('all');
                setDistrictFilter(null);
                setSearchQuery('');
                setActiveId(null);
              }}
              onSortChange={setSortBy}
              onUrgencyChange={setUrgencyFilter}
              onTrackStatus={trackApplication}
              onUnsave={untrackApplication}
            />
          ) : (
            <ApplicationTracker
              tracked={tracked}
              getOpportunityTitle={(id: string) =>
                filtered.find((o) => o.id === id)?.title ?? id
              }
              onStatusChange={trackApplication}
            />
          )}
        </div>
      </div>


      <SubmitOpportunityModal
        open={submitOpen}
        submitting={submitLoading}
        onClose={() => setSubmitOpen(false)}
        onSubmit={handleCreateOpportunity}
      />
    </div>
  );
}
