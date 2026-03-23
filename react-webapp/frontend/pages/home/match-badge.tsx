import { motion } from "motion/react";

interface MatchBadgeProps {
  score: number;
  className?: string;
}

export function MatchBadge({ score, className = "" }: MatchBadgeProps) {
  const getColor = (value: number) => {
    if (value >= 80) return "linear-gradient(90deg, var(--brand-primary), var(--accent-orgs))";
    if (value >= 60) return "linear-gradient(90deg, var(--accent-events), var(--accent-opportunities))";
    return "linear-gradient(90deg, var(--text-subtle), var(--text-muted))";
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-medium shadow-lg ${className}`}
      style={{ backgroundImage: getColor(score) }}
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
      </svg>
      {score}% match
    </motion.div>
  );
}
