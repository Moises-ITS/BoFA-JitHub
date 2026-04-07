import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOpportunities } from './hooks/useOpportunities';
import type { FilterType } from './hooks/useOpportunities';
import SmartFeed from './components/SmartFeed';
import ApplicationTracker from './components/ApplicationTracker';
import GlobeView from './components/GlobeView';
import SubmitOpportunityModal from './components/SubmitOpportunityModal';
import { useAuth } from '../../context/AuthContext';
import './Opportunities.css';


type SideTab = 'feed' | 'tracker';


export default function OpportunitiesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const districtParam = searchParams.get('district');
  const { token } = useAuth();
  const {
    filtered, counts, filter, setFilter,
    activeId, setActiveId,
    tracked, trackApplication, getTracked, createOpportunity,
    districtFilter, setDistrictFilter,
    locationFilter, setLocationFilter, locationOptions,
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
              opportunities={filtered}
              tracked={tracked}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setSideTab('feed');
              }}
              onDeselect={() => setActiveId(null)}
              trackApplication={trackApplication}
              getTracked={getTracked}
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
