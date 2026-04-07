import type { Opportunity, TrackedApplication, ApplicationStatus } from '../types/opportunities';
import ListingCard from './ListingCard';

interface Props {
  opportunities: Opportunity[];
  tracked: TrackedApplication[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  trackApplication: (id: string, status: ApplicationStatus) => void;
  getTracked: (id: string) => TrackedApplication | undefined;
}

export default function SmartFeed({ opportunities, tracked, onSelect }: Props) {
  const visibleOpportunities = opportunities;

  return (
    <div style={{
      width: '100%',
      minWidth: 0,
      minHeight: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface)',
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
          {visibleOpportunities.length} opportunit{visibleOpportunities.length !== 1 ? 'ies' : 'y'} available
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
