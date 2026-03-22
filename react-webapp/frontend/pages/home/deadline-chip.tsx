import { Clock } from "lucide-react";
import { differenceInDays, differenceInHours, format } from "date-fns";

interface DeadlineChipProps {
  deadline: Date;
  className?: string;
}

export function DeadlineChip({ deadline, className = "" }: DeadlineChipProps) {
  const now = new Date();
  const daysLeft = differenceInDays(deadline, now);
  const hoursLeft = differenceInHours(deadline, now);

  const getUrgencyColor = () => {
    if (daysLeft < 1) return { backgroundColor: "var(--brand-primary)", color: "#FFFFFF" };
    if (daysLeft < 3) return { backgroundColor: "var(--status-warning)", color: "#FFFFFF" };
    if (daysLeft < 7) return { backgroundColor: "var(--accent-events)", color: "#FFFFFF" };
    return { backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)" };
  };

  const getTimeText = () => {
    if (daysLeft < 0) return "Expired";
    if (daysLeft === 0) return `${hoursLeft}h left`;
    if (daysLeft === 1) return "Tomorrow";
    if (daysLeft < 7) return `${daysLeft} days`;
    return format(deadline, "MMM d");
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${className}`}
      style={getUrgencyColor()}
    >
      <Clock className="w-3 h-3" />
      {getTimeText()}
    </div>
  );
}
