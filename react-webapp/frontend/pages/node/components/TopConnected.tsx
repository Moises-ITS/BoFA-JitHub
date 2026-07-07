// ─────────────────────────────────────────────────────────────────────────────
// components/TopConnected.tsx
// Always-visible inline top-3 leaderboard preview + animated full modal
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { TYPE_COLOR }    from "../constants/maps";
import { getNodeId }     from "../utils/getNodeId";

interface Props {
  nodes:         GraphNode[];
  links:         GraphLink[];
  currentUserId: string;
  onSelectNode:  (id: string) => void;
}

interface RankedStudent {
  node:      GraphNode;
  connCount: number;
  rank:      number;
}

function getRankStyle(rank: number): { border: string; bg: string; badge: string; color: string } {
  if (rank === 1) return { border: "#FFD700", bg: "rgba(255,215,0,0.06)",  badge: "👑", color: "#FFD700" };
  if (rank === 2) return { border: "#C0C0C0", bg: "rgba(192,192,192,0.04)", badge: "🥈", color: "#C0C0C0" };
  if (rank === 3) return { border: "#CD7F32", bg: "rgba(205,127,50,0.05)", badge: "🥉", color: "#CD7F32" };
  if (rank <= 5)  return { border: "#7C3AED", bg: "rgba(124,58,237,0.04)", badge: `#${rank}`, color: "#a78bfa" };
  return             { border: "#2d3748",  bg: "transparent",              badge: `#${rank}`, color: "#718096" };
}

