import type { Opportunity, TrackedApplication } from '../types/opportunities';
import { OPPORTUNITY_TYPE_ICON as TYPE_ICON } from '../types/opportunities';
import NetworkBadge from './NetworkBadge';

interface Props {
  opportunity: Opportunity;
  tracked?: TrackedApplication;
  active?: boolean;
  onSelect: (id: string) => void;
}

export default function ListingCard({ opportunity: o, tracked, active = false, onSelect }: Props) {
  const deadlineStr = o.deadline
    ? new Date(o.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const highlightLabel = o.deadline
    ? (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(o.deadline);
        due.setHours(0, 0, 0, 0);
        const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
        if (days >= 0 && days <= 3) return 'Closing Soon';
        if (days >= 0 && days <= 7) return 'Hot';
        return null;
      })()
    : null;

  return (
    <div
      className={`listing-card ${active ? 'active' : ''}`}
      onClick={() => onSelect(o.id)}
      style={{
        background: active ? 'rgba(14, 18, 32, 0.98)' : 'var(--surface)',
        border: active ? '1px solid rgba(59, 130, 246, 0.48)' : '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
        marginBottom: 10,
        boxShadow: active ? '0 0 28px rgba(59, 130, 246, 0.14)' : 'none',
        transform: active ? 'translateY(-1px)' : 'translateY(0)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = active ? 'rgba(59, 130, 246, 0.6)' : '#4a5568';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = active ? 'rgba(59, 130, 246, 0.48)' : 'var(--border)';
        e.currentTarget.style.transform = active ? 'translateY(-1px)' : 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`listing-card-icon ${o.type}`}>{TYPE_ICON[o.type]}</span>
          <NetworkBadge type={o.type} />
        </div>
        {highlightLabel && (
          <span className="listing-card-badge">{highlightLabel}</span>
        )}
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
