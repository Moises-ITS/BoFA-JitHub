// ─────────────────────────────────────────────────────────────────────────────
// components/SidePanel.tsx
// Shows details and connections for a selected node
// ─────────────────────────────────────────────────────────────────────────────

import { GraphNode, GraphLink } from "../types/graphNodes";
import { TYPE_COLOR, TYPE_EMOJI, TYPE_BADGE, DETAIL_ICONS } from "../constants/maps";
import { getNodeId } from "../utils/getNodeId";

interface SidePanelProps {
  node:         GraphNode | null; // null = panel closed
  nodes:        GraphNode[];
  links:        GraphLink[];
  onClose:      () => void;
  onSelectNode: (id: string) => void;
}

export default function SidePanel({ node, nodes, links, onClose, onSelectNode }: SidePanelProps) {
  // Early return — render nothing if no node is selected
  if (!node) return null;

  // Find all links where this node appears on either end
  const connLinks = links.filter(l =>
    getNodeId(l.source) === node.id || getNodeId(l.target) === node.id
  );

  // Build initials for the avatar circle
  const initials = node.label
    .split(" ")
    .map(w => w.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const badge    = TYPE_BADGE[node.type];
  const subtitle = node.details?.role || node.details?.major || "";

  return (
    <>
        <div className="panel">

      {/* Header */}
      <div className="panelHeader">
        <span className="panelHeaderLabel">Node Details</span>
        <button className="closeBtn" onClick={onClose}>✕</button>
      </div>

      {/* Avatar + Name */}
      <div className="avatarWrap">
        {/* background is dynamic — depends on node type so stays inline */}
        <div className="avatar" style={{ background: TYPE_COLOR[node.type] }}>
          {initials}
        </div>
        <div>
          <div className="panelName">{node.label}</div>
          <div className="panelRole">{subtitle}</div>
        </div>
      </div>

      {/* Type Badge — bg/color/border are all dynamic so stay inline */}
      <span
        className="badge"
        style={{
          background: badge.bg,
          color:      badge.color,
          border:     `1px solid ${badge.border}`,
        }}
      >
        {TYPE_EMOJI[node.type]} {node.type.charAt(0).toUpperCase() + node.type.slice(1)}
      </span>

      {/* Details */}
      <div className="section">
        <h4 className="sectionTitle">Details</h4>
        {Object.entries(node.details || {}).map(([k, v]) => (
          <div key={k} className="detailRow">
            <span className="detailIcon">{DETAIL_ICONS[k] || "•"}</span>
            <div>
              <div className="detailLabel">
                {k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              <div className="detailVal">{v}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Connections */}
      <div className="section">
        <h4 className="sectionTitle">Connections ({connLinks.length})</h4>
        {connLinks.map((l, i) => {
          const otherId = getNodeId(l.source) === node.id
            ? getNodeId(l.target)
            : getNodeId(l.source);
          const other = nodes.find(n => n.id === otherId);
          if (!other) return null;
          return (
            <div key={i} className="connItem" onClick={() => onSelectNode(other.id)}>
              {/* dot color is dynamic so stays inline */}
              <div className="connDot" style={{ background: TYPE_COLOR[other.type] }} />
              <div>
                <div>{other.label}</div>
                <div className="connRel">{l.rel}</div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
    </>
    
  );
}