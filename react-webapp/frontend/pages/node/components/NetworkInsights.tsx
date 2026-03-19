// ─────────────────────────────────────────────────────────────────────────────
// components/NetworkInsights.tsx
// Right-edge arrow-popout with a single "People You Should Meet" suggestion.
// After accepting or rejecting, a new suggestion appears only after 24 hours.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { TYPE_COLOR } from "../constants/maps";
import { getNodeId } from "../utils/getNodeId";

const LS_KEY      = "jithub_insights_action";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredAction { time: number; userId: string; }

interface Props {
  nodes:           GraphNode[];
  links:           GraphLink[];
  currentUserId:   string | undefined;
  selectedNode:    GraphNode | null;
  onSelectNode:    (id: string) => void;
  onDiscoverNodes: (ids: string[]) => void;
}

interface Rec {
  node:            GraphNode;
  sharedClubs:     string[];
  sharedInterests: string[];
  sameMajor:       boolean;
  networkReach:    number;
}

function readAction(): StoredAction | null {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "null") as StoredAction | null; }
  catch { return null; }
}

export default function NetworkInsights({
  nodes, links, currentUserId, selectedNode, onSelectNode, onDiscoverNodes,
}: Props) {
  const [isOpen,     setIsOpen]     = useState(false);
  const [lastAction, setLastAction] = useState<StoredAction | null>(readAction);

  const withinCooldown = lastAction !== null && Date.now() - lastAction.time < COOLDOWN_MS;

  const rec = useMemo((): Rec | null => {
    if (!currentUserId || withinCooldown) return null;

    const nodeById = new Map(nodes.map(n => [n.id, n]));

    const adj = new Map<string, Set<string>>();
    for (const l of links) {
      const s = getNodeId(l.source), t = getNodeId(l.target);
      if (!adj.has(s)) adj.set(s, new Set());
      if (!adj.has(t)) adj.set(t, new Set());
      adj.get(s)!.add(t);
      adj.get(t)!.add(s);
    }

    const myConns     = adj.get(currentUserId) ?? new Set<string>();
    const myClubs     = new Set([...myConns].filter(id => nodeById.get(id)?.type === "club"));
    const myInterests = new Set([...myConns].filter(id => nodeById.get(id)?.type === "interest"));
    const myMajor     = nodeById.get(currentUserId)?.details?.major as string | undefined;

    // Only direct student↔student connections count as "already connected"
    const myDirectStudents = new Set<string>();
    for (const l of links) {
      if (l.style !== "direct") continue;
      const s = getNodeId(l.source), t = getNodeId(l.target);
      if (s === currentUserId) myDirectStudents.add(t);
      if (t === currentUserId) myDirectStudents.add(s);
    }

    let best: (Rec & { score: number }) | null = null;

    for (const candidate of nodes) {
      if (
        candidate.type !== "student" ||
        candidate.id === currentUserId ||
        myDirectStudents.has(candidate.id) ||
        candidate.id === lastAction?.userId   // skip the last acted-on user
      ) continue;

      const cc             = adj.get(candidate.id) ?? new Set<string>();
      const sharedClubs    = [...cc].filter(id => myClubs.has(id))    .map(id => nodeById.get(id)?.label ?? "");
      const sharedInterests = [...cc].filter(id => myInterests.has(id)).map(id => nodeById.get(id)?.label ?? "");
      const sameMajor      = !!(myMajor && candidate.details?.major &&
        String(candidate.details.major).toLowerCase() === myMajor.toLowerCase());
      const reach = [...cc].filter(id => {
        const n = nodeById.get(id);
        return n?.type === "student" && !myDirectStudents.has(id) && id !== currentUserId;
      }).length;

      const score =
        sharedClubs.length     * 3 +
        sharedInterests.length * 2 +
        (sameMajor ? 2 : 0)       +
        Math.min(reach, 14)   * 0.35;

      if (score > 0 && (!best || score > best.score)) {
        best = { node: candidate, sharedClubs, sharedInterests, sameMajor, networkReach: reach, score };
      }
    }

    return best;
  }, [nodes, links, currentUserId, withinCooldown, lastAction?.userId]); // eslint-disable-line

  // Hide when: no user, no recommendation, or a node is selected (SidePanel takes over)
  if (!currentUserId || !rec || selectedNode) return null;

  const saveAction = (userId: string) => {
    const action: StoredAction = { time: Date.now(), userId };
    localStorage.setItem(LS_KEY, JSON.stringify(action));
    setLastAction(action);
    setIsOpen(false);
  };

  const handleAccept = () => {
    saveAction(rec.node.id);
    onDiscoverNodes([rec.node.id]); // brief pulse on the node
    onSelectNode(rec.node.id);      // open their profile
  };

  const handleReject = () => saveAction(rec.node.id);

  const initials = rec.node.label.split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 2).toUpperCase();

  const reasons: string[] = [];
  if (rec.sameMajor)              reasons.push("Same major");
  if (rec.sharedInterests.length) reasons.push(`${rec.sharedInterests.length} shared interest${rec.sharedInterests.length > 1 ? "s" : ""}`);
  if (rec.sharedClubs.length)     reasons.push(`${rec.sharedClubs.length} shared club${rec.sharedClubs.length > 1 ? "s" : ""}`);
  if (rec.networkReach > 0)       reasons.push(`Connects you to ${rec.networkReach} new student${rec.networkReach > 1 ? "s" : ""}`);

  return (
    <>
      {/* Slide-out recommendation card */}
      <div
        className={`insightCard${isOpen ? " open" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="insightCardHeader">
          <span className="insightCardLabel">Suggested connection</span>
          <button className="insightCardClose" onClick={() => setIsOpen(false)} title="Collapse">✕</button>
        </div>

        <div className="insightCardPerson">
          <div className="insightCardAvatar" style={{ background: TYPE_COLOR.student }}>
            {initials}
          </div>
          <div className="insightCardPersonInfo">
            <div className="insightCardName">{rec.node.label}</div>
            {rec.node.details?.major && (
              <div className="insightCardMajor">{String(rec.node.details.major)}</div>
            )}
          </div>
        </div>

        {reasons.length > 0 && (
          <div className="insightCardReasons">
            <div className="insightCardReasonLabel">You should connect because:</div>
            <ul className="insightCardReasonList">
              {reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        <div className="insightCardActions">
          <button className="insightCardSkip"    onClick={handleReject}>Skip</button>
          <button className="insightCardConnect" onClick={handleAccept}>View Profile →</button>
        </div>
      </div>

      {/* Tab trigger on the right edge */}
      <button
        className={`insightTab${isOpen ? " open" : ""}`}
        onClick={e => { e.stopPropagation(); setIsOpen(v => !v); }}
        title="Network Insights"
      >
        <span className="insightTabIcon">✦</span>
        <span className="insightTabArrow">{isOpen ? "›" : "‹"}</span>
      </button>
    </>
  );
}
