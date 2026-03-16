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
    if (daysLeft < 1) return "bg-[#C0392B] text-white";
    if (daysLeft < 3) return "bg-[#E67E22] text-white";
    if (daysLeft < 7) return "bg-[#F39C12] text-white";
    return "bg-[#2A2A2A] text-[#9CA3AF]";
  };

  const getTimeText = () => {
    if (daysLeft < 0) return "Expired";
    if (daysLeft === 0) return `${hoursLeft}h left`;
    if (daysLeft === 1) return "Tomorrow";
    if (daysLeft < 7) return `${daysLeft} days`;
    return format(deadline, "MMM d");
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${getUrgencyColor()} ${className}`}>
      <Clock className="w-3 h-3" />
      {getTimeText()}
    </div>
  );
}
