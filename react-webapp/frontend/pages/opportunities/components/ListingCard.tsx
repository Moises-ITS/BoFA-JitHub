import type { CSSProperties } from 'react';
import { Opportunity, OPPORTUNITY_TYPE_LABELS } from '../types/opportunities';
import NetworkBadge from './NetworkBadge';

interface Props {
  opportunity: Opportunity;
  onToggleApplied: (id: string) => void;
  onToggleSaved: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  research:   '#8b5cf6',
  internship: '#3b82f6',
  job:        '#22c55e',
  club:       '#f59e0b',
  fellowship: '#CC0000',
  ta:         '#06b6d4',
};

export default function ListingCard({ opportunity: o, onToggleApplied, onToggleSaved }: Props) {
  return (
    <article className={`listing-card ${o.applied ? 'listing-card--applied' : ''}`}>
      {/* Header row */}
      <div className="listing-card__header">
        <div className="listing-card__meta">
          <span
            className="listing-type-badge"
            style={{ '--type-color': TYPE_COLORS[o.type] } as CSSProperties}
          >
            {OPPORTUNITY_TYPE_LABELS[o.type]}
          </span>
          <NetworkBadge score={o.matchScore} />
        </div>
        <div className="listing-card__actions">
          <button
            className={`icon-btn ${o.saved ? 'icon-btn--active' : ''}`}
            onClick={() => onToggleSaved(o.id)}
            title={o.saved ? 'Remove from saved' : 'Save'}
            aria-label={o.saved ? 'Unsave' : 'Save'}
          >
            {o.saved ? '★' : '☆'}
          </button>
          <button
            className={`apply-btn ${o.applied ? 'apply-btn--applied' : ''}`}
            onClick={() => onToggleApplied(o.id)}
          >
            {o.applied ? '✓ Applied' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Title & org */}
      <h3 className="listing-card__title">{o.title}</h3>
      <p className="listing-card__org">
        {o.organization}
        {o.location && <span className="listing-card__loc"> · {o.location}</span>}
      </p>

      {/* Description */}
      <p className="listing-card__desc">{o.description}</p>

      {/* Footer */}
      <div className="listing-card__footer">
        <div className="listing-card__tags">
          {o.tags.map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
        <div className="listing-card__right">
          {o.deadline && (
            <span className="listing-deadline">Due {o.deadline}</span>
          )}
          <span className="listing-age">
            {o.postedDaysAgo === 0 ? 'Today' : `${o.postedDaysAgo}d ago`}
          </span>
        </div>
      </div>
    </article>
  );
}
