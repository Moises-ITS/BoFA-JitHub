/// <reference types="vite/client" />
// ─────────────────────────────────────────────────────────────────────────────
// components/SidePanel.tsx
// Shows node details, Add Connection button, and Recommended Connections
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { TYPE_COLOR, TYPE_EMOJI, TYPE_BADGE, DETAIL_ICONS } from "../constants/maps";
import { getNodeId } from "../utils/getNodeId";
import { useAuth } from "../../../context/AuthContext";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

interface Recommendation {
  id:              string;
  name:            string;
  major:           string;
  sharedClubs:     number;
  sharedInterests: number;
  sameMajor:       boolean;
  score:           number;
}

type ConnStatus = "none" | "pending-sent" | "pending-received" | "connected";

interface SidePanelProps {
  node:         GraphNode | null;
  nodes:        GraphNode[];
  links:        GraphLink[];
  onClose:      () => void;
  onSelectNode: (id: string) => void;
}

export default function SidePanel({ node, nodes, links, onClose, onSelectNode }: SidePanelProps) {
  const { user, token } = useAuth();
  const isOwnNode = node?.id === user?.id;

  // ── Connection status state ───────────────────────────────────────────────
  const [connStatus,  setConnStatus]  = useState<ConnStatus>("none");
  const [connLoading, setConnLoading] = useState(false);

  // ── Recommendations (shown on own node) ───────────────────────────────────
  const [recs, setRecs] = useState<Recommendation[]>([]);

  // Fetch connection status whenever the selected node changes
  useEffect(() => {
    if (!node || !token || node.type !== "student" || isOwnNode) {
      setConnStatus("none");
      return;
    }
    fetch(`${API}/api/connections/status?userId=${node.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { status: "none" })
      .then(data => {
        if (data.status === "accepted") setConnStatus("connected");
        else if (data.status === "pending" && data.direction === "sent")     setConnStatus("pending-sent");
        else if (data.status === "pending" && data.direction === "received") setConnStatus("pending-received");
        else setConnStatus("none");
      })
      .catch(() => setConnStatus("none"));
  }, [node?.id, token, isOwnNode]); // eslint-disable-line

  // Fetch recommendations when viewing own node
  useEffect(() => {
    if (!isOwnNode || !token) { setRecs([]); return; }
    fetch(`${API}/api/connections/recommendations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: Recommendation[]) => setRecs(data))
      .catch(() => setRecs([]));
  }, [isOwnNode, token]);

  // ── Connection actions ────────────────────────────────────────────────────
  const sendRequest = async () => {
    if (!node || !token) return;
    setConnLoading(true);
    try {
      const res = await fetch(`${API}/api/connections/request`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ toUserId: node.id }),
      });
      if (res.ok) setConnStatus("pending-sent");
    } catch { /* silent */ }
    setConnLoading(false);
  };

  const acceptRequest = async () => {
    if (!node || !token) return;
    setConnLoading(true);
    try {
      const res = await fetch(`${API}/api/connections/accept`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ fromUserId: node.id }),
      });
      if (res.ok) setConnStatus("connected");
    } catch { /* silent */ }
    setConnLoading(false);
  };

  const rejectRequest = async () => {
    if (!node || !token) return;
    setConnLoading(true);
    try {
      await fetch(`${API}/api/connections/reject`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ fromUserId: node.id }),
      });
      setConnStatus("none");
    } catch { /* silent */ }
    setConnLoading(false);
  };

  // ── Early return ──────────────────────────────────────────────────────────
  if (!node) return null;

  const connLinks = links.filter(l =>
    getNodeId(l.source) === node.id || getNodeId(l.target) === node.id
  );

  const initials = node.label
    .split(" ").map(w => w.replace(/[^A-Za-z]/g, "")).filter(Boolean)
    .map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const badge    = TYPE_BADGE[node.type];
  const subtitle = node.details?.role || node.details?.major || "";

  return (
    <div className="panel">

      {/* Header */}
      <div className="panelHeader">
        <span className="panelHeaderLabel">Node Details</span>
        <button className="closeBtn" onClick={onClose}>✕</button>
      </div>

      {/* Avatar + Name */}
      <div className="avatarWrap">
        <div className="avatar" style={{ background: TYPE_COLOR[node.type] }}>{initials}</div>
        <div>
          <div className="panelName">{node.label}</div>
          <div className="panelRole">{subtitle}</div>
          {node.type === "student" && node.details?.bio && (
            <div className="panelBio">{node.details.bio as string}</div>
          )}
          {node.details?.linkedinUrl && (
            <a href={node.details.linkedinUrl as string} target="_blank" rel="noopener noreferrer" className="panelLinkedin">
              LinkedIn ↗
            </a>
          )}
        </div>
      </div>

      {/* Type badge */}
      <span className="badge" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
        {TYPE_EMOJI[node.type]} {node.type.charAt(0).toUpperCase() + node.type.slice(1)}
      </span>

      {/* ── Add Connection ─────────────────────────────────────────────────── */}
      {node.type === "student" && !isOwnNode && (
        <div className="connectSection">
          {connStatus === "none" && (
            <button className="connectBtn" onClick={sendRequest} disabled={connLoading}>
              {connLoading ? "Sending…" : "+ Add Connection"}
            </button>
          )}
          {connStatus === "pending-sent" && (
            <span className="connectChip connectChip--pending">Request Sent</span>
          )}
          {connStatus === "pending-received" && (
            <div className="connectIncoming">
              <span className="connectChip connectChip--incoming">Wants to connect</span>
              <div className="connectActions">
                <button className="connectBtn connectBtn--accept"   onClick={acceptRequest} disabled={connLoading}>Accept</button>
                <button className="connectBtn connectBtn--decline"  onClick={rejectRequest} disabled={connLoading}>Decline</button>
              </div>
            </div>
          )}
          {connStatus === "connected" && (
            <span className="connectChip connectChip--connected">✓ Connected</span>
          )}
        </div>
      )}

      {/* Details */}
      <div className="section">
        <h4 className="sectionTitle">Details</h4>
        {Object.entries(node.details || {})
          .filter(([k]) => !["id","graph_node_id","type","label","name","bio","interests","linkedinUrl"].includes(k))
          .map(([k, v]) => (
            <div key={k} className="detailRow">
              <span className="detailIcon">{DETAIL_ICONS[k] || "•"}</span>
              <div>
                <div className="detailLabel">{k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                <div className="detailVal">{v as string}</div>
              </div>
            </div>
          ))}
      </div>

      {/* Connections */}
      <div className="section">
        <h4 className="sectionTitle">Connections ({connLinks.length})</h4>
        {connLinks.map((l, i) => {
          const otherId = getNodeId(l.source) === node.id ? getNodeId(l.target) : getNodeId(l.source);
          const other   = nodes.find(n => n.id === otherId);
          if (!other) return null;
          return (
            <div key={i} className="connItem" onClick={() => onSelectNode(other.id)}>
              <div className="connDot" style={{ background: TYPE_COLOR[other.type] }} />
              <div>
                <div>{other.label}</div>
                <div className="connRel">{l.rel.replace(/_/g, " ")}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Recommended Connections (own profile only) ─────────────────────── */}
      {isOwnNode && recs.length > 0 && (
        <div className="section">
          <h4 className="sectionTitle">Recommended for You</h4>
          {recs.map(rec => {
            const reasons: string[] = [];
            if (rec.sameMajor)          reasons.push(`Same major (${rec.major})`);
            if (rec.sharedInterests > 0) reasons.push(`${rec.sharedInterests} shared interest${rec.sharedInterests > 1 ? "s" : ""}`);
            if (rec.sharedClubs > 0)     reasons.push(`${rec.sharedClubs} shared club${rec.sharedClubs > 1 ? "s" : ""}`);
            return (
              <div key={rec.id} className="recItem" onClick={() => onSelectNode(rec.id)}>
                <div className="recAvatar" style={{ background: TYPE_COLOR.student }}>
                  {rec.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="recInfo">
                  <div className="recName">{rec.name}</div>
                  <div className="recReason">{reasons.join(" · ")}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
