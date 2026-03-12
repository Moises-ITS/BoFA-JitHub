import type { Opportunity, FilterState, OpportunityType, UserProfile } from '../types/opportunities';
import { OPPORTUNITY_TYPE_LABELS } from '../types/opportunities';
import ListingCard from './ListingCard';

interface Props {
  opportunities: Opportunity[];
  allOpportunities: Opportunity[];
  typeCounts: Partial<Record<OpportunityType, number>>;
  filters: FilterState;
  profile: UserProfile;
  onToggleType: (type: OpportunityType) => void;
  onSetMinMatch: (val: number) => void;
  onToggleApplied: (id: string) => void;
  onToggleSaved: (id: string) => void;
}

const ALL_TYPES: OpportunityType[] = ['research', 'internship', 'job', 'club', 'fellowship', 'ta'];

export default function SmartFeed({
  opportunities,
  allOpportunities,
  typeCounts,
  filters,
  profile,
  onToggleType,
  onSetMinMatch,
  onToggleApplied,
  onToggleSaved,
}: Props) {
  const appliedCount = allOpportunities.filter(o => o.applied).length;
  const savedCount   = allOpportunities.filter(o => o.saved).length;

  return (
    <div className="feed-layout">
      {/* ── Sidebar ── */}
      <aside className="filter-sidebar">
        {/* Profile summary */}
        {profile.name && (
          <>
            <h3 className="sidebar-heading">Your Profile</h3>
            <div className="profile-chip">
              <div className="chip-label">Name</div>
              <div className="chip-val">{profile.name}</div>
            </div>
            <div className="profile-chip">
              <div className="chip-label">Major · Year</div>
              <div className="chip-val">{profile.major} · {profile.year}</div>
            </div>
            {profile.gpa && (
              <div className="profile-chip">
                <div className="chip-label">GPA</div>
                <div className="chip-val">{profile.gpa}</div>
              </div>
            )}
          </>
        )}

        {/* Activity */}
        <h3 className="sidebar-heading" style={{ marginTop: '20px' }}>Activity</h3>
        <div className="activity-row">
          <span className="activity-label">Applied</span>
          <span className="activity-count applied">{appliedCount}</span>
        </div>
        <div className="activity-row">
          <span className="activity-label">Saved</span>
          <span className="activity-count saved">{savedCount}</span>
        </div>

        {/* Type filter */}
        <h3 className="sidebar-heading" style={{ marginTop: '20px' }}>Type</h3>
        <div className="filter-group">
          {ALL_TYPES.map(type => (
            <label key={type} className="filter-check">
              <input
                type="checkbox"
                checked={filters.types.has(type)}
                onChange={() => onToggleType(type)}
              />
              {OPPORTUNITY_TYPE_LABELS[type]}
              <span className="filter-count">{typeCounts[type] ?? 0}</span>
            </label>
          ))}
        </div>

        {/* Match threshold */}
        <h3 className="sidebar-heading">Min Match</h3>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minMatch}
          onChange={e => onSetMinMatch(Number(e.target.value))}
          className="match-slider"
          aria-label="Minimum match score"
        />
        <div className="match-val">{filters.minMatch}%+</div>
      </aside>

      {/* ── Feed ── */}
      <main className="feed-area">
        <div className="feed-header">
          <h2 className="feed-title">
            {opportunities.length} Opportunit{opportunities.length === 1 ? 'y' : 'ies'} Found
          </h2>
          <span className="feed-subtitle">Ranked by match score · NJIT network</span>
        </div>

        {opportunities.length === 0 ? (
          <div className="feed-empty">
            <div className="feed-empty-icon">🔍</div>
            <p>No opportunities match your current filters.</p>
            <p className="feed-empty-hint">Try lowering the match threshold or clearing type filters.</p>
          </div>
        ) : (
          <div className="feed-list">
            {opportunities.map(opp => (
              <ListingCard
                key={opp.id}
                opportunity={opp}
                onToggleApplied={onToggleApplied}
                onToggleSaved={onToggleSaved}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
