// components/HoverCard.tsx
// Lightweight tooltip card that fades in on node hover in free mode

import { memo, useEffect, useRef } from "react";
import type { GraphNode } from "../types/graphNodes";
import { TYPE_COLOR, TYPE_EMOJI } from "../constants/maps";

interface HoverCardProps {
  node: GraphNode;
  x: number;
  y: number;
}

const HoverCard = memo(function HoverCard({ node, x, y }: HoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      
      const rx = Math.max(-25, Math.min(25, -(dy / 50) * 8));
      const ry = Math.max(-25, Math.min(25, (dx / 50) * 8));
      
      cardRef.current.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.05, 1.05, 1.05)`;
    };
    
    // We bind to window because the card moves around and might be pointer-events none
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);
  const { details, type, label } = node;

  // Offset from cursor; flip left if near the right edge.
  const CARD_W = 200;
  const rawLeft = x + 16;
  const safeLeft = rawLeft + CARD_W > window.innerWidth - 16 ? x - CARD_W - 16 : rawLeft;
  const safeTop = Math.max(8, y - 24);

  const lines: { icon: string; text: string }[] = [];

  if (type === "student") {
    if (details?.major) lines.push({ icon: "📚", text: String(details.major) });
    if (details?.year_grad) lines.push({ icon: "🎓", text: `Class of ${details.year_grad}` });
    if (details?.bio) {
      const bio = String(details.bio);
      lines.push({ icon: "💬", text: bio.length > 62 ? `${bio.slice(0, 60)}…` : bio });
    }
  } else if (type === "club") {
    if (details?.members) lines.push({ icon: "👥", text: `${details.members} members` });
    if (details?.goal) lines.push({ icon: "🎯", text: String(details.goal) });
  } else if (type === "company") {
    if (details?.role) lines.push({ icon: "💼", text: String(details.role) });
    if (details?.open_roles) lines.push({ icon: "🔍", text: `${details.open_roles} open roles` });
  } else if (type === "professor") {
    if (details?.focus) lines.push({ icon: "🔬", text: String(details.focus) });
    if (details?.research) lines.push({ icon: "📄", text: String(details.research) });
  } else if (type === "interest") {
    if (details?.focus) lines.push({ icon: "✦", text: String(details.focus) });
  }

  return (
    <div 
      className="hoverCard holographic" 
      ref={cardRef}
      style={{ left: safeLeft, top: safeTop, transition: 'transform 0.1s ease-out', willChange: 'transform', transformStyle: 'preserve-3d' }}
    >
      <div className="hoverCardHeader" style={{ transform: 'translateZ(15px)' }}>
        <span className="hoverCardEmoji" style={{ color: TYPE_COLOR[type] }}>
          {TYPE_EMOJI[type]}
        </span>
        <span className="hoverCardName">{label}</span>
      </div>
      {lines.map((line, index) => (
        <div key={index} className="hoverCardLine" style={{ transform: `translateZ(${10 + index*2}px)` }}>
          <span className="hoverCardIcon">{line.icon}</span>
          <span className="hoverCardText">{line.text}</span>
        </div>
      ))}
    </div>
  );
});

export default HoverCard;
