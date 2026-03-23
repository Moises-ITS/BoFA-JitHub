import type { Opportunity, TrackedApplication } from '../types/opportunities';
import NetworkBadge from './NetworkBadge';

interface Props {
  opportunity: Opportunity;
  tracked?: TrackedApplication;
  onSelect: (id: string) => void;
}

const TYPE_ICON: Record<string, string> = {
  scholarship: '🎓',
  internship:  '💼',
  networking:  '🤝',
};

export default function ListingCard({ opportunity: o, tracked, onSelect }: Props) {
  const deadlineStr = o.deadline
    ? new Date(o.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className="listing-card"
      onClick={() => onSelect(o.id)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        marginBottom: 8,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a5568')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '1rem' }}>{TYPE_ICON[o.type]}</span>
          <NetworkBadge type={o.type} />
        </div>
      </div>

      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
        {o.title}
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 4 }}>
        {o.org} · {o.city}, {o.state}
      </div>

      <div style={{ display: 'flex', gap: 10, fontSize: '0.7rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
        {o.amount  && <span>💰 {o.amount}</span>}
        {o.stipend && <span>💵 {o.stipend}</span>}
        {deadlineStr && <span>📅 Due {deadlineStr}</span>}
        {tracked && (
          <span style={{ color: 'var(--blue-light)', fontWeight: 600, textTransform: 'capitalize' }}>
            ● {tracked.status}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {o.tags.slice(0, 3).map(tag => (
          <span key={tag} className="popup-tag">{tag}</span>
        ))}
      </div>
    </div>
  );
}
