import type { OpportunityType } from '../types/opportunities';

interface Props {
  type: OpportunityType;
  className?: string;
}

const LABEL: Record<OpportunityType, string> = {
  scholarship: 'Scholarship',
  internship:  'Internship',
  networking:  'Networking',
};

export default function NetworkBadge({ type, className = '' }: Props) {
  return (
    <span className={`popup-type-badge ${type} ${className}`}>
      {LABEL[type]}
    </span>
  );
}
