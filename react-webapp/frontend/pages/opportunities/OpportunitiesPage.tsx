import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOpportunities } from './hooks/useOpportunities';
import type { FilterType } from './hooks/useOpportunities';
import type { Opportunity } from './types/opportunities';
import NetworkBadge from './components/NetworkBadge';
import SmartFeed from './components/SmartFeed';
import ApplicationTracker from './components/ApplicationTracker';
import USMapSVG from './components/USMapSVG';
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
  } = useOpportunities(districtParam);

  const [sideTab, setSideTab] = useState<SideTab>('feed');
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const activeOpp = filtered.find((o) => o.id === activeId) ?? null;

  const handlePinClick = useCallback((opp: Opportunity, screenX: number, screenY: number) => {
    if (activeId === opp.id) {
      setActiveId(null);
      setPopupPos(null);
      return;
    }

    setActiveId(opp.id);
    setPopupPos({ x: screenX, y: screenY });
  }, [activeId, setActiveId]);

  const closePopup = () => {
    setActiveId(null);
    setPopupPos(null);
  };

  async function handleCreateOpportunity(payload: Parameters<typeof createOpportunity>[0]) {
    if (!token) {
      throw new Error('You must be signed in to submit opportunities');
    }

    setSubmitLoading(true);
    try {
      await createOpportunity(payload, token);
      setFilter('all');
      closePopup();
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

  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (districtFilter) {
        next.set('district', districtFilter);
      } else {
        next.delete('district');
      }
      return next;
    });
  }, [districtFilter, setSearchParams]);

  const clearDistrictChip = () => setDistrictFilter(null);

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: '#06091a',
        color: '#e2e8f0',
        height: 'calc(100vh - 112px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div className="map-view" onClick={closePopup}>
          <div className="map-header">
            <div>
              <div className="map-title">Opportunity Map</div>
              <p className="map-subtitle">
                {counts[filter === 'all' ? 'all' : filter]} opportunities across the US
              </p>
              {districtFilter && (
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
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
                    Filtered to district: <strong style={{ color: '#93c5fd' }}>{districtFilter}</strong>
                    <button
                      onClick={(e) => { e.stopPropagation(); clearDistrictChip(); }}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#93c5fd',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                      aria-label="Clear district filter"
                    >
                      x
                    </button>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/research');
                    }}
                    style={{
                      border: '1px solid rgba(148, 163, 184, 0.35)',
                      background: 'rgba(15, 23, 42, 0.55)',
                      color: '#e2e8f0',
                      borderRadius: 999,
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    aria-label="Back to Research District"
                  >
                    Back to Research District
                  </button>
                </div>
              )}
            </div>
            <div className="map-header-actions">
              <button
                className="map-submit-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  setSubmitOpen(true);
                }}
              >
                Submit Opportunity
              </button>
              <div className="map-filters">
                {filterOptions.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`map-filter-btn ${key} ${filter === key ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilter(key);
                      closePopup();
                    }}
                  >
                    {label}
                    <span className="map-filter-count">
                      {key === 'all' ? counts.all : counts[key as keyof typeof counts]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="map-container">
            <div className="map-img-wrap">
              <USMapSVG
                opportunities={filtered}
                activeId={activeId}
                onPinClick={handlePinClick}
              />
            </div>

            <div className="map-legend">
              {[
                { type: 'scholarship', label: 'Scholarship', color: '#22c55e' },
                { type: 'internship', label: 'Internship', color: '#3b82f6' },
                { type: 'networking', label: 'Networking', color: '#a78bfa' },
              ].map(({ type, label, color }) => (
                <div key={type} className="legend-item">
                  <span className="legend-dot" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            width: 300,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {(['feed', 'tracker'] as SideTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setSideTab(tab)}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: sideTab === tab ? '2px solid #CC0000' : '2px solid transparent',
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

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {sideTab === 'feed' ? (
              <SmartFeed
                opportunities={filtered}
                filter={filter}
                tracked={tracked}
                onSelect={(id) => {
                  setActiveId(id);
                  setSideTab('feed');
                }}
              />
            ) : (
              <ApplicationTracker
                tracked={tracked}
                getOpportunityTitle={(id: string) => filtered.find((o) => o.id === id)?.title ?? id}
                onStatusChange={trackApplication}
              />
            )}
          </div>
        </div>
      </div>

      {activeOpp && popupPos && (
        <div
          className="map-popup"
          style={{
            left: Math.min(popupPos.x, window.innerWidth - 328),
            top: popupPos.y - 10,
            transform: 'translateY(-100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="popup-close" onClick={closePopup}>x</button>
          <div className="popup-header">
            <NetworkBadge type={activeOpp.type} />
          </div>
          <div className="popup-title">{activeOpp.title}</div>
          <div className="popup-org">{activeOpp.org}</div>
          <div className="popup-city">{activeOpp.city}, {activeOpp.state}</div>
          <div className="popup-meta">
            {activeOpp.amount && <span>Amount: {activeOpp.amount}</span>}
            {activeOpp.stipend && <span>Stipend: {activeOpp.stipend}</span>}
            {activeOpp.deadline && (
              <span>
                Due {new Date(activeOpp.deadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
          <div className="popup-tags">
            {activeOpp.tags.map((tag) => (
              <span key={tag} className="popup-tag">{tag}</span>
            ))}
          </div>
          <button
            className={`popup-action ${activeOpp.type}`}
            onClick={() => {
              trackApplication(activeOpp.id, getTracked(activeOpp.id)?.status ?? 'saved');
              setSideTab('tracker');
              closePopup();
            }}
          >
            {getTracked(activeOpp.id) ? 'Update Tracker' : 'Save and Track'}
          </button>
        </div>
      )}

      <SubmitOpportunityModal
        open={submitOpen}
        submitting={submitLoading}
        onClose={() => setSubmitOpen(false)}
        onSubmit={handleCreateOpportunity}
      />
    </div>
  );
}
