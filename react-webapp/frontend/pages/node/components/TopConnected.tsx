// ─────────────────────────────────────────────────────────────────────────────
// components/TopConnected.tsx
// Small panel showing top-3 most connected students (user↔user/company/club)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { TYPE_COLOR }           from "../constants/maps";
import { getNodeId }            from "../utils/getNodeId";

interface Props {
  nodes:        GraphNode[];
  links:        GraphLink[];
  onSelectNode: (id: string) => void;
}

export default function TopConnected({ nodes, links, onSelectNode }: Props) {
  const top3 = useMemo(() => {
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const degree: Record<string, number> = {};

    // Count only confirmed student↔student connections (style="direct")
    for (const l of links) {
      if (l.style !== "direct") continue;
      const sId   = getNodeId(l.source);
      const tId   = getNodeId(l.target);
      const sNode = nodeById.get(sId);
      const tNode = nodeById.get(tId);
      if (!sNode || !tNode || sNode.type !== "student" || tNode.type !== "student") continue;
      degree[sId] = (degree[sId] || 0) + 1;
      degree[tId] = (degree[tId] || 0) + 1;
    }

    return nodes
      .filter(n => n.type === "student")
      .map(n    => ({ ...n, connCount: degree[n.id] || 0 }))
      .sort((a, b)  => b.connCount - a.connCount)
      .slice(0, 3);
  }, [nodes, links]);

  if (top3.length === 0) return null;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="topConnected" onClick={e => e.stopPropagation()}>
      <div className="legendTitle">Top Connected</div>
      {top3.map((n, i) => (
        <div
          key={n.id}
          className="topConnectedItem"
          onClick={() => onSelectNode(n.id)}
          title={`${n.label} — ${n.connCount} connections`}
        >
          <span className="topConnectedMedal">{medals[i]}</span>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: TYPE_COLOR.student, flexShrink: 0,
          }} />
          <span className="topConnectedName">
            {n.label.length > 13 ? n.label.slice(0, 11) + "…" : n.label}
          </span>
          <span className="topConnectedCount">{n.connCount}</span>
        </div>
      ))}
    </div>
  );
}
