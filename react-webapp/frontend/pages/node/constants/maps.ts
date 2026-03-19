import type { NodeType } from "../types/graphNodes";

export const TYPE_COLOR: Record<NodeType, string> = {
  student:   "#60a5fa",
  club:      "#34d399",
  company:   "#fb923c",
  professor: "#a78bfa",
  interest:  "#fbbf24",
};

export const TYPE_EMOJI: Record<NodeType, string> = {
  student:   "🎓",
  club:      "🏛️",
  company:   "🏢",
  professor: "👨‍🏫",
  interest:  "💡",
};

export const TYPE_BADGE: Record<NodeType, { bg: string; color: string; border: string }> = {
  student:   { bg: "#1e3a5f", color: "#60a5fa", border: "#60a5fa44" },
  club:      { bg: "#064e3b", color: "#34d399", border: "#34d39944" },
  company:   { bg: "#431407", color: "#fb923c", border: "#fb923c44" },
  professor: { bg: "#2e1065", color: "#a78bfa", border: "#a78bfa44" },
  interest:  { bg: "#451a03", color: "#fbbf24", border: "#fbbf2444" },
};

export const DETAIL_ICONS: Record<string, string> = {
  major:     "📚",
  year:      "📅",
  gpa:       "⭐",
  goal:      "🎯",
  company:   "🏢",
  role:      "💼",
  year_grad: "🎓",
  research:  "🔬",
  open_roles:"💼",
  focus:     "🎯",
  members:   "👥",
};
