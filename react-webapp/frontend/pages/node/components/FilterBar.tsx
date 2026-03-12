// ─────────────────────────────────────────────────────────────────────────────
// components/FilterBar.tsx
// The row of toggle buttons that show/hide node types
// ─────────────────────────────────────────────────────────────────────────────

import { NodeType } from "../types/graphNodes";
import { TYPE_COLOR } from "../constants/maps";

interface FilterBarProps {
  hiddenTypes:  Set<NodeType>;      // which types are currently hidden
  onToggleType: (type: NodeType) => void; // called when a button is clicked
}

export default function FilterBar({ hiddenTypes, onToggleType }: FilterBarProps) {
  return (
    <div className="filterGroup">
      <label className="filterLabel">Show:</label>
      {(["student", "professor", "company", "club"] as NodeType[]).map(type => {
        const active = !hiddenTypes.has(type); // true = visible, false = hidden
        const color  = TYPE_COLOR[type];
        return (
          <button
            key={type}
            className="toggle"
            onClick={() => onToggleType(type)}
            // these values are dynamic (change per type + active state) so stay inline
            style={{
              borderColor: active ? color    : "#252d40",
              color:       active ? color    : "#718096",
              background:  active ? `${color}1e` : "#1a1e2d",
              opacity:     active ? 1 : 0.4,
            }}
          >
            {/* dot color is dynamic so stays inline */}
            <span style={{
              width: 9, height: 9, borderRadius: "50%",
              background: color, display: "inline-block", flexShrink: 0,
            }} />
            {type.charAt(0).toUpperCase() + type.slice(1)}s
          </button>
        );
      })}
    </div>
  );
}