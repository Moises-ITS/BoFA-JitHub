/// <reference types="vite/client" />
// ─────────────────────────────────────────────────────────────────────────────
// CampusGraph.tsx  —  Locked / Free / Path mode graph explorer
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import * as d3 from "d3";

import type { GraphNode, GraphLink, NodeType } from "./types/graphNodes";
import { TYPE_COLOR } from "./constants/maps";
import { getNodeId } from "./utils/getNodeId";
import { useGraphData } from "./hooks/useGraphData";
import SidePanel from "./components/SidePanel";
import FilterBar from "./components/FilterBar";
import SearchBar from "./components/SearchBar";
import Legend from "./components/Legend";
import TopConnected from "./components/TopConnected";
import HoverCard from "./components/HoverCard";
import Graph3DGlobeView from "./components/Graph3DGlobeView";
import { useAuth } from "../../context/AuthContext";
import { NetworkIntro } from "../../components/NetworkTransition";
import "./CampusGraph.css";

const API = import.meta.env.VITE_API_URL ?? "";
const MAX_NEIGHBORS = 9;
const HUB_MAX = 6;
const EDGE_WIDTH_MIN = 1.1;
const EDGE_WIDTH_MAX = 3.9;
const LABEL_OPACITY_BASE = 0.62;
const LABEL_FADE_MS = 180;
const NODE_FLICKER_BASE = 0.84;
const NODE_FLICKER_SWING = 0.08;
const NODE_FLICKER_HIGHLIGHT_BONUS = 0.03;
const FIT_PADDING = 96;
const FIT_MIN_SCALE = 0.42;
const FIT_MAX_SCALE = 2.35;
const DEMO_TOTAL_STEPS = 4;
const AMBIENT_ORBIT_SPEED = 0.00045;
const HUB_BUNDLE_DEGREE = 5;
const MINIMAP_W = 190;
const MINIMAP_H = 130;
const FLOW_BURST_MIN = 3;
const FLOW_BURST_MAX = 8;
const FLOW_BURST_INTERVAL_MIN_MS = 1700;
const FLOW_BURST_INTERVAL_MAX_MS = 2800;
const FLOW_ACTIVE_MAX = 46;
const OVERLAY_SAFE_MARGIN = 12;
const LOCKED_VIEWPORT_COVERAGE = 0.66;
const LOCKED_FIT_MIN_SCALE = 0.18;

type GraphMode = "free" | "locked" | "path";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const edgeStrength = (l: GraphLink) => clamp01(((l.weight ?? 0.5) * 0.74) + ((l.opacity ?? 0.65) * 0.26));
const edgeTierFromStrength = (s: number) => s >= 0.78 ? 1 : s >= 0.48 ? 2 : 3;
const edgeWidthFromStrength = (s: number) => EDGE_WIDTH_MIN + easeInOut(s) * (EDGE_WIDTH_MAX - EDGE_WIDTH_MIN);
const edgeOpacityFromStrength = (s: number) => 0.04 + easeInOut(s) * 0.26;
const edgePairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const edgeDashForLink = (l: GraphLink) => (l.style === "dashed" || l.rel === "INTERESTED_IN" ? "5,4" : null);
const edgeStrokeColorForLink = (l: GraphLink) => {
  if (l.rel === "CONNECTED_TO") return "#8b5cf6";
  if (l.rel === "WORKS_AT") return "#93c5fd";
  if (l.rel === "MEMBER_OF" || l.rel === "SAME_MAJOR") return "#58789b";
  if (l.rel === "INTERESTED_IN") return "#4a647e";
  return null;
};
const edgeWidthForLink = (l: GraphLink) => {
  const base = edgeWidthFromStrength(edgeStrength(l));
  if (l.rel === "CONNECTED_TO" || l.rel === "WORKS_AT") return base + 0.7;
  if (l.rel === "MEMBER_OF" || l.rel === "SAME_MAJOR") return Math.max(0.85, base * 0.82);
  if (l.rel === "INTERESTED_IN") return Math.max(0.75, base * 0.74);
  return base;
};

const lockedOrbitRadiusForConnections = (count: number) => {
  const clamped = Math.max(0, count);
  if (clamped <= 0) return 118;
  const minRadius = 132;
  const grown = minRadius + Math.sqrt(clamped) * 26;
  return Math.min(360, grown);
};

const curvePathBetweenNodes = (
  source: Pick<GraphNode, "x" | "y" | "r"> | null | undefined,
  target: Pick<GraphNode, "x" | "y" | "r"> | null | undefined
) => {
  const sx = source?.x ?? 0;
  const sy = source?.y ?? 0;
  const tx = target?.x ?? 0;
  const ty = target?.y ?? 0;
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
  const ux = dx / dist;
  const uy = dy / dist;
  const sPad = Math.max(3, (source?.r ?? 10) * 0.86);
  const tPad = Math.max(3, (target?.r ?? 10) * 0.86);
  const x1 = sx + ux * sPad;
  const y1 = sy + uy * sPad;
  const x2 = tx - ux * tPad;
  const y2 = ty - uy * tPad;
  const lift = Math.min(44, 16 + dist * 0.1);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 - lift;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
};

const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase();

