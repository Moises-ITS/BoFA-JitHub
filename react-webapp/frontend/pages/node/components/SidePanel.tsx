/// <reference types="vite/client" />
// ─────────────────────────────────────────────────────────────────────────────
// components/SidePanel.tsx
// Shows node details and connection status (view-only on own node)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { TYPE_COLOR, TYPE_EMOJI, TYPE_BADGE, DETAIL_ICONS } from "../constants/maps";
import { getNodeId } from "../utils/getNodeId";
import { useAuth } from "../../../context/AuthContext";

const API = import.meta.env.VITE_API_URL ?? "";

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
  const [connStatus,    setConnStatus]    = useState<ConnStatus>("none");
  const [connLoading,   setConnLoading]   = useState(false);
  const [connExpanded,  setConnExpanded]  = useState(false);

  // Fetch connection status whenever the selected node changes
  useEffect(() => {
    if (!node || !user || node.type !== "student" || isOwnNode) {
      setConnStatus("none");
      return;
    }
    fetch(`${API}/api/connections/status?userId=${node.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { status: "none" })
      .then(data => {
        if (data.status === "accepted") setConnStatus("connected");
        else if (data.status === "pending" && data.direction === "sent")     setConnStatus("pending-sent");
        else if (data.status === "pending" && data.direction === "received") setConnStatus("pending-received");
        else setConnStatus("none");
      })
      .catch(() => setConnStatus("none"));
  }, [node?.id, user, isOwnNode]); // eslint-disable-line

  // ── Connection actions ────────────────────────────────────────────────────
  const sendRequest = async () => {
    if (!node || !user) return;
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
            <span className="connectChip connectChip--incoming">Wants to connect with you</span>
          )}
          {connStatus === "connected" && (
            <span className="connectChip connectChip--connected">✓ Connected</span>
          )}
          {node.details?.linkedinUrl && (
            <a href={node.details.linkedinUrl as string} target="_blank" rel="noopener noreferrer" className="panelLinkedin">
              LinkedIn ↗
            </a>
          )}
        </div>
      )}

      {/* LinkedIn for own node or non-student nodes */}
      {(isOwnNode || node.type !== "student") && node.details?.linkedinUrl && (
        <a href={node.details.linkedinUrl as string} target="_blank" rel="noopener noreferrer" className="panelLinkedin" style={{ margin: "6px 16px 0" }}>
          LinkedIn ↗
        </a>
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
        {(connExpanded ? connLinks : connLinks.slice(0, 5)).map((l, i) => {
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
        {connLinks.length > 5 && (
          <button
            className="connExpandBtn"
            onClick={() => setConnExpanded(e => !e)}
          >
            {connExpanded ? "← Show less" : `Show ${connLinks.length - 5} more →`}
          </button>
        )}
      </div>

    </div>
  );
}
