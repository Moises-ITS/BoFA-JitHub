import { Bookmark } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

interface BookmarkButtonProps {
  initialBookmarked?: boolean;
  onToggle?: (bookmarked: boolean) => void;
  className?: string;
}

export function BookmarkButton({ initialBookmarked = false, onToggle, className = "" }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !bookmarked;
    setBookmarked(newState);
    onToggle?.(newState);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${className}`}
    >
      <Bookmark
        className="w-4 h-4"
        style={bookmarked ? { fill: "var(--brand-primary)", color: "var(--brand-primary)" } : { color: "var(--text-muted)" }}
      />
    </motion.button>
  );
}