const resolveCurrentUserNode = (
  nodes: GraphNode[],
  user: { id?: string; email?: string; name?: string; major?: string } | null
) => {
  if (!user) return null;
  const userId = normalize(user.id);
  const userEmail = normalize(user.email);
  const userName = normalize(user.name);
  const userMajor = normalize(user.major);

  const byStrongId = nodes.find((n) => {
    if (n.type !== "student") return false;
    const details = (n.details ?? {}) as Record<string, unknown>;
    const candidates = [
      n.id,
      details.id,
      details.user_id,
      details.userId,
      details.profile_id,
      details.profileId,
      details.graph_node_id,
      details.graphNodeId,
      details.clerk_id,
      details.clerkId,
    ];
    return candidates.some((c) => normalize(c) && normalize(c) === userId);
  });
  if (byStrongId) return byStrongId;

  const byEmail = nodes.find((n) => {
    if (n.type !== "student" || !userEmail) return false;
    const details = (n.details ?? {}) as Record<string, unknown>;
    return normalize(details.email) === userEmail;
  });
  if (byEmail) return byEmail;

  const byName = nodes.find((n) => n.type === "student" && userName && normalize(n.label) === userName);
  if (byName) return byName;

  const localPart = userEmail.includes("@") ? userEmail.split("@")[0] : "";
  const nameTokens = userName.split(/\s+/).filter(Boolean);
  const scored = nodes
    .filter((n) => n.type === "student")
    .map((n) => {
      const details = (n.details ?? {}) as Record<string, unknown>;
      const label = normalize(n.label);
      const detailName = normalize(details.name);
      const detailMajor = normalize(details.major);
      let score = 0;
      if (localPart && (label.includes(localPart) || detailName.includes(localPart))) score += 5;
      if (userName && (label.includes(userName) || detailName.includes(userName))) score += 6;
      if (nameTokens.length && nameTokens.some((t) => t.length > 2 && (label.includes(t) || detailName.includes(t)))) score += 3;
      if (userMajor && detailMajor && detailMajor === userMajor) score += 1;
      return { node: n, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length && scored[0].score >= 6) return scored[0].node;
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
export default function CampusGraph() {

  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { nodes, links, loading, error } = useGraphData();
  const [introComplete, setIntroComplete] = useState(false);
  const handleIntroComplete = useCallback(() => setIntroComplete(true), []);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<GraphMode>("free");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<NodeType>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [pathNodeIds, setPathNodeIds] = useState<string[]>([]);
  const [pathStatus, setPathStatus] = useState<"idle" | "searching" | "found" | "notfound">("idle");
  const [hoverCard, setHoverCard] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [d3Ready, setD3Ready] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoMessage, setDemoMessage] = useState<string>("");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [spatialFocusNodeIds, setSpatialFocusNodeIds] = useState<string[]>([]);
  const [edgeExplain, setEdgeExplain] = useState<{
    link: GraphLink;
    reasons: string[];
    x: number;
    y: number;
  } | null>(null);
  const [overlaySafeRight, setOverlaySafeRight] = useState(20);
  const [overlayNoFlyRect, setOverlayNoFlyRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [introFocusReady, setIntroFocusReady] = useState(false);
  const currentUserNode = useMemo(
    () => resolveCurrentUserNode(nodes, user),
    [nodes, user]
  );

  // ── D3 Refs ───────────────────────────────────────────────────────────────
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bgGlowRef = useRef<HTMLDivElement>(null);
  const nodeSelRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);
  const linkSelRef = useRef<d3.Selection<SVGPathElement, GraphLink, SVGGElement, unknown> | null>(null);
  const labelSelRef = useRef<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>(null);
  const pulseLayerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const rippleLayerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const baseNodeFilterRef = useRef<(n: GraphNode) => string | null>(() => null);
  const minimapRef = useRef<SVGSVGElement>(null);
  const hiddenTypesRef = useRef<Set<NodeType>>(new Set());
  const visibleLinksRef = useRef<GraphLink[]>([]);
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const dimsRef = useRef({ w: 900, h: 600 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const introDoneRef = useRef(false);
  const introLandingFixRef = useRef(false);
  const introDebugRef = useRef({ waitingForNodeLogged: false, introStartedLogged: false });

  // ── Pan inertia refs ──────────────────────────────────────────────────────
  const inertiaRafRef = useRef<number | null>(null);
  const inertiaDeltaRef = useRef({ dx: 0, dy: 0 });
  const lastZoomXRef = useRef<number | null>(null);
  const lastZoomYRef = useRef<number | null>(null);
  const demoTimerRef = useRef<number | null>(null);
  const demoAppliedStepRef = useRef<number>(-1);
  const draggingNodeIdRef = useRef<string | null>(null);
  const dragNeighborhoodRef = useRef<Set<string>>(new Set());
  const particleRafRef = useRef<number | null>(null);
  const updateMiniViewportRef = useRef<(() => void) | null>(null);
  const focusRafRef = useRef<number | null>(null);

  // ── Clear hover card when leaving free mode ───────────────────────────────
  useEffect(() => { if (mode !== "free") setHoverCard(null); }, [mode]);
  useEffect(() => { setEdgeExplain(null); }, [mode, selectedNode?.id, pathNodeIds.length]);

  // ── Stable-ref callbacks (avoids D3 setup re-running on mode changes) ─────
  const modeRef = useRef<GraphMode>("free");
  const selectedIdRef = useRef<string | null>(null);
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const searchActiveRef = useRef(false);
  const currentZoomKRef = useRef(1);
  const flickerTimeRef = useRef(0);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { linksRef.current = links; }, [links]);
  useEffect(() => { hiddenTypesRef.current = hiddenTypes; }, [hiddenTypes]);
  useEffect(() => {
    introLandingFixRef.current = false;
    introDebugRef.current = { waitingForNodeLogged: false, introStartedLogged: false };
    setIntroFocusReady(false);
  }, [user?.id, nodes.length]);

  useEffect(() => {
    const resolved = currentUserNode;
    // TEMP DEBUG: remove once intro focus is stable.
    console.info("[CampusGraph/intro] user identity", {
      authUserId: user?.id,
      authEmail: (user as { email?: string } | null)?.email,
      authName: (user as { name?: string } | null)?.name,
      nodesCount: nodes.length,
      resolvedNodeId: resolved?.id ?? null,
      resolvedNodeLabel: resolved?.label ?? null,
      resolvedHasXY: Boolean(resolved && resolved.x != null && resolved.y != null),
      introDone: introDoneRef.current,
    });
  }, [currentUserNode, nodes.length, user]);

  // ── Opacity helper ────────────────────────────────────────────────────────
  const defOp = (l: GraphLink) => edgeOpacityFromStrength(edgeStrength(l));

  const getGraphViewportDims = useCallback(() => {
    const svgNode = svgRef.current;
    if (!svgNode) return dimsRef.current;
    const w = Math.max(1, svgNode.clientWidth || dimsRef.current.w);
    const h = Math.max(1, svgNode.clientHeight || dimsRef.current.h);
    dimsRef.current = { w, h };
    return dimsRef.current;
  }, []);

  // ── Neighbor helper ───────────────────────────────────────────────────────
  const topNeighbors = useCallback((d: GraphNode, max: number): GraphNode[] => {
    const wMap = new Map<string, number>();
    linksRef.current.forEach(l => {
      const s = getNodeId(l.source), t = getNodeId(l.target), w = l.weight ?? 0.5;
      if (s === d.id) wMap.set(t, Math.max(wMap.get(t) ?? 0, w));
      if (t === d.id) wMap.set(s, Math.max(wMap.get(s) ?? 0, w));
    });
    return [...wMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([id]) => nodesRef.current.find(n => n.id === id))
      .filter(Boolean) as GraphNode[];
  }, []);

  const directNeighbors = useCallback((d: GraphNode): GraphNode[] => {
    const wMap = new Map<string, number>();
    const sourceLinks = visibleLinksRef.current.length ? visibleLinksRef.current : linksRef.current;
    sourceLinks.forEach((l) => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      const w = l.weight ?? 0.5;
      if (s === d.id && t !== d.id) wMap.set(t, Math.max(wMap.get(t) ?? 0, w));
      if (t === d.id && s !== d.id) wMap.set(s, Math.max(wMap.get(s) ?? 0, w));
    });
    return [...wMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => nodesRef.current.find((n) => n.id === id))
      .filter(Boolean) as GraphNode[];
  }, []);

  const fitToNodeIds = useCallback((ids: string[], duration = 700, anchorId?: string) => {
    if (!svgRef.current || !zoomRef.current || ids.length === 0) return;
    const targetNodes = nodesRef.current.filter(n => ids.includes(n.id) && n.x != null && n.y != null);
    if (!targetNodes.length) return;
    const { w, h } = getGraphViewportDims();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    targetNodes.forEach(n => {
      const x = n.x as number;
      const y = n.y as number;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    const dx = Math.max(1, maxX - minX) + FIT_PADDING;
    const dy = Math.max(1, maxY - minY) + FIT_PADDING;
    const scale = Math.max(FIT_MIN_SCALE, Math.min(FIT_MAX_SCALE, 0.92 / Math.max(dx / w, dy / h)));
    const anchor = anchorId ? targetNodes.find((n) => n.id === anchorId) : null;
    const midX = anchor?.x ?? (minX + maxX) / 2;
    const midY = anchor?.y ?? (minY + maxY) / 2;
    const transform = d3.zoomIdentity
      .translate(w / 2 - scale * midX, h / 2 - scale * midY)
      .scale(scale);
    d3.select(svgRef.current)
      .interrupt()
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, transform);
  }, [getGraphViewportDims]);

  const focusSelectedNeighborhood = useCallback((selected: GraphNode, neighborIds: string[], duration = 760) => {
    if (!selected || !svgRef.current || !zoomRef.current) return;
    const { w, h } = getGraphViewportDims();
    const sx = w / 2;
    const sy = h / 2;
    const neighborCount = Math.max(0, neighborIds.length);
    const orbitRadius = lockedOrbitRadiusForConnections(neighborCount);
    const radialPad = neighborCount > 0 ? 56 : 44;
    const effectiveRadius = orbitRadius + radialPad;

    const padX = FIT_PADDING + 26;
    const padY = FIT_PADDING + 10;
    const usableW = Math.max(120, w - padX * 2);
    const usableH = Math.max(120, h - padY * 2);
    const neededW = Math.max(92, effectiveRadius * 2);
    const neededH = Math.max(92, effectiveRadius * 2);
    const scale = Math.max(
      LOCKED_FIT_MIN_SCALE,
      Math.min(
        FIT_MAX_SCALE,
        Math.min((usableW * LOCKED_VIEWPORT_COVERAGE) / neededW, (usableH * LOCKED_VIEWPORT_COVERAGE) / neededH)
      )
    );

    const transform = d3.zoomIdentity
      .translate(w / 2 - scale * sx, h / 2 - scale * sy)
      .scale(scale);

    const zoom = zoomRef.current;
    d3.select(svgRef.current)
      .interrupt()
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, transform);
  }, [getGraphViewportDims]);

  useEffect(() => {
    if (!d3Ready || !introFocusReady || introLandingFixRef.current) return;
    if (viewMode !== "2d" || mode !== "free" || demoMode || selectedNode) return;
    if (!currentUserNode || currentUserNode.x == null || currentUserNode.y == null) return;
    introLandingFixRef.current = true;
    // TEMP DEBUG: remove once intro focus is stable.
    console.info("[CampusGraph/intro] applying post-intro landing correction", {
      targetNodeId: currentUserNode.id,
      targetNodeLabel: currentUserNode.label,
      targetX: currentUserNode.x,
      targetY: currentUserNode.y,
    });
    const raf = requestAnimationFrame(() => {
      fitToNodeIds([currentUserNode.id], 560, currentUserNode.id);
    });
    return () => cancelAnimationFrame(raf);
  }, [currentUserNode, d3Ready, demoMode, fitToNodeIds, introFocusReady, mode, selectedNode, viewMode]);

  const explainConnection = useCallback((l: GraphLink): string[] => {
    const sId = getNodeId(l.source);
    const tId = getNodeId(l.target);
    const sNode = nodesRef.current.find(n => n.id === sId);
    const tNode = nodesRef.current.find(n => n.id === tId);
    const reasons: string[] = [];
    if (l.rel) reasons.push(`Relationship: ${l.rel.replace(/_/g, " ").toLowerCase()}`);
    if (l.weight != null) reasons.push(`Strength score ${(l.weight * 100).toFixed(0)}%`);
    if (sNode?.type === "student" && tNode?.type === "student") {
      const sMajor = String(sNode.details?.major ?? "").toLowerCase();
      const tMajor = String(tNode.details?.major ?? "").toLowerCase();
      if (sMajor && tMajor && sMajor === tMajor) reasons.push(`Shared major: ${sNode.details?.major as string}`);
    }
    if (sNode?.type === "student" && tNode?.type === "company") {
      reasons.push(`Student to company bridge via ${l.rel.replace(/_/g, " ").toLowerCase()}`);
    }
    if (sNode?.type === "student" && tNode?.type === "club") reasons.push("Club membership link");
    if (sNode?.type === "student" && tNode?.type === "interest") reasons.push("Shared interest graph edge");
    if (!reasons.length && sNode && tNode) reasons.push(`${sNode.label} is connected to ${tNode.label} in the graph`);
    return reasons.slice(0, 3);
  }, []);

  const fadeLabels = useCallback((opacityGetter: number | ((n: GraphNode) => number), duration = LABEL_FADE_MS) => {
    const labels = labelSelRef.current;
    if (!labels) return;
    const getOpacity = typeof opacityGetter === "function" ? opacityGetter : () => opacityGetter;
    labels.interrupt().transition().duration(duration).style("opacity", (n: GraphNode) => clamp01(getOpacity(n)));
  }, []);

  const spawnNodeRipple = useCallback((d: GraphNode) => {
    const layer = rippleLayerRef.current;
    if (!layer || d.x == null || d.y == null) return;
    const ring = layer.append("circle")
      .attr("class", "node-ripple")
      .attr("cx", d.x)
      .attr("cy", d.y)
      .attr("r", Math.max(4, (d.r ?? 12) * 0.75))
      .attr("stroke-opacity", 0.55)
      .attr("fill-opacity", 0.12);
    ring.transition().duration(520).ease(d3.easeCubicOut)
      .attr("r", (d.r ?? 12) + 34)
      .attr("stroke-opacity", 0)
      .attr("fill-opacity", 0)
      .remove();
  }, []);

  const spawnHoverRings = useCallback((d: GraphNode) => {
    const layer = rippleLayerRef.current;
    if (!layer || d.x == null || d.y == null) return;
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      const ring = layer.append("circle")
        .attr("class", "node-hover-ring")
        .attr("cx", d.x)
        .attr("cy", d.y)
        .attr("r", Math.max(5, (d.r ?? 12) * 0.7))
        .attr("stroke-opacity", 0.5 - i * 0.12)
        .attr("fill-opacity", 0);
      ring.transition()
        .delay(i * 90)
        .duration(620)
        .ease(d3.easeCubicOut)
        .attr("r", (d.r ?? 12) + 28 + i * 8)
        .attr("stroke-opacity", 0)
        .remove();
    }
  }, []);

  // ── Enter Locked Mode ─────────────────────────────────────────────────────
  const enterLocked = useCallback((d: GraphNode) => {
    const sim = simRef.current;
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    if (!sim || !nodeSel || !linkSel) return;

    const { w, h } = getGraphViewportDims();
    const cx = w / 2, cy = h / 2;
    const neighbors = directNeighbors(d);
    const orbitRadius = lockedOrbitRadiusForConnections(neighbors.length);
    const neighborSet = new Set(neighbors.map(n => n.id));

    // Freeze all nodes at current positions first
    nodesRef.current.forEach(n => { n.fx = n.x ?? cx; n.fy = n.y ?? cy; });

    // Move selected to center, neighbors to radial ring
    d.fx = cx; d.fy = cy;
    neighbors.forEach((nb, i) => {
      const angle = (i / neighbors.length) * 2 * Math.PI - Math.PI / 2;
      nb.fx = cx + orbitRadius * Math.cos(angle);
      nb.fy = cy + orbitRadius * Math.sin(angle);
    });

    sim.alpha(0.6).restart();

    // Node visibility
    nodeSel.transition().duration(500)
      .style("opacity", (n: GraphNode) => n.id === d.id || neighborSet.has(n.id) ? 1 : 0)
      .style("pointer-events", (n: GraphNode) => n.id === d.id || neighborSet.has(n.id) ? "all" : "none");

    // Glow on selected + neighbors
    nodeSel.select<SVGCircleElement>("circle.main-circle")
      .attr("filter", (n: GraphNode) =>
        n.id === d.id ? "url(#glow-selected)" :
          neighborSet.has(n.id) ? "url(#glow-soft)" : null)
      .transition().duration(500)
      .attr("r", (n: GraphNode) => n.id === d.id ? (n.r ?? 12) * 1.5 : (n.r ?? 12));

    // Labels: show for selected + neighbors only
    fadeLabels((n: GraphNode) => (n.id === d.id || neighborSet.has(n.id) ? 1 : 0), 500);

    // Edges: show only direct connections
    linkSel.transition().duration(500).attr("stroke-opacity", (l: GraphLink) => {
      const s = getNodeId(l.source), t = getNodeId(l.target);
      return (s === d.id && neighborSet.has(t)) || (t === d.id && neighborSet.has(s)) ? 0.85 : 0;
    });

    // Emphasize direct edges: color, width boost, glow
    linkSel
      .filter((l: GraphLink) => {
        const s = getNodeId(l.source), t = getNodeId(l.target);
        return (s === d.id && neighborSet.has(t)) || (t === d.id && neighborSet.has(s));
      })
      .transition().duration(600)
      .attr("stroke", "#93c5fd")   // CONSTANT: emphasized edge color
      .attr("stroke-width", (l: GraphLink) => edgeWidthFromStrength(edgeStrength(l)) * 1.35)
      .attr("filter", "url(#glow-soft)");

    // Neighbor opacity gradient: stronger connection = brighter node
    nodeSel.filter((n: GraphNode) => neighborSet.has(n.id))
      .transition().duration(500)
      .style("opacity", (n: GraphNode) => {
        const sourceLinks = visibleLinksRef.current.length ? visibleLinksRef.current : linksRef.current;
        const maxW = Math.max(
          ...sourceLinks
            .filter(l =>
              (getNodeId(l.source) === d.id && getNodeId(l.target) === n.id) ||
              (getNodeId(l.target) === d.id && getNodeId(l.source) === n.id)
            )
            .map(l => edgeStrength(l)),
          0.3  // floor so even weakest neighbors stay visible
        );
        return 0.45 + maxW * 0.55;  // CONSTANT: range 0.45–1.0
      });

  }, [directNeighbors, getGraphViewportDims]); // eslint-disable-line

  // ── Exit to Free Mode ─────────────────────────────────────────────────────
  const exitToFree = useCallback(() => {
    const sim = simRef.current;
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    if (!sim || !nodeSel || !linkSel) return;

    // Unpin all nodes
    nodesRef.current.forEach(n => { n.fx = null; n.fy = null; });
    sim.alpha(0.4).restart();

    nodeSel.transition().duration(400)
      .style("opacity", 1)
      .style("pointer-events", "all");

    nodeSel.select<SVGCircleElement>("circle.main-circle")
      .attr("filter", (n: GraphNode) => baseNodeFilterRef.current(n))
      .transition().duration(400)
      .attr("r", (n: GraphNode) => n.r ?? 12);

    fadeLabels(LABEL_OPACITY_BASE, 400);

    linkSel.transition().duration(400)
      .attr("stroke-opacity", (l: GraphLink) => defOp(l))
      .attr("stroke", (l: GraphLink) => edgeStrokeColorForLink(l))
      .attr("stroke-width", (l: GraphLink) => edgeWidthForLink(l))
      .attr("filter", null)
      .attr("stroke-dasharray", (l: GraphLink) => edgeDashForLink(l))
      .attr("stroke-dashoffset", null);

    d3.selectAll(".link.path-pulse").classed("path-pulse", false);
    d3.selectAll(".path-overlay").remove();
  }, []); // eslint-disable-line

  // ── Select / Deselect ─────────────────────────────────────────────────────
  const selectNodeFn = useCallback((d: GraphNode, fromDemo = false) => {
    if (!fromDemo) {
      setDemoMode(false);
      setDemoStep(0);
      setDemoMessage("");
      if (demoTimerRef.current) {
        window.clearTimeout(demoTimerRef.current);
        demoTimerRef.current = null;
      }
    }
    spawnNodeRipple(d);
    setMultiSelectedIds(new Set());
    selectedIdRef.current = d.id;
    setSelectedNode(d);
    setMode("locked");
    setPathNodeIds([]);
    setPathStatus("idle");
    setCompanyQuery("");
    d3.selectAll(".link.path-pulse").classed("path-pulse", false);
    d3.selectAll(".path-overlay").remove();
  }, [spawnNodeRipple]);

  useEffect(() => {
    if (viewMode !== "2d" || mode !== "locked" || !selectedNode) return;
    const neighbors = directNeighbors(selectedNode);
    if (focusRafRef.current) cancelAnimationFrame(focusRafRef.current);
    focusRafRef.current = requestAnimationFrame(() => {
      focusRafRef.current = requestAnimationFrame(() => {
        enterLocked(selectedNode);
        focusSelectedNeighborhood(selectedNode, neighbors.map((n) => n.id), 760);
      });
    });
    return () => {
      if (focusRafRef.current) {
        cancelAnimationFrame(focusRafRef.current);
        focusRafRef.current = null;
      }
    };
  }, [viewMode, mode, selectedNode, directNeighbors, enterLocked, focusSelectedNeighborhood]);

  const deselectAll = useCallback(() => {
    selectedIdRef.current = null;
    setSelectedNode(null);
    setMultiSelectedIds(new Set());
    setEdgeExplain(null);
    setMode("free");
    setPathNodeIds([]);
    setPathStatus("idle");
    setDemoMode(false);
    setDemoMessage("");
    if (demoTimerRef.current) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    exitToFree();
  }, [exitToFree]);

  // ── Auto-select node from ?select= URL param ──────────────────────────────
  useEffect(() => {
    const selectId = searchParams.get("select");
    // Wait for nodes to load, intro to finish, AND D3 refs to be initialized
    if (!selectId || nodes.length === 0 || !introComplete || !d3Ready) return;
    if (!svgRef.current || !zoomRef.current) return;

    const target = nodes.find(n => n.id === selectId);
    if (!target) { setSearchParams({}, { replace: true }); return; }

    selectNodeFn(target);

    // enterLocked places the selected node at graph center (w/2, h/2).
    // The intro flyover zoom may be mid-flight targeting the current user's node.
    // Interrupt it and reset the viewport to identity so graph center is visible.
    d3.select(svgRef.current)
      .interrupt()
      .transition().duration(600).ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, d3.zoomIdentity);

    setSearchParams({}, { replace: true });
  }, [searchParams, nodes, introComplete, d3Ready, selectNodeFn, setSearchParams]);

  // ── Company path search ───────────────────────────────────────────────────
  const findPath = useCallback(async (overrideLabel?: string) => {
    const fromId = selectedIdRef.current ?? user?.id;
    const queryLabel = overrideLabel ?? companyQuery;
    if (!fromId || !queryLabel.trim()) return;

    const target = nodesRef.current.find(
      n => n.type === "company" && n.label.toLowerCase() === queryLabel.toLowerCase()
    );
    if (!target) { setPathStatus("notfound"); return; }

    setPathStatus("searching");
    try {
      const res = await fetch(`${API}/api/graph/path?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(target.id)}`);
      const data = await res.json() as { nodeIds: string[]; rels: string[] };
      if (!data.nodeIds?.length) { setPathStatus("notfound"); return; }
      setPathNodeIds(data.nodeIds);
      setPathStatus("found");
      setMode("path");
    } catch {
      setPathStatus("notfound");
    }
  }, [companyQuery, user]);

  const toggleType = useCallback((type: NodeType) =>
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    }), []);

  // ── D3 Setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || error || !svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    dimsRef.current = { w: width, h: height };

    // ── SVG defs (glow filters) ────────────────────────────────────────────
    const defs = svg.append("defs");
    const addGlow = (id: string, std: number, spread: string) => {
      const f = defs.append("filter").attr("id", id)
        .attr("x", spread).attr("y", spread)
        .attr("width", `${200 - 2 * parseInt(spread)}%`).attr("height", `${200 - 2 * parseInt(spread)}%`);
      f.append("feGaussianBlur").attr("stdDeviation", std).attr("result", "blur");
      const m = f.append("feMerge");
      m.append("feMergeNode").attr("in", "blur");
      m.append("feMergeNode").attr("in", "SourceGraphic");
    };
    addGlow("glow-selected", 6, "-80%");
    addGlow("glow-soft", 3, "-60%");
    addGlow("glow-path", 4, "-60%");
    const addBloom = (id: string, color: string) => {
      const f = defs.append("filter").attr("id", id).attr("x", "-90%").attr("y", "-90%").attr("width", "280%").attr("height", "280%");
      f.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 3.8).attr("result", "blur");
      f.append("feFlood").attr("flood-color", color).attr("flood-opacity", 0.72).attr("result", "flood");
      f.append("feComposite").attr("in", "flood").attr("in2", "blur").attr("operator", "in").attr("result", "glow");
      const m = f.append("feMerge");
      m.append("feMergeNode").attr("in", "glow");
      m.append("feMergeNode").attr("in", "SourceGraphic");
    };
    addBloom("bloom-student", TYPE_COLOR.student);
    addBloom("bloom-company", TYPE_COLOR.company);
    addBloom("bloom-club", TYPE_COLOR.club);
    addBloom("bloom-interest", TYPE_COLOR.interest);
    addBloom("bloom-professor", TYPE_COLOR.professor);

    // ── Hub suppression ────────────────────────────────────────────────────
    const edgeTier = (l: GraphLink) => edgeTierFromStrength(edgeStrength(l));

    const nodeEdges: Record<string, { link: GraphLink; w: number }[]> = {};
    for (const l of links) {
      const s = l.source as string, t = l.target as string, w = edgeStrength(l);
      if (!nodeEdges[s]) nodeEdges[s] = [];
      if (!nodeEdges[t]) nodeEdges[t] = [];
      nodeEdges[s].push({ link: l, w });
      nodeEdges[t].push({ link: l, w });
    }
    const keepSet = new Set<GraphLink>();
    for (const bucket of Object.values(nodeEdges)) {
      bucket.sort((a, b) => b.w - a.w);
      bucket.slice(0, HUB_MAX).forEach(({ link }) => keepSet.add(link));
    }
    const visibleLinks = links.filter(l => keepSet.has(l));

    // ── Node sizing ────────────────────────────────────────────────────────
    const degree: Record<string, number> = {};
    const nodeById = new Map<string, GraphNode>();
    nodes.forEach((n: GraphNode) => (degree[n.id] = 0));
    nodes.forEach((n: GraphNode) => nodeById.set(n.id, n));
    visibleLinks.forEach(l => {
      const s = l.source as string, t = l.target as string;
      degree[s] = (degree[s] || 0) + 1;
      degree[t] = (degree[t] || 0) + 1;
    });
    const maxDeg = Math.max(...Object.values(degree), 1);
    const sortedDegrees = Object.entries(degree).sort((a, b) => b[1] - a[1]);
    const topGlowCount = Math.max(1, Math.ceil(nodes.length * 0.25));
    const glowSet = new Set(sortedDegrees.slice(0, topGlowCount).map(([id]) => id));
    const baseNodeFilter = (n: GraphNode) => {
      if (n.id === user?.id) return "url(#glow-selected)";
      if (!glowSet.has(n.id)) return null;
      return `url(#bloom-${n.type})`;
    };
    baseNodeFilterRef.current = baseNodeFilter;
    nodes.forEach((n: GraphNode) => {
      const d = degree[n.id] || 0;
      if (n.type === "company" || n.type === "club") {
        n.r = Math.max(12, Math.min(28, 8 + d * 2.0));
        if (d > maxDeg * 0.5) n.r = Math.min(30, n.r + 2); // bridge bonus
      } else if (n.type === "student") {
        // Grows with connections but caps below clubs/companies (competitive edge)
        n.r = Math.max(8, Math.min(22, 7 + d * 1.8));
      } else if (n.type === "professor") {
        n.r = Math.max(8, Math.min(18, 7 + d * 1.3));
      } else {
        // interest
        n.r = Math.max(7, Math.min(13, 6 + d * 0.9));
      }
    });

    const simLinks: GraphLink[] = visibleLinks.map(l => ({ ...l }));
    visibleLinksRef.current = simLinks;
    const hubIds = new Set(Object.entries(degree).filter(([, d]) => d > HUB_BUNDLE_DEGREE).map(([id]) => id));
    const hubChildren = new Map<string, string[]>();
    const nodeBundleAnchor = new Map<string, { hubId: string; idx: number; total: number }>();
    simLinks.forEach(l => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      if (hubIds.has(s) && !hubIds.has(t)) {
        if (!hubChildren.has(s)) hubChildren.set(s, []);
        hubChildren.get(s)!.push(t);
      }
      if (hubIds.has(t) && !hubIds.has(s)) {
        if (!hubChildren.has(t)) hubChildren.set(t, []);
        hubChildren.get(t)!.push(s);
      }
    });
    hubChildren.forEach((children, hubId) => {
      const uniq = [...new Set(children)];
      uniq.forEach((nodeId, idx) => {
        nodeBundleAnchor.set(nodeId, { hubId, idx, total: uniq.length });
      });
    });

    // ── Edge particle flow state ──────────────────────────────────────────
    interface ParticleState {
      el: d3.Selection<SVGCircleElement, unknown, null, undefined>;
      linkIdx: number;
      t: number;
      speed: number;
      size: number;
    }
    const activeParticles: ParticleState[] = [];
    const flowLinks = simLinks.filter(l => l.style !== "direct");
    const flowWeights = flowLinks.map(l => 0.22 + edgeStrength(l) * 0.78);
    const flowWeightTotal = flowWeights.reduce((sum, w) => sum + w, 0);
    const pickFlowLinkIndex = () => {
      if (!flowLinks.length || flowWeightTotal <= 0) return -1;
      let roll = Math.random() * flowWeightTotal;
      for (let i = 0; i < flowWeights.length; i++) {
        roll -= flowWeights[i];
        if (roll <= 0) return i;
      }
      return flowWeights.length - 1;
    };

    const g = svg.append("g").attr("class", "graph-root");

    // ── Zoom ──────────────────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 4])
      .wheelDelta((event: WheelEvent) => -event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025))
      // Soft boundary: prevent drifting into empty space more than 2× canvas
      .translateExtent([[-width * 2, -height * 2], [width * 3, height * 3]])
      .on("start.inertia", () => {
        // Instant interrupt: any new drag/pan cancels ongoing glide
        if (inertiaRafRef.current) cancelAnimationFrame(inertiaRafRef.current);
        inertiaRafRef.current = null;
        lastZoomXRef.current = null;
        lastZoomYRef.current = null;
        inertiaDeltaRef.current = { dx: 0, dy: 0 };
      })
      .on("zoom", (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", e.transform.toString());
        currentZoomKRef.current = e.transform.k;
        if (bgGlowRef.current) {
          const parallaxX = e.transform.x * 0.014;
          const parallaxY = e.transform.y * 0.014;
          bgGlowRef.current.style.transform = `translate(${parallaxX}px, ${parallaxY}px) scale(${1 + (e.transform.k - 1) * 0.02})`;
        }
        updateMiniViewportRef.current?.();
        // Show more labels when zoomed in
        if (modeRef.current === "free" && !searchActiveRef.current && !hoveredNodeIdRef.current) {
          fadeLabels(e.transform.k > 1.7 ? 1 : LABEL_OPACITY_BASE, 140);
        }
        // Track translation delta for inertia (pan events only, not programmatic)
        if (e.sourceEvent) {
          if (lastZoomXRef.current !== null) {
            inertiaDeltaRef.current = {
              dx: e.transform.x - lastZoomXRef.current,
              dy: e.transform.y - lastZoomYRef.current!,
            };
          }
          lastZoomXRef.current = e.transform.x;
          lastZoomYRef.current = e.transform.y;
        }
      })
      .on("end.inertia", (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        // Only glide after pointer pan, not scroll-zoom
        if (!e.sourceEvent || e.sourceEvent.type === "wheel") return;
        const svgNode = svgRef.current;
        if (!svgNode) return;
        // CONSTANTS (tweak here):
        const FRICTION = 0.88;  // higher = longer glide
        const MIN_SPEED = 0.4;   // lower = longer tail
        let { dx, dy } = inertiaDeltaRef.current;
        const glide = () => {
          if (Math.abs(dx) < MIN_SPEED && Math.abs(dy) < MIN_SPEED) return;
          d3.select(svgNode).call(zoom.translateBy, dx, dy);
          dx *= FRICTION; dy *= FRICTION;
          inertiaRafRef.current = requestAnimationFrame(glide);
        };
        inertiaRafRef.current = requestAnimationFrame(glide);
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    const curvePathForLink = (d: GraphLink) => {
      const s = d.source as GraphNode;
      const t = d.target as GraphNode;
      return curvePathBetweenNodes(s, t);
    };

    // ── Links ─────────────────────────────────────────────────────────────
    const linkSel = g.append("g")
      .selectAll<SVGPathElement, GraphLink>("path")
      .data(simLinks).enter().append("path")
      .attr("class", (d: GraphLink) =>
        `link link-t${edgeTier(d)}${d.style === "dashed" ? " link-dashed" : ""}${d.style === "direct" ? " link-direct" : ""}`)
      .attr("stroke-width", (d: GraphLink) => edgeWidthForLink(d))
      .attr("stroke-opacity", (d: GraphLink) => defOp(d))
      .attr("stroke", (d: GraphLink) => edgeStrokeColorForLink(d))
      .attr("stroke-dasharray", (d: GraphLink) => edgeDashForLink(d))
      .attr("fill", "none")
      .attr("d", (d: GraphLink) => curvePathForLink(d))
      .on("click", (e: MouseEvent, l: GraphLink) => {
        e.stopPropagation();
        setEdgeExplain({
          link: l,
          reasons: explainConnection(l),
          x: e.clientX,
          y: e.clientY,
        });
      });
    linkSel
      .attr("stroke-opacity", 0)
      .transition()
      .delay((_l: GraphLink, i: number) => Math.min(260, i * 5))
      .duration(520)
      .ease(d3.easeCubicOut)
      .attr("stroke-opacity", (l: GraphLink) => defOp(l));

    // ── Pulse layer (between links and nodes) ────────────────────────────
    const pulseLayer = g.append("g").attr("class", "edge-pulse-layer").attr("pointer-events", "none");
    const rippleLayer = g.append("g").attr("class", "node-ripple-layer").attr("pointer-events", "none");
    pulseLayerRef.current = pulseLayer;
    rippleLayerRef.current = rippleLayer;
    const flowPathNodes = linkSel.nodes();

    let lastFlowTs = 0;
    let nextFlowBurstAt = 1300;
    const spawnFlowParticle = () => {
      if (activeParticles.length >= FLOW_ACTIVE_MAX) return;
      const linkIdx = pickFlowLinkIndex();
      if (linkIdx < 0 || linkIdx >= flowPathNodes.length) return;
      const l = flowLinks[linkIdx];
      const sId = getNodeId(l.source);
      const tId = getNodeId(l.target);
      const sNode = nodesRef.current.find(n => n.id === sId);
      const tNode = nodesRef.current.find(n => n.id === tId);
      if (!sNode || !tNode) return;
      if (hiddenTypesRef.current.has(sNode.type) || hiddenTypesRef.current.has(tNode.type)) return;
      const pathEl = flowPathNodes[linkIdx];
      if (!pathEl) return;
      const strength = edgeStrength(l);
      const particle = pulseLayer.append<SVGCircleElement>("circle")
        .attr("class", "flow-particle")
        .attr("r", 1.6 + strength * 2.2)
        .attr("fill-opacity", 0);
      activeParticles.push({
        el: particle,
        linkIdx,
        t: 0,
        speed: 0.00011 + strength * 0.00015,
        size: 1.6 + strength * 2.2,
      });
    };

    const animateParticles = (ts: number) => {
      if (!lastFlowTs) lastFlowTs = ts;
      const dt = ts - lastFlowTs;
      lastFlowTs = ts;
      if (modeRef.current === "free" && flowLinks.length > 0) {
        nextFlowBurstAt -= dt;
        if (nextFlowBurstAt <= 0) {
          const burst = FLOW_BURST_MIN + Math.floor(Math.random() * (FLOW_BURST_MAX - FLOW_BURST_MIN + 1));
          const room = Math.max(0, FLOW_ACTIVE_MAX - activeParticles.length);
          const spawnCount = Math.min(burst, room);
          for (let i = 0; i < spawnCount; i++) spawnFlowParticle();
          nextFlowBurstAt = FLOW_BURST_INTERVAL_MIN_MS + Math.random() * (FLOW_BURST_INTERVAL_MAX_MS - FLOW_BURST_INTERVAL_MIN_MS);
        }
      } else if (activeParticles.length > 0) {
        activeParticles.forEach(p => p.el.remove());
        activeParticles.length = 0;
      }
      for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        const pathEl = flowPathNodes[p.linkIdx];
        const lnk = flowLinks[p.linkIdx];
        if (!pathEl || !lnk) { p.el.remove(); activeParticles.splice(i, 1); continue; }
        const sId = getNodeId(lnk.source);
        const tId = getNodeId(lnk.target);
        const sNode = nodesRef.current.find(n => n.id === sId);
        const tNode = nodesRef.current.find(n => n.id === tId);
        if (!sNode || !tNode || hiddenTypesRef.current.has(sNode.type) || hiddenTypesRef.current.has(tNode.type)) {
          p.el.remove(); activeParticles.splice(i, 1); continue;
        }
        p.t += p.speed * dt;
        if (p.t >= 1) { p.el.remove(); activeParticles.splice(i, 1); continue; }
        const len = pathEl.getTotalLength();
        const point = pathEl.getPointAtLength(len * p.t);
        const fade = p.t < 0.14 ? (p.t / 0.14) : p.t > 0.86 ? ((1 - p.t) / 0.14) : 1;
        const strength = edgeStrength(lnk);
        const color = strength >= 0.75 ? "#a5d8ff" : "#7cc6ff";
        p.el
          .attr("cx", point.x)
          .attr("cy", point.y)
          .attr("r", p.size)
          .attr("fill", color)
          .attr("fill-opacity", clamp01(fade) * (0.42 + strength * 0.52));
      }
      particleRafRef.current = requestAnimationFrame(animateParticles);
    };
    particleRafRef.current = requestAnimationFrame(animateParticles);

    // ── Nodes ─────────────────────────────────────────────────────────────
    const nodeSel = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes).enter().append("g")
      .attr("class", (d: GraphNode) =>
        d.id === user?.id ? "node node-current-user" : "node"
      )
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (e: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
            if (modeRef.current !== "free") return;
            draggingNodeIdRef.current = d.id;
            const neighborhood = new Set<string>([d.id]);
            simLinks.forEach(l => {
              const s = getNodeId(l.source);
              const t = getNodeId(l.target);
              if (s === d.id) neighborhood.add(t);
              if (t === d.id) neighborhood.add(s);
            });
            dragNeighborhoodRef.current = neighborhood;
            nodeSel.interrupt().style("opacity", (n: GraphNode) => neighborhood.has(n.id) ? 1 : 0.18);
            linkSel.interrupt().attr("stroke-opacity", (l: GraphLink) => {
              const s = getNodeId(l.source);
              const t = getNodeId(l.target);
              return (s === d.id || t === d.id) ? 0.88 : 0.03;
            });
          })
          .on("drag", (e: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            d.fx = e.x; d.fy = e.y;
          })
          .on("end", (e: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            if (!e.active) sim.alphaTarget(0);
            if (modeRef.current === "free") { d.fx = null; d.fy = null; }
            if (modeRef.current !== "free") return;
            draggingNodeIdRef.current = null;
            dragNeighborhoodRef.current.clear();
            nodeSel.transition().duration(220).style("opacity", 1);
            linkSel.transition().duration(220).attr("stroke-opacity", (l: GraphLink) => defOp(l));
          })
      )
      .on("click", (e: MouseEvent, d: GraphNode) => {
        e.stopPropagation();
        setDemoMode(false);
        setDemoMessage("");
        if (e.shiftKey) {
          setMode("free");
          setSelectedNode(null);
          selectedIdRef.current = null;
          setPathNodeIds([]);
          setPathStatus("idle");
          setEdgeExplain(null);
          setMultiSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(d.id)) next.delete(d.id);
            else next.add(d.id);
            return next;
          });
          exitToFree();
          return;
        }
        selectNodeFn(d);
      })
      .on("mouseenter", (e: MouseEvent, d: GraphNode) => {
        if (modeRef.current !== "free") return;
        spawnHoverRings(d);
        hoveredNodeIdRef.current = d.id;
        setHoverCard({ node: d, x: e.clientX, y: e.clientY });
        const conn = new Set([d.id]);
        simLinks.forEach(l => {
          const s = getNodeId(l.source), t = getNodeId(l.target);
          if (s === d.id) conn.add(t);
          if (t === d.id) conn.add(s);
        });
        linkSel.attr("stroke-opacity", (l: GraphLink) => {
          const s = getNodeId(l.source), t = getNodeId(l.target);
          return (s === d.id || t === d.id) ? 0.78 : 0.15;
        });
        nodeSel.transition().duration(150)
          .style("opacity", (n: GraphNode) => conn.has(n.id) ? 1 : 0.15);
        fadeLabels((n: GraphNode) => (conn.has(n.id) ? 1 : 0), 140);
        nodeSel.filter((n: GraphNode) => n.id === d.id)
          .select<SVGCircleElement>("circle.main-circle")
          .attr("filter", "url(#glow-soft)");
      })
      .on("mouseleave", () => {
        if (modeRef.current !== "free") return;
        hoveredNodeIdRef.current = null;
        setHoverCard(null);
        if (draggingNodeIdRef.current) return;
        linkSel.attr("stroke-opacity", (l: GraphLink) => defOp(l));
        nodeSel.transition().duration(200).style("opacity", 1);
        fadeLabels(currentZoomKRef.current > 1.7 ? 1 : LABEL_OPACITY_BASE, 200);
        nodeSel.select<SVGCircleElement>("circle.main-circle").attr("filter", (n: GraphNode) => baseNodeFilterRef.current(n));
      });

    // Company indicator ring (dashed outer ring)
    nodeSel.filter((d: GraphNode) => d.type === "company").append("circle")
      .attr("class", "company-ring")
      .attr("r", (d: GraphNode) => (d.r ?? 12) + 6)
      .attr("fill", "none")
      .attr("stroke", TYPE_COLOR.company)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.35)
      .attr("stroke-dasharray", "4,3");

    // Main circle
    const mainCircles = nodeSel.append("circle")
      .attr("class", (d: GraphNode) =>
        `main-circle ambient-glow${d.type === "company" || d.id === user?.id ? " ambient-glow--hi" : ""}`
      )
      .attr("r", 0)
      .attr("fill", (d: GraphNode) =>
        d.id === user?.id ? "#facc15" : TYPE_COLOR[d.type]
      )
      .attr("fill-opacity", (d: GraphNode) => d.id === user?.id ? 1 : 0.9)
      .attr("stroke", (d: GraphNode) =>
        d.id === user?.id ? "#fef3c7" : TYPE_COLOR[d.type]
      )
      .attr("stroke-width", (d: GraphNode) => d.id === user?.id ? 3 : 2)
      .attr("stroke-opacity", 0.9)
      .attr("filter", (d: GraphNode) => baseNodeFilter(d));
    mainCircles
      .transition()
      .delay((_d: GraphNode, i: number) => Math.min(220, i * 7))
      .duration(540)
      .ease(d3.easeBackOut.overshoot(1.14))
      .attr("r", (d: GraphNode) => d.r ?? 12);

    // Label (hidden at default zoom in free mode)
    const labels = nodeSel.append("text")
      .attr("dy", (d: GraphNode) => (d.r ?? 12) + 14)
      .text((d: GraphNode) => d.label.length > 20 ? d.label.slice(0, 18) + "…" : d.label)
      .attr("font-size", (d: GraphNode) => d.type === "company" ? "11px" : "10px")
      .attr("font-weight", (d: GraphNode) =>
        d.id === user?.id
          ? "800"
          : ["company", "professor"].includes(d.type) ? "600" : "400"
      )
      .attr("fill", (d: GraphNode) =>
        d.id === user?.id ? "#fef9c3" : "#cbd5e1"
      )
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .style("opacity", LABEL_OPACITY_BASE);
    labelSelRef.current = labels;

    // ── Minimap ─────────────────────────────────────────────────────────────
    let miniLinksSel: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null = null;
    let miniNodesSel: d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null = null;
    let miniViewport: d3.Selection<SVGRectElement, unknown, null, undefined> | null = null;
    let updateMiniFn: (() => void) | null = null;
    const MINI_PAD_X = 8;
    const MINI_PAD_TOP = 16;
    const MINI_PAD_BOTTOM = 8;
    const MINI_INNER_W = Math.max(1, MINIMAP_W - MINI_PAD_X * 2);
    const MINI_INNER_H = Math.max(1, MINIMAP_H - MINI_PAD_TOP - MINI_PAD_BOTTOM);
    const miniBounds = {
      minX: -width * 2,
      maxX: width * 3,
      minY: -height * 2,
      maxY: height * 3,
    };
    const miniSvgNode = minimapRef.current;
    if (miniSvgNode) {
      const mini = d3.select(miniSvgNode);
      mini.selectAll("*").remove();
      mini.attr("viewBox", `0 0 ${MINIMAP_W} ${MINIMAP_H}`);
      mini.attr("width", MINIMAP_W);
      mini.attr("height", MINIMAP_H);
      mini.attr("preserveAspectRatio", "xMidYMid meet");
      mini.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", MINIMAP_W)
        .attr("height", MINIMAP_H)
        .attr("fill", "rgba(8,12,20,0.88)")
        .attr("stroke", "rgba(148,163,184,0.28)")
        .attr("stroke-width", 1);
      mini.append("rect")
        .attr("x", MINI_PAD_X)
        .attr("y", MINI_PAD_TOP)
        .attr("width", MINI_INNER_W)
        .attr("height", MINI_INNER_H)
        .attr("fill", "rgba(8,12,20,0.24)")
        .attr("stroke", "rgba(148,163,184,0.34)")
        .attr("stroke-width", 0.9)
        .attr("stroke-dasharray", "2 2");
      mini.append("text")
        .attr("x", 8)
        .attr("y", 14)
        .attr("fill", "rgba(191,219,254,0.72)")
        .attr("font-size", "8px")
        .attr("font-weight", 700)
        .text("MINIMAP");
      const miniRoot = mini.append("g");
      miniLinksSel = miniRoot.append("g")
        .selectAll<SVGLineElement, GraphLink>("line")
        .data(simLinks)
        .enter()
        .append("line")
        .attr("stroke", "#8bb2de")
        .attr("stroke-opacity", 0.58)
        .attr("stroke-width", 1.15);
      miniNodesSel = miniRoot.append("g")
        .selectAll<SVGCircleElement, GraphNode>("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", 2.2)
        .attr("fill", (d: GraphNode) => TYPE_COLOR[d.type])
        .attr("stroke", "rgba(248,250,252,0.42)")
        .attr("stroke-width", 0.65)
        .attr("fill-opacity", 0.86);
      miniViewport = mini.append("rect")
        .attr("class", "minimap-viewport")
        .attr("rx", 2)
        .attr("ry", 2);
      const toMiniX = (x: number) =>
        MINI_PAD_X + ((x - miniBounds.minX) / Math.max(1, miniBounds.maxX - miniBounds.minX)) * MINI_INNER_W;
      const toMiniY = (y: number) =>
        MINI_PAD_TOP + ((y - miniBounds.minY) / Math.max(1, miniBounds.maxY - miniBounds.minY)) * MINI_INNER_H;
      const toWorldX = (mx: number) =>
        miniBounds.minX + ((mx - MINI_PAD_X) / MINI_INNER_W) * Math.max(1, miniBounds.maxX - miniBounds.minX);
      const toWorldY = (my: number) =>
        miniBounds.minY + ((my - MINI_PAD_TOP) / MINI_INNER_H) * Math.max(1, miniBounds.maxY - miniBounds.minY);
      const fallbackPoint = (n: GraphNode, i: number) => {
        const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
        const nx = Number.isFinite(n.x as number) ? (n.x as number) : undefined;
        const ny = Number.isFinite(n.y as number) ? (n.y as number) : undefined;
        return {
          x: nx ?? (width / 2 + Math.cos(a) * 120),
          y: ny ?? (height / 2 + Math.sin(a) * 90),
        };
      };
      const updateMini = () => {
        if (!miniLinksSel || !miniNodesSel) return;
        const points = nodes.map((n, i) => fallbackPoint(n, i)).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        const pointById = new Map<string, { x: number; y: number }>();
        nodes.forEach((n, i) => pointById.set(n.id, fallbackPoint(n, i)));
        if (!points.length) return;
        miniLinksSel
          .attr("x1", l => {
            const sId = getNodeId(l.source);
            return toMiniX((pointById.get(sId) ?? points[0]).x);
          })
          .attr("y1", l => {
            const sId = getNodeId(l.source);
            return toMiniY((pointById.get(sId) ?? points[0]).y);
          })
          .attr("x2", l => {
            const tId = getNodeId(l.target);
            return toMiniX((pointById.get(tId) ?? points[0]).x);
          })
          .attr("y2", l => {
            const tId = getNodeId(l.target);
            return toMiniY((pointById.get(tId) ?? points[0]).y);
          })
          .attr("stroke-opacity", l => Math.max(0.18, defOp(l) * 2.1));
        miniNodesSel
          .attr("cx", n => toMiniX((pointById.get(n.id) ?? points[0]).x))
          .attr("cy", n => toMiniY((pointById.get(n.id) ?? points[0]).y))
          .attr("r", n => Math.max(1.9, Math.min(4.2, (n.r ?? 10) * 0.14)));
      };
      const updateMiniViewport = () => {
        if (!miniViewport || !svgRef.current) return;
        const t = d3.zoomTransform(svgRef.current);
        const x0 = (0 - t.x) / t.k;
        const y0 = (0 - t.y) / t.k;
        const x1 = (width - t.x) / t.k;
        const y1 = (height - t.y) / t.k;
        const mx0 = toMiniX(x0);
        const my0 = toMiniY(y0);
        const mx1 = toMiniX(x1);
        const my1 = toMiniY(y1);
        const minX = MINI_PAD_X;
        const maxX = MINI_PAD_X + MINI_INNER_W;
        const minY = MINI_PAD_TOP;
        const maxY = MINI_PAD_TOP + MINI_INNER_H;
        const vx = Math.max(minX, Math.min(maxX, Math.min(mx0, mx1)));
        const vy = Math.max(minY, Math.min(maxY, Math.min(my0, my1)));
        const vw = Math.max(8, Math.min(maxX - vx, Math.abs(mx1 - mx0)));
        const vh = Math.max(8, Math.min(maxY - vy, Math.abs(my1 - my0)));
        miniViewport
          .attr("x", vx)
          .attr("y", vy)
          .attr("width", vw)
          .attr("height", vh);
      };
      miniViewport.call(
        d3.drag<SVGRectElement, unknown>()
          .on("drag", (e: d3.D3DragEvent<SVGRectElement, unknown, unknown>) => {
            if (!svgRef.current || !zoomRef.current || !miniViewport) return;
            const vw = Number(miniViewport.attr("width") || 0);
            const vh = Number(miniViewport.attr("height") || 0);
            const cxMini = e.x + vw / 2;
            const cyMini = e.y + vh / 2;
            const clampedX = Math.max(MINI_PAD_X, Math.min(MINI_PAD_X + MINI_INNER_W, cxMini));
            const clampedY = Math.max(MINI_PAD_TOP, Math.min(MINI_PAD_TOP + MINI_INNER_H, cyMini));
            const worldX = toWorldX(clampedX);
            const worldY = toWorldY(clampedY);
            const t = d3.zoomTransform(svgRef.current);
            const k = t.k;
            const next = d3.zoomIdentity
              .translate(width / 2 - k * worldX, height / 2 - k * worldY)
              .scale(k);
            d3.select(svgRef.current).call(zoomRef.current.transform, next);
          })
      );
      updateMiniViewportRef.current = updateMiniViewport;
      updateMiniFn = updateMini;
      updateMiniFn();
      updateMiniViewport();
    }

    // ── Force Simulation ──────────────────────────────────────────────────
    const clusterX: Partial<Record<string, number>> = { club: -0.28, company: 0.28, professor: -0.14, interest: 0.14, student: 0 };
    const clusterY: Partial<Record<string, number>> = { club: 0.1, company: 0.1, professor: -0.25, interest: -0.2, student: 0 };

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id((d: GraphNode) => d.id)
        .distance((d: d3.SimulationLinkDatum<GraphNode>) => {
          const s = d.source as GraphNode, t = d.target as GraphNode;
          const sHub = hubIds.has(s.id) || (degree[s.id] ?? 0) > HUB_BUNDLE_DEGREE;
          const tHub = hubIds.has(t.id) || (degree[t.id] ?? 0) > HUB_BUNDLE_DEGREE;
          if (sHub || tHub) return 202;
          return ["company", "club"].includes(s.type) || ["company", "club"].includes(t.type) ? 164 : 128;
        })
        .strength(0.4)
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength((d: GraphNode) =>
        d.type === "club" ? -980 : d.type === "company" ? -860 : d.type === "student" ? -760 : -640))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.03))
      .force("collision", d3.forceCollide<GraphNode>().radius((d: GraphNode) => (d.r ?? 12) + ((degree[d.id] ?? 0) > HUB_BUNDLE_DEGREE ? 22 : 16)).strength(0.92))
      .force("x", d3.forceX<GraphNode>((d: GraphNode) => width / 2 + (clusterX[d.type] ?? 0) * width).strength(0.038))
      .force("y", d3.forceY<GraphNode>((d: GraphNode) => height / 2 + (clusterY[d.type] ?? 0) * height).strength(0.038))
      .alphaDecay(0.028);

    const hubBundleForce = (alpha: number) => {
      nodes.forEach((n: GraphNode) => {
        const anchor = nodeBundleAnchor.get(n.id);
        if (!anchor) return;
        const hub = nodeById.get(anchor.hubId);
        if (!hub || hub.x == null || hub.y == null || n.x == null || n.y == null) return;
        const hubDeg = degree[anchor.hubId] ?? HUB_BUNDLE_DEGREE;
        const orbit = 54 + Math.min(58, hubDeg * 2.4);
        const angle = (anchor.idx / Math.max(1, anchor.total)) * Math.PI * 2;
        const tx = (hub.x as number) + Math.cos(angle) * orbit;
        const ty = (hub.y as number) + Math.sin(angle) * orbit;
        n.vx = (n.vx ?? 0) + (tx - n.x) * alpha * 0.08;
        n.vy = (n.vy ?? 0) + (ty - n.y) * alpha * 0.08;
      });
    };
    sim.force("hubBundle", hubBundleForce as d3.Force<GraphNode, GraphLink>);

    const ambientOrbitForce = (alpha: number) => {
      if (modeRef.current !== "free" || searchActiveRef.current || draggingNodeIdRef.current || demoMode) return;
      const cx = width / 2;
      const cy = height / 2;
      nodes.forEach((n: GraphNode) => {
        if (n.x == null || n.y == null) return;
        const dx = n.x - cx;
        const dy = n.y - cy;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const tangential = AMBIENT_ORBIT_SPEED * (0.35 + Math.min(1.2, dist / 380)) * (0.55 + alpha);
        n.vx = (n.vx ?? 0) + (-dy / dist) * tangential;
        n.vy = (n.vy ?? 0) + (dx / dist) * tangential;
      });
    };
    sim.force("ambientOrbit", ambientOrbitForce as d3.Force<GraphNode, GraphLink>);

    let tick = 0;
    sim.on("tick", () => {
      linkSel.attr("d", (d: GraphLink) => curvePathForLink(d));
      nodeSel.attr("transform", (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      if (modeRef.current === "path" && svgRef.current) {
        d3.select(svgRef.current)
          .selectAll<SVGPathElement, unknown>(".path-overlay path")
          .attr("d", function () {
            const sourceId = this.getAttribute("data-source-id");
            const targetId = this.getAttribute("data-target-id");
            if (!sourceId || !targetId) return this.getAttribute("d") ?? "";
            const source = nodesRef.current.find((n) => n.id === sourceId);
            const target = nodesRef.current.find((n) => n.id === targetId);
            if (!source || !target) return this.getAttribute("d") ?? "";
            return curvePathBetweenNodes(source, target);
          });
      }
      updateMiniFn?.();
      updateMiniViewportRef.current?.();

      if (modeRef.current === "free" && !hoveredNodeIdRef.current && !searchActiveRef.current) {
        const cx = width / 2;
        const cy = height / 2;
        const maxDist = Math.max(width, height) * 0.82;
        nodeSel.style("opacity", (n: GraphNode) => {
          const dx = (n.x ?? cx) - cx;
          const dy = (n.y ?? cy) - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const t = clamp01(dist / maxDist);
          return 1 - t * 0.34;
        });
        linkSel.attr("stroke-opacity", (l: GraphLink) => {
          const s = l.source as GraphNode;
          const t = l.target as GraphNode;
          const sx = s.x ?? cx;
          const sy = s.y ?? cy;
          const tx = t.x ?? cx;
          const ty = t.y ?? cy;
          const ds = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2);
          const dt = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
          const depthFactor = 1 - clamp01((ds + dt) / (maxDist * 2)) * 0.38;
          return defOp(l) * depthFactor;
        });
      }

      flickerTimeRef.current += 0.014;
      nodeSel.select<SVGCircleElement>("circle.main-circle")
        .attr("stroke-opacity", (n: GraphNode, i: number) => {
          const amp = NODE_FLICKER_SWING + ((n.id === selectedIdRef.current || n.id === user?.id) ? NODE_FLICKER_HIGHLIGHT_BONUS : 0);
          const wave = Math.sin(flickerTimeRef.current + i * 0.53);
          return clamp01(NODE_FLICKER_BASE + wave * amp);
        });

      // ── Edge pulse update ──────────────────────────────────────────────
      // CONSTANTS (tweak here):
      // particles animate via requestAnimationFrame loop

      // One-time intro flyover: show whole graph, then zoom to current user node
      if (!introDoneRef.current && user?.id && zoomRef.current && svgRef.current && ++tick > 45) {
        const allNodes = nodesRef.current.filter(n => n.x != null && n.y != null);
        if (!allNodes.length) return;

        const resolvedUserNode = resolveCurrentUserNode(nodesRef.current, user);
        const userNode = resolvedUserNode && resolvedUserNode.x != null && resolvedUserNode.y != null
          ? resolvedUserNode
          : null;
        if (!userNode) {
          if (!introDebugRef.current.waitingForNodeLogged) {
            introDebugRef.current.waitingForNodeLogged = true;
            // TEMP DEBUG: remove once intro focus is stable.
            console.info("[CampusGraph/intro] waiting for current user node with coordinates", {
              authUserId: user.id,
              resolvedNodeId: resolvedUserNode?.id ?? null,
              resolvedNodeLabel: resolvedUserNode?.label ?? null,
              resolvedHasXY: Boolean(resolvedUserNode && resolvedUserNode.x != null && resolvedUserNode.y != null),
              readyNodeCount: allNodes.length,
            });
          }
          return;
        }

        introDoneRef.current = true;
        const { w, h } = getGraphViewportDims();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        allNodes.forEach(n => {
          const x = n.x as number, y = n.y as number;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        });

        const dx = maxX - minX || 1;
        const dy = maxY - minY || 1;
        const scaleFit = 0.85 / Math.max(dx / w, dy / h);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const fitTransform = d3.zoomIdentity
          .translate(w / 2 - scaleFit * midX, h / 2 - scaleFit * midY)
          .scale(scaleFit);

        const scaleUser = 1.6;
        const userTransform = d3.zoomIdentity
          .translate(w / 2 - scaleUser * (userNode.x as number), h / 2 - scaleUser * (userNode.y as number))
          .scale(scaleUser);

        const zoomBehavior = zoomRef.current;
        const svgSel = d3.select(svgRef.current);
        if (!introDebugRef.current.introStartedLogged) {
          introDebugRef.current.introStartedLogged = true;
          // TEMP DEBUG: remove once intro focus is stable.
          console.info("[CampusGraph/intro] starting intro flyover to current user", {
            targetNodeId: userNode.id,
            targetNodeLabel: userNode.label,
            targetX: userNode.x,
            targetY: userNode.y,
            fitScale: scaleFit,
            userScale: scaleUser,
            viewport: { w, h },
          });
        }

        svgSel
          .transition()
          .duration(1500)
          .ease(d3.easeCubicInOut)
          .call(zoomBehavior!.transform, fitTransform)
          .transition()
          .duration(1500)
          .ease(d3.easeCubicInOut)
          .call(zoomBehavior!.transform, userTransform)
          .on("end", () => {
            setIntroFocusReady(true);
            // TEMP DEBUG: remove once intro focus is stable.
            console.info("[CampusGraph/intro] intro transition finished");
          });
      }
    });

    nodeSelRef.current = nodeSel;
    linkSelRef.current = linkSel as d3.Selection<SVGPathElement, GraphLink, SVGGElement, unknown>;
    simRef.current = sim;
    pulseLayerRef.current = pulseLayer;
    rippleLayerRef.current = rippleLayer;
    setD3Ready(true);

    const applyCursorAwareness = (gx: number, gy: number) => {
      if (modeRef.current !== "free" || draggingNodeIdRef.current || hoveredNodeIdRef.current) return;
      const radius = 170;
      const radiusSq = radius * radius;
      nodeSel.select<SVGCircleElement>("circle.main-circle")
        .attr("fill-opacity", (n: GraphNode) => {
          const dx = (n.x ?? 0) - gx;
          const dy = (n.y ?? 0) - gy;
          const distSq = dx * dx + dy * dy;
          if (distSq >= radiusSq) return n.id === user?.id ? 1 : 0.9;
          const t = 1 - Math.sqrt(distSq) / radius;
          return (n.id === user?.id ? 1 : 0.9) + t * 0.13;
        });
      linkSel.attr("stroke-opacity", (l: GraphLink) => {
        const s = l.source as GraphNode;
        const t = l.target as GraphNode;
        const sx = s.x ?? 0;
        const sy = s.y ?? 0;
        const tx = t.x ?? 0;
        const ty = t.y ?? 0;
        const d1 = (sx - gx) * (sx - gx) + (sy - gy) * (sy - gy);
        const d2 = (tx - gx) * (tx - gx) + (ty - gy) * (ty - gy);
        const proximity = 1 - clamp01(Math.sqrt(Math.min(d1, d2)) / radius);
        return defOp(l) * (1 + proximity * 0.65);
      });
    };

    svg.on("mousemove.aware", (e: MouseEvent) => {
      if (!svgRef.current || !zoomRef.current) return;
      if (modeRef.current !== "free" || draggingNodeIdRef.current) return;
      const [mx, my] = d3.pointer(e, svgRef.current);
      const currentTransform = d3.zoomTransform(svgRef.current);
      const gx = (mx - currentTransform.x) / currentTransform.k;
      const gy = (my - currentTransform.y) / currentTransform.k;
      applyCursorAwareness(gx, gy);
    });

    svg.on("mouseleave.aware", () => {
      if (modeRef.current !== "free" || draggingNodeIdRef.current) return;
      nodeSel.select<SVGCircleElement>("circle.main-circle")
        .attr("fill-opacity", (n: GraphNode) => n.id === user?.id ? 1 : 0.9);
      linkSel.attr("stroke-opacity", (l: GraphLink) => defOp(l));
    });

    svg.on("click", () => {
      setEdgeExplain(null);
      if (modeRef.current !== "free") deselectAll();
    });

    const timer = setTimeout(() => sim.alpha(0.05).restart(), 3200);
    let resizeObserver: ResizeObserver | null = null;
    const onResize = () => {
      const { w, h } = getGraphViewportDims();
      dimsRef.current = { w, h };
      sim.force("center", d3.forceCenter(w / 2, h / 2).strength(0.04)).alpha(0.3).restart();
      updateMiniViewportRef.current?.();
    };
    window.addEventListener("resize", onResize);
    if (typeof ResizeObserver !== "undefined" && svgRef.current) {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(svgRef.current);
    }

    return () => {
      setD3Ready(false);
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
      if (inertiaRafRef.current) cancelAnimationFrame(inertiaRafRef.current);
      if (particleRafRef.current) cancelAnimationFrame(particleRafRef.current);
      if (demoTimerRef.current) {
        window.clearTimeout(demoTimerRef.current);
        demoTimerRef.current = null;
      }
      activeParticles.forEach(p => p.el.remove());
      activeParticles.length = 0;
      pulseLayerRef.current = null;
      rippleLayerRef.current = null;
      labelSelRef.current = null;
      updateMiniViewportRef.current = null;
      visibleLinksRef.current = [];
      sim.stop();
      svg.selectAll("*").remove();
    };
  }, [nodes, links, loading, error, user, getGraphViewportDims]); // eslint-disable-line

  // ── Path Mode Effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "path" || pathNodeIds.length < 2) return;
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    if (!nodeSel || !linkSel || !svgRef.current) return;

    const pathSet = new Set(pathNodeIds);
    fitToNodeIds(pathNodeIds, 900);

    // Dim everything not on the path
    nodeSel.transition().duration(500)
      .style("opacity", (n: GraphNode) => pathSet.has(n.id) ? 1 : 0.06)
      .style("pointer-events", (n: GraphNode) => pathSet.has(n.id) ? "all" : "none");
    nodeSel.select<SVGCircleElement>("circle.main-circle")
      .attr("filter", (n: GraphNode) => pathSet.has(n.id) ? "url(#glow-soft)" : null);
    fadeLabels((n: GraphNode) => (pathSet.has(n.id) ? 1 : 0), 500);
    // Dim all existing edges — path edges are drawn as overlay to bypass hub-suppression
    linkSel.transition().duration(500).attr("stroke-opacity", 0.02);

    // Draw path edges as fresh overlay elements (bypasses hub-suppression filtering)
    const graphRoot = d3.select(svgRef.current).select<SVGGElement>(".graph-root");
    const overlay = graphRoot.append("g").attr("class", "path-overlay");

    let step = 0;
    const interval = setInterval(() => {
      if (step >= pathNodeIds.length - 1) { clearInterval(interval); return; }
      const aId = pathNodeIds[step];
      const bId = pathNodeIds[step + 1];
      const aNode = nodesRef.current.find(n => n.id === aId);
      const bNode = nodesRef.current.find(n => n.id === bId);
      if (aNode && bNode) {
        const pathD = curvePathBetweenNodes(aNode, bNode);
        const el = overlay.append("path")
          .attr("d", pathD)
          .attr("data-source-id", aId)
          .attr("data-target-id", bId)
          .attr("fill", "none")
          .attr("stroke", "#e879f9")
          .attr("stroke-width", 2.5)
          .attr("filter", "url(#glow-path)")
          .attr("stroke-opacity", 0);
        const len = (el.node() as SVGPathElement)?.getTotalLength() || 200;
        el.attr("stroke-dasharray", len)
          .attr("stroke-dashoffset", len)
          .transition().duration(520).ease(d3.easeLinear)
          .attr("stroke-dashoffset", 0)
          .attr("stroke-opacity", 0.95);
      }
      step++;
    }, 560);

    return () => {
      clearInterval(interval);
      overlay.remove();
    };
  }, [mode, pathNodeIds, fadeLabels, fitToNodeIds]);

  // ── Filter Effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    nodeSelRef.current?.style("display", (d: GraphNode) => hiddenTypes.has(d.type) ? "none" : null);
    linkSelRef.current?.style("display", (l: GraphLink) => {
      const s = nodes.find(n => n.id === getNodeId(l.source));
      const t = nodes.find(n => n.id === getNodeId(l.target));
      return s && t && (hiddenTypes.has(s.type) || hiddenTypes.has(t.type)) ? "none" : null;
    });
  }, [hiddenTypes, nodes]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as GraphNode[];
    return nodes.filter((n) =>
      n.label.toLowerCase().includes(q) ||
      Object.values(n.details || {}).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [nodes, searchQuery]);

  // ── Search Effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "free") { searchActiveRef.current = false; return; }
    if (multiSelectedIds.size > 0) return;
    searchActiveRef.current = Boolean(searchQuery.trim());
    if (!searchQuery.trim()) {
      nodeSelRef.current?.transition().duration(200).style("opacity", 1);
      linkSelRef.current?.transition().duration(180).attr("stroke-opacity", (l: GraphLink) => defOp(l));
      fadeLabels(currentZoomKRef.current > 1.7 ? 1 : LABEL_OPACITY_BASE, 140);
      return;
    }
    const matches = new Set(searchMatches.map((n) => n.id));
    nodeSelRef.current?.transition().duration(200)
      .style("opacity", (d: GraphNode) => matches.has(d.id) ? 1 : 0.07);
    linkSelRef.current?.transition().duration(180)
      .attr("stroke-opacity", (l: GraphLink) => {
        const sId = getNodeId(l.source);
        const tId = getNodeId(l.target);
        const sMatch = matches.has(sId);
        const tMatch = matches.has(tId);
        if (sMatch && tMatch) return Math.max(defOp(l), 0.42);
        if (sMatch || tMatch) return Math.max(defOp(l) * 0.28, 0.08);
        return 0.02;
      });
    fadeLabels((d: GraphNode) => (matches.has(d.id) ? 1 : 0), 120);
  }, [searchQuery, searchMatches, mode, fadeLabels, multiSelectedIds.size]);

  const userConnCount = useMemo(() =>
    links.filter(l =>
      getNodeId(l.source) === user?.id || getNodeId(l.target) === user?.id
    ).length,
    [links, user?.id]);

  const visibleTypeCounts = useMemo(() => ({
    students: nodes.filter(n => n.type === "student" && !hiddenTypes.has(n.type)).length,
    organizations: nodes.filter(n => n.type === "club" && !hiddenTypes.has(n.type)).length,
    companies: nodes.filter(n => n.type === "company" && !hiddenTypes.has(n.type)).length,
  }), [hiddenTypes, nodes]);

  const reachableCompanies = useMemo(() => {
    const fromId = selectedNode?.id ?? user?.id;
    if (!fromId) return [] as GraphNode[];

    const adjacency = new Map<string, Set<string>>();
    for (const l of links) {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      if (!adjacency.has(s)) adjacency.set(s, new Set());
      if (!adjacency.has(t)) adjacency.set(t, new Set());
      adjacency.get(s)!.add(t);
      adjacency.get(t)!.add(s);
    }

    const seen = new Set<string>([fromId]);
    const queue: string[] = [fromId];
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      const nbrs = adjacency.get(cur);
      if (!nbrs) continue;
      nbrs.forEach(next => {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }

    return nodes
      .filter(n => n.type === "company" && seen.has(n.id))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [links, nodes, selectedNode?.id, user?.id]);

  useEffect(() => {
    if (!companyQuery) return;
    const has = reachableCompanies.some(c => c.label.toLowerCase() === companyQuery.toLowerCase());
    if (!has) setCompanyQuery("");
  }, [companyQuery, reachableCompanies]);

  useEffect(() => {
    if (viewMode !== "2d" || mode !== "free") return;
    nodeSelRef.current
      ?.style("display", null)
      .style("opacity", 1)
      .style("pointer-events", "all");
    linkSelRef.current
      ?.style("display", null)
      .attr("stroke-opacity", (l: GraphLink) => defOp(l));
    fadeLabels(currentZoomKRef.current > 1.7 ? 1 : LABEL_OPACITY_BASE, 120);
  }, [viewMode, mode, fadeLabels]);

  useEffect(() => {
    const walkthrough2DActive = demoMode && viewMode === "2d";
    const updateOverlaySafeZones = () => {
      const root = rootRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const minimap2D = root.querySelector<HTMLElement>(".minimap:not(.minimap--hidden)");
      const minimap3D = root.querySelector<HTMLElement>(".spatialMinimap");
      const walkthroughPanel = root.querySelector<HTMLElement>(".walkthroughMiniPanel");
      const minimapEl = walkthrough2DActive ? walkthroughPanel : (viewMode === "3d" ? minimap3D : minimap2D);
      if (!minimapEl) {
        setOverlaySafeRight(20);
        setOverlayNoFlyRect(null);
        return;
      }
      const mm = minimapEl.getBoundingClientRect();
      const noFly = {
        x: mm.left - rootRect.left - OVERLAY_SAFE_MARGIN,
        y: mm.top - rootRect.top - OVERLAY_SAFE_MARGIN,
        w: mm.width + OVERLAY_SAFE_MARGIN * 2,
        h: mm.height + OVERLAY_SAFE_MARGIN * 2,
      };
      setOverlayNoFlyRect(noFly);
      setOverlaySafeRight(Math.max(20, rootRect.right - mm.left + OVERLAY_SAFE_MARGIN));
    };

    updateOverlaySafeZones();
    window.addEventListener("resize", updateOverlaySafeZones);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && rootRef.current) {
      observer = new ResizeObserver(updateOverlaySafeZones);
      observer.observe(rootRef.current);
    }
    return () => {
      window.removeEventListener("resize", updateOverlaySafeZones);
      observer?.disconnect();
    };
  }, [viewMode, selectedNode?.id, demoMode, mode]);

  useEffect(() => {
    if (!import.meta.env.DEV || !selectedNode) return;
    const root = rootRef.current;
    if (!root) return;
    const runScan = () => {
      const blocks = Array.from(
        root.querySelectorAll<HTMLElement>(
          ".minimap:not(.minimap--hidden), .walkthroughMiniPanel, .insightCard, .modeHint--path, .modeHint--demoControls, .compareDock, .edgeExplainCard, .legend, .tcPreview"
        )
      )
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 2 && rect.height > 2 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01;
        })
        .map((el, idx) => {
          const rect = el.getBoundingClientRect();
          const cls = [...el.classList].join(".");
          return { idx, name: cls || el.tagName.toLowerCase(), rect };
        });

      const overlaps: Array<{ a: string; b: string }> = [];
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i].rect;
          const b = blocks[j].rect;
          const overlap = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          if (overlap) overlaps.push({ a: blocks[i].name, b: blocks[j].name });
        }
      }
      console.info("[CampusGraph/overlay-scan] selected node overlays", {
        selectedNodeId: selectedNode.id,
        selectedNodeLabel: selectedNode.label,
        blocks: blocks.map((b) => ({ name: b.name, x: Math.round(b.rect.left), y: Math.round(b.rect.top), w: Math.round(b.rect.width), h: Math.round(b.rect.height) })),
        overlaps,
      });
    };
    const raf = requestAnimationFrame(runScan);
    return () => cancelAnimationFrame(raf);
  }, [selectedNode?.id, viewMode, demoMode, mode, pathNodeIds.length, overlaySafeRight]);

  const selectNodeFromSpatial = useCallback((id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    setDemoMode(false);
    setDemoStep(0);
    demoAppliedStepRef.current = -1;
    setDemoMessage("");
    setPathNodeIds([]);
    setPathStatus("idle");
    setCompanyQuery("");
    setMultiSelectedIds(new Set());
    selectedIdRef.current = n.id;
    setSelectedNode(n);
    setMode("locked");
    setSpatialFocusNodeIds([n.id]);
  }, [nodes]);

  const handleSearchEnter = useCallback(() => {
    if (searchMatches.length !== 1) return;
    const target = searchMatches[0];
    if (viewMode === "3d") {
      selectNodeFromSpatial(target.id);
      return;
    }
    selectNodeFn(target);
  }, [searchMatches, viewMode, selectNodeFromSpatial, selectNodeFn]);

  const handleSpatialBackgroundClick = useCallback(() => {
    setEdgeExplain(null);
    if (modeRef.current !== "free") {
      deselectAll();
    }
  }, [deselectAll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setEdgeExplain(null);
      if (multiSelectedIds.size) setMultiSelectedIds(new Set());
      if (demoMode) {
        setDemoMode(false);
        setDemoStep(0);
        setDemoMessage("");
        if (demoTimerRef.current) {
          window.clearTimeout(demoTimerRef.current);
          demoTimerRef.current = null;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [multiSelectedIds.size, demoMode]);

  useEffect(() => {
    return () => {
      if (focusRafRef.current) {
        cancelAnimationFrame(focusRafRef.current);
        focusRafRef.current = null;
      }
    };
  }, []);

  const multiSelectedNodes = useMemo(
    () => nodes.filter(n => multiSelectedIds.has(n.id)),
    [nodes, multiSelectedIds]
  );

  const comparisonData = useMemo(() => {
    if (multiSelectedNodes.length !== 2) return null;
    const [nodeA, nodeB] = multiSelectedNodes;
    const neighborsA = new Set<string>();
    const neighborsB = new Set<string>();
    const linkClassByKey = new Map<string, "shared" | "a" | "b">();
    const sharedNeighborIds = new Set<string>();

    links.forEach((l) => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      const key = edgePairKey(s, t);

      if (s === nodeA.id && t === nodeB.id) {
        linkClassByKey.set(key, "shared");
        return;
      }
      if (s === nodeB.id && t === nodeA.id) {
        linkClassByKey.set(key, "shared");
        return;
      }
      if (s === nodeA.id) neighborsA.add(t);
      if (t === nodeA.id) neighborsA.add(s);
      if (s === nodeB.id) neighborsB.add(t);
      if (t === nodeB.id) neighborsB.add(s);
    });

    [...neighborsA].forEach((id) => {
      if (neighborsB.has(id)) sharedNeighborIds.add(id);
    });
    const uniqueAIds = new Set([...neighborsA].filter((id) => !sharedNeighborIds.has(id) && id !== nodeB.id));
    const uniqueBIds = new Set([...neighborsB].filter((id) => !sharedNeighborIds.has(id) && id !== nodeA.id));

    links.forEach((l) => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      const key = edgePairKey(s, t);
      if (linkClassByKey.has(key)) return;

      const touchesA = s === nodeA.id || t === nodeA.id;
      const touchesB = s === nodeB.id || t === nodeB.id;
      const otherFromA = s === nodeA.id ? t : t === nodeA.id ? s : "";
      const otherFromB = s === nodeB.id ? t : t === nodeB.id ? s : "";

      if ((touchesA && sharedNeighborIds.has(otherFromA)) || (touchesB && sharedNeighborIds.has(otherFromB))) {
        linkClassByKey.set(key, "shared");
        return;
      }
      if (touchesA && uniqueAIds.has(otherFromA)) {
        linkClassByKey.set(key, "a");
        return;
      }
      if (touchesB && uniqueBIds.has(otherFromB)) {
        linkClassByKey.set(key, "b");
      }
    });

    return {
      nodeA,
      nodeB,
      sharedNeighborIds,
      uniqueAIds,
      uniqueBIds,
      linkClassByKey,
    };
  }, [links, multiSelectedNodes]);

  const multiSummary = useMemo(() => {
    if (!multiSelectedNodes.length) return null;
    const selectedIds = new Set(multiSelectedNodes.map(n => n.id));
    const commonNeighborCounts = new Map<string, number>();
    const perNodeNeighbors = new Map<string, Set<string>>();

    multiSelectedNodes.forEach(n => perNodeNeighbors.set(n.id, new Set()));
    links.forEach(l => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      if (selectedIds.has(s) && !selectedIds.has(t)) perNodeNeighbors.get(s)?.add(t);
      if (selectedIds.has(t) && !selectedIds.has(s)) perNodeNeighbors.get(t)?.add(s);
    });
    perNodeNeighbors.forEach(neighbors => {
      neighbors.forEach(id => commonNeighborCounts.set(id, (commonNeighborCounts.get(id) ?? 0) + 1));
    });

    const sharedNeighborIds = [...commonNeighborCounts.entries()]
      .filter(([, c]) => c >= Math.min(2, multiSelectedNodes.length))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => id);

    const sharedMajors = new Set(
      multiSelectedNodes
        .map(n => String(n.details?.major ?? "").trim())
        .filter(Boolean)
    );

    return {
      selectedCount: multiSelectedNodes.length,
      sharedNeighbors: sharedNeighborIds.map(id => nodes.find(n => n.id === id)?.label).filter(Boolean) as string[],
      majorHint: sharedMajors.size === 1 ? [...sharedMajors][0] : "",
      uniqueCompanies: new Set(
        multiSelectedNodes.flatMap(n =>
          links
            .filter(l => (getNodeId(l.source) === n.id || getNodeId(l.target) === n.id))
            .map(l => {
              const other = getNodeId(l.source) === n.id ? getNodeId(l.target) : getNodeId(l.source);
              const on = nodes.find(x => x.id === other);
              return on?.type === "company" ? on.label : "";
            })
            .filter(Boolean)
        )
      ).size,
    };
  }, [links, multiSelectedNodes, nodes]);

  useEffect(() => {
    if (!nodeSelRef.current || !linkSelRef.current) return;
    if (!multiSelectedIds.size || mode !== "free") {
      nodeSelRef.current.classed("node-multi-selected", false);
      nodeSelRef.current
        .classed("node-compare-shared", false)
        .classed("node-compare-a", false)
        .classed("node-compare-b", false);
      linkSelRef.current
        .classed("link-multi-focus", false)
        .classed("link-compare-shared", false)
        .classed("link-compare-a", false)
        .classed("link-compare-b", false);
      return;
    }

    const selectedIds = new Set(multiSelectedIds);
    const unionNeighbors = new Set<string>(selectedIds);
    links.forEach(l => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      if (selectedIds.has(s)) unionNeighbors.add(t);
      if (selectedIds.has(t)) unionNeighbors.add(s);
    });

    const compare = comparisonData;
    const sharedIds = compare?.sharedNeighborIds ?? new Set<string>();
    const uniqueAIds = compare?.uniqueAIds ?? new Set<string>();
    const uniqueBIds = compare?.uniqueBIds ?? new Set<string>();
    const nodeAId = compare?.nodeA.id ?? "";
    const nodeBId = compare?.nodeB.id ?? "";

    nodeSelRef.current
      .style("opacity", (n: GraphNode) => {
        if (selectedIds.has(n.id)) return 1;
        if (sharedIds.has(n.id)) return 0.92;
        if (uniqueAIds.has(n.id) || uniqueBIds.has(n.id)) return 0.74;
        if (unionNeighbors.has(n.id)) return 0.52;
        return 0.09;
      })
      .classed("node-multi-selected", (n: GraphNode) => selectedIds.has(n.id))
      .classed("node-compare-shared", (n: GraphNode) => sharedIds.has(n.id))
      .classed("node-compare-a", (n: GraphNode) => n.id === nodeAId || uniqueAIds.has(n.id))
      .classed("node-compare-b", (n: GraphNode) => n.id === nodeBId || uniqueBIds.has(n.id));

    linkSelRef.current
      .attr("stroke-opacity", (l: GraphLink) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        const cls = compare?.linkClassByKey.get(edgePairKey(s, t));
        if (cls === "shared") return 0.95;
        if (cls === "a" || cls === "b") return 0.76;
        if (selectedIds.has(s) || selectedIds.has(t)) return 0.5;
        return 0.05;
      })
      .classed("link-multi-focus", (l: GraphLink) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        return selectedIds.has(s) || selectedIds.has(t);
      })
      .classed("link-compare-shared", (l: GraphLink) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        return compare?.linkClassByKey.get(edgePairKey(s, t)) === "shared";
      })
      .classed("link-compare-a", (l: GraphLink) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        return compare?.linkClassByKey.get(edgePairKey(s, t)) === "a";
      })
      .classed("link-compare-b", (l: GraphLink) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        return compare?.linkClassByKey.get(edgePairKey(s, t)) === "b";
      });

    fadeLabels((n: GraphNode) => selectedIds.has(n.id) || unionNeighbors.has(n.id) ? 1 : 0, 160);
  }, [multiSelectedIds, links, mode, fadeLabels, comparisonData]);

  useEffect(() => {
    if (mode !== "free" && multiSelectedIds.size) setMultiSelectedIds(new Set());
  }, [mode, multiSelectedIds.size]);

  const stopDemoMode = useCallback(() => {
    setDemoMode(false);
    setDemoStep(0);
    demoAppliedStepRef.current = -1;
    setDemoMessage("");
    setSpatialFocusNodeIds([]);
    setPathNodeIds([]);
    setPathStatus("idle");
    setCompanyQuery("");
    setSelectedNode(null);
    selectedIdRef.current = null;
    setMode("free");
    exitToFree();
    if (demoTimerRef.current) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
  }, [exitToFree]);

  const startDemoMode = useCallback(() => {
    stopDemoMode();
    setEdgeExplain(null);
    setHiddenTypes(new Set());
    setPathNodeIds([]);
    setPathStatus("idle");
    setMultiSelectedIds(new Set());
    setMode("free");
    setSelectedNode(null);
    selectedIdRef.current = null;
    setSpatialFocusNodeIds([]);
    exitToFree();
    setDemoMode(true);
    setDemoStep(0);
    demoAppliedStepRef.current = -1;
    setDemoMessage("Step 1/4 · Focus on your profile node");
  }, [exitToFree, stopDemoMode]);
  useEffect(() => {
    if (!demoMode) return;
    if (demoAppliedStepRef.current === demoStep) return;
    demoAppliedStepRef.current = demoStep;

    const userNode = currentUserNode;
    if (!userNode) {
      setDemoMessage("Walkthrough unavailable: current profile node is not present in this graph.");
      return;
    }
    const userNeighbors = topNeighbors(userNode, 8);
    const contextNeighbors = userNeighbors
      .filter((n) => n.type === "club" || n.type === "interest")
      .slice(0, 3);
    const demoCompany = reachableCompanies[0];

    if (demoStep === 0 && userNode) {
      setDemoMessage("Step 1/4 - Focus on your profile node");
      if (viewMode === "3d") {
        selectedIdRef.current = userNode.id;
        setSelectedNode(userNode);
        setMode("locked");
        setSpatialFocusNodeIds([userNode.id]);
      } else {
        selectNodeFn(userNode, true);
      }
      return;
    }
    if (demoStep === 1 && userNode) {
      setDemoMessage("Step 2/4 - Nearby clubs and interests reveal your network context");
      const focusIds = [userNode.id, ...(contextNeighbors.length ? contextNeighbors : userNeighbors.slice(0, 2)).map((n) => n.id)];
      if (viewMode === "3d") {
        setSpatialFocusNodeIds(focusIds);
      } else {
        fitToNodeIds(focusIds, 900);
      }
      return;
    }
    if (demoStep === 2 && demoCompany) {
      setDemoMessage(`Step 3/4 - Trace strongest path to ${demoCompany.label}`);
      setCompanyQuery(demoCompany.label);
      if (viewMode === "3d") {
        setSpatialFocusNodeIds(userNode ? [userNode.id, demoCompany.id] : [demoCompany.id]);
      }
      void findPath(demoCompany.label);
      return;
    }
    if (demoStep === 3) {
      setDemoMessage("Step 4/4 - Path insight: your network has a credible route to this opportunity");
      if (viewMode === "3d" && pathNodeIds.length) {
        setSpatialFocusNodeIds(pathNodeIds);
      }
    }
  }, [demoMode, demoStep, currentUserNode, topNeighbors, reachableCompanies, selectNodeFn, fitToNodeIds, findPath, viewMode, pathNodeIds]);

  const demoBack = useCallback(() => {
    setDemoStep((s) => Math.max(0, s - 1));
  }, []);

  const demoNext = useCallback(() => {
    setDemoStep((s) => Math.min(DEMO_TOTAL_STEPS - 1, s + 1));
  }, []);

  const demoRestart = useCallback(() => {
    demoAppliedStepRef.current = -1;
    setDemoStep(0);
  }, []);

  useEffect(() => {
    if (!demoMode || viewMode !== "3d") return;
    if (demoStep < 2 || !pathNodeIds.length) return;
    setSpatialFocusNodeIds(pathNodeIds);
  }, [demoMode, demoStep, pathNodeIds, viewMode]);

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="root">
      <div className="errorState">
        <span>⚠️</span><p>Failed to load graph: {error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const modeLabel =
    mode === "locked" ? "Focus mode" :
      mode === "path" ? "Path mode" :
        "Explore mode";

  const modeDescription =
    mode === "locked"
      ? "You are focused on one node and its strongest campus connections."
      : mode === "path"
        ? `Tracing the shortest visible path from your network to ${companyQuery || "a company"}.`
        : "Explore students, organizations, and companies.";
  const walkthroughLayout2D = demoMode && viewMode === "2d";
  const walkthroughInsightNode = selectedNode ?? currentUserNode;
  const walkthroughTargetCompany = companyQuery || reachableCompanies[0]?.label || "a target company";

  const edgeExplainStyle = useMemo(() => {
    if (!edgeExplain || !rootRef.current) return undefined;
    const rootRect = rootRef.current.getBoundingClientRect();
    const cardW = 320;
    const cardH = 170;
    const minX = 14;
    const minY = 14;
    const maxX = Math.max(minX, rootRect.width - cardW - 14);
    const maxY = Math.max(minY, rootRect.height - cardH - 14);
    let x = edgeExplain.x - rootRect.left + 10;
    let y = edgeExplain.y - rootRect.top + 10;
    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));
    const zone = overlayNoFlyRect;
    if (zone) {
      const overlapX = x < zone.x + zone.w && x + cardW > zone.x;
      const overlapY = y < zone.y + zone.h && y + cardH > zone.y;
      if (overlapX && overlapY) {
        const leftOption = Math.max(minX, zone.x - cardW - OVERLAY_SAFE_MARGIN);
        const belowOption = Math.min(maxY, zone.y + zone.h + OVERLAY_SAFE_MARGIN);
        if (leftOption >= minX) x = leftOption;
        else y = belowOption;
      }
    }
    return { left: `${x}px`, top: `${y}px` };
  }, [edgeExplain, overlayNoFlyRect]);

  return (
    <div className="root" ref={rootRef}>

      {/* Intro animation overlay — renders on top while graph loads underneath */}
      {!introComplete && <NetworkIntro onComplete={handleIntroComplete} />}

      <div className="graphHeader">
        <div className="graphHeaderCopy">
          <span className="graphEyebrow">Campus Connections</span>
          <h1 className="graphTitle">Campus Network</h1>
          <p className="graphSubtitle">{modeDescription}</p>
        </div>

        <div className="graphHeaderMeta">
          <div className="viewModeToggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`viewModeBtn${viewMode === "2d" ? " viewModeBtn--active" : ""}`}
              onClick={() => {
                if (demoMode) stopDemoMode();
                setViewMode("2d");
              }}
            >
              2D
            </button>
            <button
              type="button"
              className={`viewModeBtn${viewMode === "3d" ? " viewModeBtn--active" : ""}`}
              onClick={() => {
                stopDemoMode();
                setViewMode("3d");
              }}
            >
              2.5D Spatial
            </button>
          </div>
          <button
            type="button"
            className={`graphDemoBtn${demoMode ? " graphDemoBtn--active" : ""}`}
            onClick={() => demoMode ? stopDemoMode() : startDemoMode()}
          >
            {demoMode ? "Exit Walkthrough" : "Start Walkthrough"}
          </button>
          <span className={`graphModeBadge graphModeBadge--${mode}`}>{modeLabel}</span>
          <span className="graphHeaderChip">
            <strong>{userConnCount}</strong>
            <span>connections</span>
          </span>
          {mode === "locked" && selectedNode && (
            <span className="graphHeaderChip graphHeaderChip--focus">
              <span>Focused on</span>
              <strong>{selectedNode.label}</strong>
            </span>
          )}
          {mode !== "free" && (
            <button type="button" className="graphExitBtn" onClick={deselectAll}>
              Back to explore
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <SearchBar value={searchQuery} onChange={setSearchQuery} onEnter={handleSearchEnter} />
        <FilterBar hiddenTypes={hiddenTypes} onToggleType={toggleType} />
        {multiSelectedIds.size > 0 && (
          <button type="button" className="graphClearBtn" onClick={() => setMultiSelectedIds(new Set())}>
            Clear Multi-Select ({multiSelectedIds.size})
          </button>
        )}
        <div className="pathSearchWrap">
          <select
            className="pathSearchSelect"
            value={companyQuery}
            onChange={(e) => {
              setCompanyQuery(e.target.value);
              setPathStatus("idle");
              setPathNodeIds([]);
            }}
            disabled={pathStatus === "searching" || reachableCompanies.length === 0}
          >
            <option value="">
              {reachableCompanies.length ? "Select reachable company" : "No reachable companies"}
            </option>
            {reachableCompanies.map((company) => (
              <option key={company.id} value={company.label}>
                {company.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pathSearchBtn"
            disabled={!companyQuery || pathStatus === "searching"}
            onClick={() => {
              stopDemoMode();
              void findPath();
            }}
          >
            {pathStatus === "searching" ? "Tracing..." : "Trace Path"}
          </button>
        </div>
        {pathStatus === "notfound" && (
          <span className="pathMsg pathMsg--err">No valid path found</span>
        )}

        <div className="toolbarStats">
          <span><b>{visibleTypeCounts.students}</b> students</span>
          <span><b>{visibleTypeCounts.organizations}</b> orgs</span>
          <span><b>{visibleTypeCounts.companies}</b> companies</span>
        </div>
      </div>

      {/* Main */}
      <div className="main">
        <div className="bgGlow" ref={bgGlowRef} />
        <svg id="graph-svg" ref={svgRef} style={{ flex: 1 }} className={viewMode === "3d" ? "graph2DHidden" : "graph2DVisible"} />
        <div className={`graph3DWrap${viewMode === "3d" ? " graph3DWrap--active" : ""}`}>
          <Graph3DGlobeView
            active={viewMode === "3d"}
            nodes={nodes}
            links={links}
            hiddenTypes={hiddenTypes}
            searchQuery={searchQuery}
            selectedNodeId={selectedNode?.id ?? null}
            pathNodeIds={pathNodeIds}
            focusNodeIds={spatialFocusNodeIds}
            focusTriggerKey={`${demoMode ? "demo" : "idle"}-${demoStep}-${mode}-${pathNodeIds.join(">")}`}
            onSelectNode={selectNodeFromSpatial}
            onBackgroundClick={handleSpatialBackgroundClick}
          />
        </div>
        <svg
          className={`minimap${viewMode === "2d" && !walkthroughLayout2D ? "" : " minimap--hidden"}`}
          ref={minimapRef}
          style={{ right: selectedNode ? "304px" : "20px" }}
        />
        {walkthroughLayout2D && (
          <div className="walkthroughMiniPanel">
            <div className="walkthroughMiniTitle">Opportunity Insights</div>
            <div className="walkthroughMiniLine">
              Focus: <b>{walkthroughInsightNode?.label ?? "Current profile"}</b>
            </div>
            <div className="walkthroughMiniLine">
              Reach path target: <b>{walkthroughTargetCompany}</b>
            </div>
            <div className="walkthroughMiniLine">
              Status: {pathNodeIds.length > 1 ? `Path found in ${pathNodeIds.length - 1} hops` : "Preparing walkthrough route"}
            </div>
          </div>
        )}
        <SidePanel
          node={selectedNode}
          nodes={nodes}
          links={links}
          onClose={deselectAll}
          onSelectNode={id => { const n = nodes.find(x => x.id === id); if (n) selectNodeFn(n); }}
        />
        {!walkthroughLayout2D && (
          <>
            <Legend />
            <TopConnected
              nodes={nodes}
              links={links}
              currentUserId={user?.id ?? ""}
              onSelectNode={id => { const n = nodes.find(x => x.id === id); if (n) selectNodeFn(n); }}
            />
          </>
        )}
        {multiSummary && !comparisonData && (
          <div className="insightCard insightCard--multi" style={{ left: "50px", right: "auto", top: "20px", bottom: "auto" }}>
            <div className="insightTitle">Multi-Select Insights</div>
            <div className="insightLine">{multiSummary.selectedCount} nodes selected</div>
            {multiSummary.majorHint && <div className="insightLine">Shared major: {multiSummary.majorHint}</div>}
            <div className="insightLine">Unique connected companies: {multiSummary.uniqueCompanies}</div>
            {!!multiSummary.sharedNeighbors.length && (
              <div className="insightLine">Shared connectors: {multiSummary.sharedNeighbors.slice(0, 3).join(", ")}</div>
            )}
          </div>
        )}
        {comparisonData && (
          <div className="compareDock">
            <div className="compareDockTitle">
              Compare: {comparisonData.nodeA.label} vs {comparisonData.nodeB.label}
            </div>
            <div className="compareGrid">
              <div className="compareChip compareChip--shared">
                <span className="compareSwatch compareSwatch--shared" />
                Shared {comparisonData.sharedNeighborIds.size}
              </div>
              <div className="compareChip compareChip--a">
                <span className="compareSwatch compareSwatch--a" />
                {comparisonData.nodeA.label} only {comparisonData.uniqueAIds.size}
              </div>
              <div className="compareChip compareChip--b">
                <span className="compareSwatch compareSwatch--b" />
                {comparisonData.nodeB.label} only {comparisonData.uniqueBIds.size}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Locked Mode overlay hint */}
      {mode === "locked" && (
        <div className={`modeHint${viewMode === "2d" && !walkthroughLayout2D ? " modeHint--lockedShift" : ""}`}>
          Showing up to {MAX_NEIGHBORS} strongest connections
          &nbsp;·&nbsp;<span>click background to exit</span>
        </div>
      )}
      {mode === "path" && pathNodeIds.length > 0 && (
        <div className="modeHint modeHint--path">
          Path found · {pathNodeIds.length - 1} hop{pathNodeIds.length !== 2 ? "s" : ""} to reach <b>{companyQuery}</b>
          &nbsp;·&nbsp;<span>click background to exit</span>
        </div>
      )}

      {/* Node hover card — fixed to cursor, only in free mode */}
      {demoMode && (
        <div className="modeHint modeHint--demo modeHint--demoControls">
          <span>Guided Demo · {demoMessage}</span>
          <button type="button" className="modeHintBtn" onClick={demoBack} disabled={demoStep === 0}>Back</button>
          <button type="button" className="modeHintBtn" onClick={demoNext} disabled={demoStep >= DEMO_TOTAL_STEPS - 1}>Next</button>
          <button type="button" className="modeHintBtn" onClick={demoRestart}>Restart</button>
          <button type="button" className="modeHintBtn modeHintBtn--exit" onClick={stopDemoMode}>Exit</button>
        </div>
      )}
      {hoverCard && mode === "free" && (
        <HoverCard node={hoverCard.node} x={hoverCard.x} y={hoverCard.y} />
      )}
      {edgeExplain && (
        <div
          className="edgeExplainCard"
          style={edgeExplainStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="edgeExplainTitle">Why this connection exists</div>
          {edgeExplain.reasons.map((r, i) => (
            <div key={i} className="edgeExplainLine">• {r}</div>
          ))}
        </div>
      )}
    </div>
  );
}

