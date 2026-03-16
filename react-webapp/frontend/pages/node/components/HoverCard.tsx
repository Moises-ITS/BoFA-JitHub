// ─────────────────────────────────────────────────────────────────────────────
// components/HoverCard.tsx
// Lightweight tooltip card that fades in on node hover in free mode
// ─────────────────────────────────────────────────────────────────────────────

import { memo } from "react";
import type { GraphNode } from "../types/graphNodes";
import { TYPE_COLOR, TYPE_EMOJI } from "../constants/maps";

interface HoverCardProps {
  node: GraphNode;
  x:    number;
  y:    number;
}

const HoverCard = memo(function HoverCard({ node, x, y }: HoverCardProps) {
  const { details, type, label } = node;

  // Offset from cursor; flip left if near right edge
  const CARD_W = 200;
  const rawLeft = x + 16;
  const safeLeft = rawLeft + CARD_W > window.innerWidth - 16 ? x - CARD_W - 16 : rawLeft;
  const safeTop  = Math.max(8, y - 24);

  const lines: { icon: string; text: string }[] = [];

  if (type === "student") {
    if (details?.major)     lines.push({ icon: "📚", text: String(details.major) });
    if (details?.year_grad) lines.push({ icon: "🎓", text: `Class of ${details.year_grad}` });
    if (details?.gpa)       lines.push({ icon: "⭐", text: `GPA ${details.gpa}` });
    if (details?.bio) {
      const bio = String(details.bio);
      lines.push({ icon: "💬", text: bio.length > 62 ? bio.slice(0, 60) + "…" : bio });
    }
  } else if (type === "club") {
    if (details?.members) lines.push({ icon: "👥", text: `${details.members} members` });
    if (details?.goal)    lines.push({ icon: "🎯", text: String(details.goal) });
  } else if (type === "company") {
    if (details?.role)       lines.push({ icon: "💼", text: String(details.role) });
    if (details?.open_roles) lines.push({ icon: "🔍", text: `${details.open_roles} open roles` });
  } else if (type === "professor") {
    if (details?.focus)    lines.push({ icon: "🔬", text: String(details.focus) });
    if (details?.research) lines.push({ icon: "📄", text: String(details.research) });
  } else if (type === "interest") {
    if (details?.focus) lines.push({ icon: "✦", text: String(details.focus) });
  }

  return (
    <div className="hoverCard" style={{ left: safeLeft, top: safeTop }}>
      <div className="hoverCardHeader">
        <span className="hoverCardEmoji" style={{ color: TYPE_COLOR[type] }}>
          {TYPE_EMOJI[type]}
        </span>
        <span className="hoverCardName">{label}</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="hoverCardLine">
          <span className="hoverCardIcon">{l.icon}</span>
          <span className="hoverCardText">{l.text}</span>
        </div>
      ))}
    </div>
  );
});

export default HoverCard;
