import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOpportunities } from './hooks/useOpportunities';
import type { FilterType } from './hooks/useOpportunities';
import type { Opportunity } from './types/opportunities';
import NetworkBadge from './components/NetworkBadge';
import SmartFeed from './components/SmartFeed';
import ApplicationTracker from './components/ApplicationTracker';
import USMapSVG from './components/USMapSVG';
import './Opportunities.css';

type SideTab = 'feed' | 'tracker';

export default function OpportunitiesPage() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  const {
    filtered, counts, filter, setFilter,
    activeId, setActiveId,
    tracked, trackApplication, getTracked,
  } = useOpportunities();

  const [sideTab,  setSideTab]  = useState<SideTab>('feed');
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);

  const activeOpp = filtered.find(o => o.id === activeId) ?? null;

  const handlePinClick = useCallback((opp: Opportunity, screenX: number, screenY: number) => {
    if (activeId === opp.id) {
      setActiveId(null);
      setPopupPos(null);
      return;
    }
    setActiveId(opp.id);
    setPopupPos({ x: screenX, y: screenY });
  }, [activeId, setActiveId]);

  const closePopup   = () => { setActiveId(null); setPopupPos(null); };
  const handleLogout = () => { logout(); navigate('/login'); };

  const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
    { key: 'all',         label: 'All' },
    { key: 'scholarship', label: 'Scholarships' },
    { key: 'internship',  label: 'Internships' },
    { key: 'networking',  label: 'Networking' },
  ];

  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: '#06091a',
      color: '#e2e8f0',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Navbar */}
      <nav style={{
        background: '#CC0000',
        padding: '11px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: '1.2rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🗺️</span>
          <div>
            <div>OpportunityMap</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>NJIT Opportunities Explorer</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/graph')} style={{
            background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
            padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Back to Graph</button>
          <button onClick={handleLogout} style={{
            background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
            padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Logout</button>
        </div>
      </nav>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Map View */}
        <div className="map-view" onClick={closePopup}>
          <div className="map-header">
            <div>
              <div className="map-title"><span>🗺️</span> Opportunity Map</div>
              <p className="map-subtitle">
                {counts[filter === 'all' ? 'all' : filter]} opportunities across the US
              </p>
            </div>
            <div className="map-filters">
              {FILTER_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`map-filter-btn ${key} ${filter === key ? 'active' : ''}`}
                  onClick={e => { e.stopPropagation(); setFilter(key); closePopup(); }}
                >
                  {label}
                  <span className="map-filter-count">
                    {key === 'all' ? counts.all : counts[key as keyof typeof counts]}
                  </span>
                </button>
              ))}
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
                { type: 'internship',  label: 'Internship',  color: '#3b82f6' },
                { type: 'networking',  label: 'Networking',  color: '#a78bfa' },
              ].map(({ type, label, color }) => (
                <div key={type} className="legend-item">
                  <span className="legend-dot" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div style={{
          width: 300, display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {(['feed', 'tracker'] as SideTab[]).map(tab => (
              <button key={tab} onClick={() => setSideTab(tab)} style={{
                flex: 1, padding: '11px 0', background: 'none', border: 'none',
                borderBottom: sideTab === tab ? '2px solid #CC0000' : '2px solid transparent',
                color: sideTab === tab ? 'var(--text)' : 'var(--muted)',
                fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'color 0.15s',
              }}>
                {tab === 'feed'
                  ? '📡 Feed'
                  : ('📋 Tracker' + (tracked.length > 0 ? ' (' + tracked.length + ')' : ''))}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {sideTab === 'feed' ? (
              <SmartFeed
                opportunities={filtered}
                filter={filter}
                tracked={tracked}
                onSelect={id => { setActiveId(id); setSideTab('feed'); }}
              />
            ) : (
              <ApplicationTracker
                tracked={tracked}
                getOpportunityTitle={id => filtered.find(o => o.id === id)?.title ?? id}
                onStatusChange={trackApplication}
              />
            )}
          </div>
        </div>
      </div>

      {/* Popup */}
      {activeOpp && popupPos && (
        <div
          className="map-popup"
          style={{
            left: Math.min(popupPos.x, window.innerWidth - 328),
            top:  popupPos.y - 10,
            transform: 'translateY(-100%)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <button className="popup-close" onClick={closePopup}>x</button>
          <div className="popup-header">
            <NetworkBadge type={activeOpp.type} />
            <span className="popup-match">{activeOpp.matchPct}% match</span>
          </div>
          <div className="popup-title">{activeOpp.title}</div>
          <div className="popup-org">{activeOpp.org}</div>
          <div className="popup-city">📍 {activeOpp.city}, {activeOpp.state}</div>
          <div className="popup-meta">
            {activeOpp.amount  && <span>💰 {activeOpp.amount}</span>}
            {activeOpp.stipend && <span>💵 {activeOpp.stipend}</span>}
            {activeOpp.deadline && (
              <span>📅 Due {new Date(activeOpp.deadline).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}</span>
            )}
          </div>
          <div className="popup-tags">
            {activeOpp.tags.map(tag => (
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
            {getTracked(activeOpp.id) ? 'Update Tracker' : 'Save & Track'}
          </button>
        </div>
      )}
    </div>
  );
}