import type { Opportunity, TrackedApplication, ApplicationStatus } from '../types/opportunities';
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
  selectedTracked?: TrackedApplication;
  focusedLabel: string | null;
  whyThisMatters: string[];
  hasActiveFilters: boolean;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onClearFilters: () => void;
  onSortChange: (value: SortType) => void;
  onUrgencyChange: (value: UrgencyFilter) => void;
  onTrackStatus: (id: string, status: ApplicationStatus) => void;
  onUnsave: (id: string) => void;
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
  selectedTracked,
  focusedLabel,
  whyThisMatters,
  hasActiveFilters,
  onSelect,
  onDeselect,
  onClearFilters,
  onSortChange,
  onUrgencyChange,
  onTrackStatus,
  onUnsave,
}: Props) {
  const visibleOpportunities = opportunities;
  const detailDeadline = selectedOpportunity?.deadline
    ? new Date(selectedOpportunity.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const highlightLabel =
    selectedOpportunity?.deadline
      ? (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const due = new Date(selectedOpportunity.deadline);
          due.setHours(0, 0, 0, 0);
          const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
          if (days >= 0 && days <= 3) return 'Closing Soon';
          if (days >= 0 && days <= 7) return 'Hot';
          return selectedOpportunity.type === 'internship' ? 'Featured' : null;
        })()
      : (selectedOpportunity?.type === 'internship' ? 'Featured' : null);

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

        {(hasActiveFilters || focusedLabel) && (
          <div className="opportunities-feed-utility-row">
            {focusedLabel && (
              <div className="opportunities-focus-chip">
                Focused on {focusedLabel}
              </div>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                className="opportunities-clear-btn"
                onClick={onClearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

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
          {selectedOpportunity && (
            <div className="opportunities-detail-card">
              <div className="opportunities-detail-top">
                <div className="opportunities-detail-org">{selectedOpportunity.org}</div>
                {highlightLabel && (
                  <span className="opportunities-hot-badge">{highlightLabel}</span>
                )}
              </div>
              <div className="opportunities-detail-meta">
                <span>{selectedOpportunity.city}, {selectedOpportunity.state}</span>
                {detailDeadline && <span>Due {detailDeadline}</span>}
                {selectedTracked && (
                  <span className="opportunities-status-pill">
                    {selectedTracked.status}
                  </span>
                )}
              </div>
              <div className="opportunities-detail-tags">
                <span className={`opportunities-type-chip ${selectedOpportunity.type}`}>
                  {selectedOpportunity.type}
                </span>
                {selectedOpportunity.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="opportunities-detail-tag">{tag}</span>
                ))}
              </div>
              <div className="opportunities-cta-row">
                <button
                  type="button"
                  className="opportunities-primary-cta"
                  onClick={() => onTrackStatus(selectedOpportunity.id, 'applied')}
                >
                  Apply / Mark Applied
                </button>
                <button
                  type="button"
                  className="opportunities-secondary-cta"
                  onClick={() => (
                    selectedTracked?.status === 'saved'
                      ? onUnsave(selectedOpportunity.id)
                      : onTrackStatus(selectedOpportunity.id, 'saved')
                  )}
                >
                  {selectedTracked?.status === 'saved' ? 'Unsave' : 'Save'}
                </button>
                {selectedOpportunity.url && (
                  <a
                    className="opportunities-link-cta"
                    href={selectedOpportunity.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Details
                  </a>
                )}
              </div>
            </div>
          )}
          {whyThisMatters.map((item) => (
            <div key={item} className="opportunities-why-item">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="opportunities-feed-list">
        {visibleOpportunities.length === 0 ? (
          <div className="opportunities-empty-state">
            <div className="opportunities-empty-orb" />
            <div className="opportunities-empty-title">No opportunities match these filters</div>
            <div className="opportunities-empty-copy">
              Try broadening your location, urgency, or type filters to bring the map back to life.
            </div>
            <button
              type="button"
              className="opportunities-empty-action"
              onClick={onClearFilters}
            >
              Reset filters
            </button>
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
