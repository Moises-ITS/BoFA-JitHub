/// <reference types="vite/client" />
// 
// components/SidePanel.tsx
// Shows node details and connection status (view-only on own node)
// ─────────────────────────────────────────────────────────────────────────────
// Shows node details, Add Connection button, and Recommended Connections
// 

import { useState, useEffect } from "react";
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { TYPE_COLOR, TYPE_EMOJI, TYPE_BADGE, DETAIL_ICONS } from "../constants/maps";
import { getNodeId } from "../utils/getNodeId";
import { useAuth } from "../../../context/AuthContext";

import { API_BASE_URL as API } from "../../../lib/api";

type ConnStatus = "none" | "pending-sent" | "pending-received" | "connected";

const HIDDEN_DETAIL_KEYS = new Set([
  "color",
  "email",
  "id",
  "graph_node_id",
  "graphnodeid",
  "password",
  "password_hash",
  "passwordhash",
  "student_id",
  "studentid",
  "type",
  "label",
  "name",
  "bio",
  "interests",
  "linkedinUrl",
  "gpa",
]);

const normalizeDetailKey = (key: string) => key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const shouldHideDetail = (key: string) => (
  HIDDEN_DETAIL_KEYS.has(key) ||
  HIDDEN_DETAIL_KEYS.has(normalizeDetailKey(key))
);

interface SidePanelProps {
  node:         GraphNode | null;
  nodes:        GraphNode[];
  links:        GraphLink[];
  onClose:      () => void;
  onSelectNode: (id: string) => void;
  onConnectionChanged?: () => void | Promise<void>;
}

// Minimal recommendation type returned by the recommendations API
interface Recommendation {
  id: string;
  name: string;
  score: number;
  sameMajor?: boolean;
  major?: string;
  sharedInterests?: number;
  sharedClubs?: number;
}

export default function SidePanel({ node, nodes, links, onClose, onSelectNode, onConnectionChanged }: SidePanelProps) {
  const { user, token } = useAuth();
  const isOwnNode = node?.id === user?.id;

  // ── Connection status state ───────────────────────────────────────────────
  const [connStatus,    setConnStatus]    = useState<ConnStatus>("none");
  const [connLoading,   setConnLoading]   = useState(false);
  const [connExpanded,  setConnExpanded]  = useState(false);

  //  Recommendations (shown on own node) 
  const [recs, setRecs] = useState<Recommendation[]>([]);

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
  // Fetch recommendations when viewing own node
  useEffect(() => {
    if (!isOwnNode || !user) { setRecs([]); return; }
    fetch(`${API}/api/connections/recommendations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: Recommendation[]) => setRecs(data))
      .catch(() => setRecs([]));
  }, [isOwnNode, user]);

  //  Connection actions 
  const sendRequestTo = async (toUserId: string) => {
    if (!user) return;
    setConnLoading(true);
    try {
      const res = await fetch(`${API}/api/connections/request`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ toUserId }),
      });
      if (res.ok) {
        if (node?.id === toUserId) setConnStatus("pending-sent");
        setRecs((prev) => prev.filter((rec) => rec.id !== toUserId));
      }
    } catch { /* silent */ }
    setConnLoading(false);
  };

  const sendRequest = () => {
    if (!node) return;
    void sendRequestTo(node.id);
  };

  // ── Early return ──────────────────────────────────────────────────────────
  const acceptRequest = async () => {
    if (!node || !user) return;
    setConnLoading(true);
    try {
      const res = await fetch(`${API}/api/connections/accept`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ fromUserId: node.id }),
      });
      if (res.ok) {
        setConnStatus("connected");
        await onConnectionChanged?.();
      }
    } catch { /* silent */ }
    setConnLoading(false);
  };

  const rejectRequest = async () => {
    if (!node || !user) return;
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

  const removeConnection = async () => {
    if (!node || !user) return;
    setConnLoading(true);
    try {
      const res = await fetch(`${API}/api/connections/by-user/${node.id}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConnStatus("none");
        await onConnectionChanged?.();
      }
    } catch { /* silent */ }
    setConnLoading(false);
  };

  //  Early return 
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
        <button className="closeBtn" onClick={onClose}>x</button>
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
              LinkedIn {"->"}
            </a>
          )}
        </div>
      </div>

      {/* Type badge */}
      <span className="badge" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
        {TYPE_EMOJI[node.type]} {node.type.charAt(0).toUpperCase() + node.type.slice(1)}
      </span>

      {/*  Add Connection  */}
      {node.type === "student" && !isOwnNode && (
        <div className="connectSection">
          {connStatus === "none" && (
            <button className="connectBtn" onClick={sendRequest} disabled={connLoading}>
              {connLoading ? "Sending..." : "+ Add Connection"}
            </button>
          )}
          {connStatus === "pending-sent" && (
            <span className="connectChip connectChip--pending">Request Sent</span>
          )}
          {connStatus === "pending-received" && (
            <div className="connectIncoming">
              <span className="connectChip connectChip--incoming">Wants to connect with you</span>
              <div className="connectActions">
                <button className="connectBtn" onClick={acceptRequest} disabled={connLoading}>
                  {connLoading ? "Accepting..." : "Accept"}
                </button>
                <button className="connectBtn connectBtn--decline" onClick={rejectRequest} disabled={connLoading}>
                  Decline
                </button>
              </div>
            </div>
          )}
          {connStatus === "connected" && (
            <div className="connectIncoming">
              <span className="connectChip connectChip--connected">Connected</span>
              <div className="connectActions">
                <button className="connectBtn connectBtn--decline" onClick={removeConnection} disabled={connLoading}>
                  {connLoading ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
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
          .filter(([k]) => !shouldHideDetail(k))
          .map(([k, v]) => (
            <div key={k} className="detailRow">
              <span className="detailIcon">{DETAIL_ICONS[k] || "-"}</span>
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

      {/*  Recommended Connections (own profile only)  */}
      {isOwnNode && recs.length > 0 && (
        <div className="section recSection">
          <h4 className="sectionTitle">Recommended for You</h4>
          {recs.map(rec => {
            const reasons: string[] = [];
            if (rec.sameMajor) reasons.push(`Same major (${rec.major})`);
            if ((rec.sharedInterests ?? 0) > 0) reasons.push(`${rec.sharedInterests} shared interest${(rec.sharedInterests ?? 0) > 1 ? "s" : ""}`);
            if ((rec.sharedClubs ?? 0) > 0) reasons.push(`${rec.sharedClubs} shared club${(rec.sharedClubs ?? 0) > 1 ? "s" : ""}`);
            return (
              <div key={rec.id} className="recItem" onClick={() => onSelectNode(rec.id)}>
                  <div className="recAvatar" style={{ background: TYPE_COLOR.student }}>
                  {rec.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="recInfo">
                  <div className="recRowTop">
                    <div className="recName">{rec.name}</div>
                    <span className="recScore">Match {Math.min(99, Math.round(rec.score * 11 + 38))}%</span>
                  </div>
                  <div className="recReason">{reasons.join(" | ")}</div>
                  <div className="recActions">
                    <button
                      type="button"
                      className="recBtn recBtn--ghost"
                      onClick={(e) => { e.stopPropagation(); onSelectNode(rec.id); }}
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      className="recBtn recBtn--accent"
                      onClick={(e) => { e.stopPropagation(); void sendRequestTo(rec.id); }}
                      disabled={connLoading}
                    >
                      Connect
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
