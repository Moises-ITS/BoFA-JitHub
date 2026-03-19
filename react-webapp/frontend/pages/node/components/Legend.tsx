// ─────────────────────────────────────────────────────────────────────────────
// components/Legend.tsx
// Bottom-left legend showing node type colors
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from "react";
import type { NodeType } from "../types/graphNodes";
import { TYPE_COLOR } from "../constants/maps";

const Legend = memo(function Legend() {
  return (
    <div className="legend">
      <div className="legendTitle">Node Types</div>
      {(["student", "company", "club", "interest"] as NodeType[]).map(type => (
        <div key={type} className="legendItem">
          {/* color and shape (circle vs square for company) are dynamic — stay inline */}
          <div style={{
            width:        10,
            height:       10,
            flexShrink:   0,
            borderRadius: type === "company" ? 2 : "50%",
            background:   TYPE_COLOR[type],
          }} />
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </div>
      ))}
    </div>
  );
});

export default Legend;