export default function TopConnected({ nodes, links, currentUserId, onSelectNode }: Props) {
  const [open, setOpen] = useState(false);

  const ranked = useMemo<RankedStudent[]>(() => {
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const neighborsByStudent = new Map<string, Set<string>>();

    for (const l of links) {
      if (l.style !== "direct") continue;
      const sId   = getNodeId(l.source);
      const tId   = getNodeId(l.target);
      const sNode = nodeById.get(sId);
      const tNode = nodeById.get(tId);
      if (!sNode || !tNode || sNode.type !== "student" || tNode.type !== "student") continue;
      if (!neighborsByStudent.has(sId)) neighborsByStudent.set(sId, new Set());
      if (!neighborsByStudent.has(tId)) neighborsByStudent.set(tId, new Set());
      neighborsByStudent.get(sId)!.add(tId);
      neighborsByStudent.get(tId)!.add(sId);
    }

    // Fallback for datasets that haven't materialized CONNECTED_TO links yet:
    // rank students by unique graph neighbors across the whole campus network.
    if (neighborsByStudent.size === 0) {
      for (const l of links) {
        const sId = getNodeId(l.source);
        const tId = getNodeId(l.target);
        const sNode = nodeById.get(sId);
        const tNode = nodeById.get(tId);

        if (sNode?.type === "student") {
          if (!neighborsByStudent.has(sId)) neighborsByStudent.set(sId, new Set());
          neighborsByStudent.get(sId)!.add(tId);
        }

        if (tNode?.type === "student") {
          if (!neighborsByStudent.has(tId)) neighborsByStudent.set(tId, new Set());
          neighborsByStudent.get(tId)!.add(sId);
        }
      }
    }

    return nodes
      .filter(n => n.type === "student")
      .map(n => ({ node: n, connCount: neighborsByStudent.get(n.id)?.size || 0 }))
      .sort((a, b) => b.connCount - a.connCount)
      .map((item, i) => ({ ...item, rank: i + 1 }));
  }, [nodes, links]);

  const top10    = ranked.slice(0, 10);
  const top3     = ranked.slice(0, 3);
  const userRank = ranked.find(r => r.node.id === currentUserId);
  const nextUp   = userRank && userRank.rank > 1 ? ranked[userRank.rank - 2] : null;
  const gap      = userRank && nextUp ? nextUp.connCount - userRank.connCount + 1 : 0;

  if (top3.length === 0) return null;

  return (
    <>
      {/* Inline top-3 preview card */}
      <div className="tcPreview">
        <div className="tcPreviewHeader">
          <span className="tcPreviewTitle" style={{ cursor: "pointer" }} onClick={() => setOpen(true)}>
            🏆 Leaderboard
          </span>
          <button className="tcSeeAllBtn" onClick={() => setOpen(true)}>See all →</button>
        </div>
        {top3.map(({ node, connCount, rank }) => {
          const style = getRankStyle(rank);
          const firstName = node.label.split(" ")[0];
          return (
            <div
              key={`${node.id}-${rank}`}
              className="tcRow"
              onClick={() => onSelectNode(node.id)}
            >
              <span className="tcRowBadge">{style.badge}</span>
              <span className="tcRowName">{firstName}</span>
              <span className="tcRowCount" style={{ color: style.color }}>{connCount}</span>
            </div>
          );
        })}
      </div>

      {/* Full modal */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="tc-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.55)",
                zIndex: 9998, backdropFilter: "blur(2px)",
              }}
            />

            {/* Centering wrapper — flex handles position; FM handles scale/fade only */}
            <div style={{
              position: "fixed", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 9999, pointerEvents: "none",
            }}>
            <motion.div
              key="tc-modal"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{
                pointerEvents: "all",
                width:         "min(400px, calc(100vw - 48px))",
                maxHeight:     "min(80vh, calc(100vh - 48px))",
                background:    "#111827",
                border:        "1px solid rgba(255,255,255,0.1)",
                borderRadius:  18,
                boxShadow:     "0 28px 72px rgba(0,0,0,0.85)",
                overflow:      "hidden",
                display:       "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div style={{
                padding:        "16px 20px 14px",
                borderBottom:   "1px solid rgba(255,255,255,0.08)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                flexShrink:     0,
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "#F0F0F0" }}>
                    🏆 Campus Leaderboard
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#6B7280", marginTop: 2 }}>
                    Top 10 most connected students
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: "none", border: "none", color: "#6B7280", fontSize: "1.1rem", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}
                >
                  ✕
                </button>
              </div>

              {/* List */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                {top10.map(({ node, connCount, rank }) => {
                  const style    = getRankStyle(rank);
                  const isMe     = node.id === currentUserId;
                  const initials = node.label.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <motion.div
                      key={`${node.id}-${rank}`}
                      whileHover={{ background: "rgba(255,255,255,0.04)" }}
                      onClick={() => { setOpen(false); onSelectNode(node.id); }}
                      style={{
                        display:      "flex",
                        alignItems:   "center",
                        gap:          12,
                        padding:      "10px 20px",
                        cursor:       "pointer",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background:   isMe ? "rgba(124,58,237,0.07)" : style.bg,
                        borderLeft:   isMe ? "3px solid #7C3AED" : "3px solid transparent",
                        transition:   "background 0.15s",
                      }}
                    >
                      {/* Rank badge */}
                      <div style={{
                        width:      30, height: 30, borderRadius: 8,
                        border:     `1.5px solid ${style.border}`,
                        display:    "flex", alignItems: "center", justifyContent: "center",
                        fontSize:   rank <= 3 ? "0.9rem" : "0.7rem",
                        fontWeight: 700, color: style.color, flexShrink: 0,
                        transform:  rank === 1 ? "scale(1.1)" : "scale(1)",
                      }}>
                        {style.badge}
                      </div>

                      {/* Avatar */}
                      <div style={{
                        width:     32, height: 32, borderRadius: "50%",
                        background: `linear-gradient(135deg, ${TYPE_COLOR.student}, #7C3AED)`,
                        display:   "flex", alignItems: "center", justifyContent: "center",
                        fontSize:  "0.75rem", fontWeight: 700, color: "#fff", flexShrink: 0,
                        boxShadow: rank <= 3 ? `0 0 10px ${style.border}55` : "none",
                      }}>
                        {initials}
                      </div>

                      {/* Name + major */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize:   "0.875rem",
                          fontWeight: isMe ? 700 : 500,
                          color:      isMe ? "#c4b5fd" : "#E2E8F0",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {node.label}{isMe ? " (you)" : ""}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#718096" }}>
                          {(node.details?.major as string) || ""}
                        </div>
                      </div>

                      {/* Connection count */}
                      <div style={{
                        fontSize:     "0.78rem",
                        fontWeight:   700,
                        color:        style.color,
                        flexShrink:   0,
                        background:   rank <= 3 ? `${style.border}18` : "transparent",
                        padding:      rank <= 3 ? "2px 8px" : "0",
                        borderRadius: 20,
                      }}>
                        {connCount}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer — user rank + CTA */}
              <div style={{
                padding:   "14px 20px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                flexShrink: 0,
              }}>
                {userRank ? (
                  <div style={{ fontSize: "0.8rem", color: "#9CA3AF", lineHeight: 1.6 }}>
                    {userRank.rank <= 10
                      ? <>You're ranked <span style={{ color: "#c4b5fd", fontWeight: 700 }}>#{userRank.rank}</span> with <span style={{ color: "#c4b5fd", fontWeight: 700 }}>{userRank.connCount}</span> connections.</>
                      : <>You're ranked <span style={{ color: "#9CA3AF", fontWeight: 700 }}>#{userRank.rank}</span> · {userRank.connCount} connections.</>
                    }
                    {gap > 0 && nextUp && (
                      <> Connect <span style={{ color: "#E74C3C", fontWeight: 700 }}>{gap} more</span> to pass {nextUp.node.label.split(" ")[0]}.</>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                    Connect with classmates to join the leaderboard.
                  </div>
                )}
                <div style={{ marginTop: 4, fontSize: "0.7rem", color: "#4B5563" }}>
                  Tap any student to explore their profile →
                </div>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
