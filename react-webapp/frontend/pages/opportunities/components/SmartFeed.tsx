import type { Opportunity, TrackedApplication } from '../types/opportunities';
import type { SortType, UrgencyFilter } from '../hooks/useOpportunities';
import ListingCard from './ListingCard';

interface Props {
  opportunities: Opportunity[];
  tracked: TrackedApplication[];
  activeId: string | null;
  sortBy: SortType;
  urgencyFilter: UrgencyFilter;
  sortOptions: { key: SortType; label: string }[];
  urgencyOptions: { key: UrgencyFilter; label: string }[];
  insightCards: readonly { label: string; value: number; tone: 'blue' | 'red' | 'green' }[];
  selectedOpportunity: Opportunity | null;
  whyThisMatters: string[];
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onSortChange: (value: SortType) => void;
  onUrgencyChange: (value: UrgencyFilter) => void;
}

export default function SmartFeed({
  opportunities,
  tracked,
  activeId,
  sortBy,
  urgencyFilter,
  sortOptions,
  urgencyOptions,
  insightCards,
  selectedOpportunity,
  whyThisMatters,
  onSelect,
  onDeselect,
  onSortChange,
  onUrgencyChange,
}: Props) {
  const visibleOpportunities = opportunities;

  return (
    <div className="opportunities-feed-shell">
      <div className="opportunities-feed-header">
        <div className="opportunities-feed-heading">Opportunity Feed</div>
        <div className="opportunities-feed-subtitle">
          {visibleOpportunities.length} opportunit{visibleOpportunities.length !== 1 ? 'ies' : 'y'} available
        </div>

        <div className="opportunities-insight-grid">
          {insightCards.map((card) => (
            <div key={card.label} className={`opportunities-insight-card ${card.tone}`}>
              <div className="opportunities-insight-value">{card.value}</div>
              <div className="opportunities-insight-label">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="opportunities-control-row">
          <div className="opportunities-control-group">
            <label className="opportunities-control-label" htmlFor="opportunities-sort">
              Sort
            </label>
            <select
              id="opportunities-sort"
              className="opportunities-control-select"
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as SortType)}
            >
              {sortOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="opportunities-control-group">
            <label className="opportunities-control-label" htmlFor="opportunities-urgency">
              Urgency
            </label>
            <select
              id="opportunities-urgency"
              className="opportunities-control-select"
              value={urgencyFilter}
              onChange={(event) => onUrgencyChange(event.target.value as UrgencyFilter)}
            >
              {urgencyOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="opportunities-why-panel">
          {selectedOpportunity && (
            <button
              type="button"
              className="card-back-btn"
              onClick={onDeselect}
            >
              Back to all opportunities
            </button>
          )}
          <div className="opportunities-why-kicker">Why This Matters</div>
          <div className="opportunities-why-title">
            {selectedOpportunity ? selectedOpportunity.title : 'Select an opportunity'}
          </div>
          {whyThisMatters.map((item) => (
            <div key={item} className="opportunities-why-item">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="opportunities-feed-list">
        {visibleOpportunities.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: '0.8rem' }}>
            No opportunities found.
          </div>
        ) : (
          visibleOpportunities.map(o => (
            <ListingCard
              key={o.id}
              opportunity={o}
              tracked={tracked.find(t => t.opportunityId === o.id)}
              active={activeId === o.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
