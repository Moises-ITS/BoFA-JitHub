import type { Opportunity, TrackedApplication } from '../types/opportunities';
import type { FilterType } from '../hooks/useOpportunities';
import ListingCard from './ListingCard';

interface Props {
  opportunities: Opportunity[];
  filter: FilterType;
  tracked: TrackedApplication[];
  onSelect: (id: string) => void;
}

export default function SmartFeed({ opportunities, filter, tracked, onSelect }: Props) {
  const visibleOpportunities = opportunities;

  return (
    <div style={{
      width: 300,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Feed header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
          Opportunity Feed
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
          {visibleOpportunities.length} {filter === 'all' ? '' : filter} opportunit{visibleOpportunities.length !== 1 ? 'ies' : 'y'} available
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
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
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
