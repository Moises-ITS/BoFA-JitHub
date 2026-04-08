import type { TrackedApplication, ApplicationStatus } from '../types/opportunities';

const STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  saved: '#8a97b0',
  applied: '#60a5fa',
  interview: '#f59e0b',
  offer: '#4ade80',
  rejected: '#f87171',
};

interface Props {
  tracked: TrackedApplication[];
  getOpportunityTitle: (id: string) => string;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}

export default function ApplicationTracker({ tracked, getOpportunityTitle, onStatusChange }: Props) {
  if (tracked.length === 0) {
    return (
      <div className="opportunities-tracker-empty">
        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>...</div>
        No applications tracked yet.<br />
        Click "Apply / Save" on any opportunity to track it here.
      </div>
    );
  }

  return (
    <div className="opportunities-tracker-list">
      {tracked.map((t) => (
        <div key={t.opportunityId} className="opportunities-tracker-card">
          <div className="opportunities-tracker-title">
            {getOpportunityTitle(t.opportunityId)}
          </div>
          <div className="opportunities-tracker-progress">
            {STATUSES.map((status) => (
              <div
                key={status}
                className={`opportunities-tracker-node ${t.status === status ? 'active' : ''}`}
                style={{
                  borderColor: STATUS_COLOR[status],
                  background: t.status === status ? `${STATUS_COLOR[status]}26` : 'transparent',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(t.opportunityId, s)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: t.status === s ? `1px solid ${STATUS_COLOR[s]}` : '1px solid transparent',
                  background: t.status === s ? `${STATUS_COLOR[s]}22` : 'transparent',
                  color: t.status === s ? STATUS_COLOR[s] : 'var(--muted)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          {t.appliedDate && (
            <div className="opportunities-tracker-date">
              Tracked {new Date(t.appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
