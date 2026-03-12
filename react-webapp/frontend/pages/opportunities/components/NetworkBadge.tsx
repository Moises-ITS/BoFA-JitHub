import type { CSSProperties } from 'react';

interface Props {
  score: number;
}

export default function NetworkBadge({ score }: Props) {
  const color =
    score >= 90 ? 'var(--opp-green)' :
    score >= 75 ? 'var(--opp-blue)'  :
    score >= 60 ? 'var(--opp-gold)'  :
                  'var(--opp-muted)';

  return (
    <div
      className="network-badge"
      style={{ '--badge-color': color } as CSSProperties}
      title={`${score}% match with your profile`}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden={true}>
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="6" cy="6" r="2" fill="currentColor" />
      </svg>
      {score}%
    </div>
  );
}
