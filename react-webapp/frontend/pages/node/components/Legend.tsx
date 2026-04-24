// ─────────────────────────────────────────────────────────────────────────────
// components/Legend.tsx
// Bottom-left legend showing node type colors
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from "react";
import type { NodeType } from "../types/graphNodes";
import { TYPE_COLOR } from "../constants/maps";

interface LegendProps {
  onHoverType?: (type: NodeType | null) => void;
}

const Legend = memo(function Legend({ onHoverType }: LegendProps) {
  return (
    <div className="legend">
      <div className="legendTitle">Node Types</div>
      {(["student", "company", "club", "interest", "professor"] as NodeType[]).map(type => (
        <div 
          key={type} 
          className="legendItem legendItem--interactive"
          onMouseEnter={() => onHoverType?.(type)}
          onMouseLeave={() => onHoverType?.(null)}
        >
          <div style={{
            width:        12,
            height:       12,
            flexShrink:   0,
            borderRadius: type === "company" ? 3 : "50%",
            background:   TYPE_COLOR[type],
            boxShadow:    `0 0 8px ${TYPE_COLOR[type]}44`
          }} />
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </div>
      ))}
    </div>
  );
});

export default Legend;