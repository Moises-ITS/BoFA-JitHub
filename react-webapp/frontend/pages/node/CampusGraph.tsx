/// <reference types="vite/client" />
// ─────────────────────────────────────────────────────────────────────────────
// CampusGraph.tsx  —  Locked / Free / Path mode graph explorer
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Flame } from "lucide-react";
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
import { useAuth } from "../../context/AuthContext";
import { NetworkIntro } from "../../components/NetworkTransition";
import CampusNavbar from "../../components/CampusNavbar";
import Graph3DGlobeView from "./components/Graph3DGlobeView";
import "./CampusGraph.css";

const API = import.meta.env.VITE_API_URL ?? "";
const MAX_NEIGHBORS = 9;
const HUB_MAX = 6;
const EDGE_WIDTH_MIN = 1.1;
const EDGE_WIDTH_MAX = 3.9;
const LABEL_FADE_MS = 180;
const NODE_FLICKER_BASE = 0.84;
const NODE_FLICKER_SWING = 0.08;
const NODE_FLICKER_HIGHLIGHT_BONUS = 0.03;
const FIT_PADDING = 96;
const FIT_MIN_SCALE = 0.42;
const FIT_MAX_SCALE = 2.35;
const DEMO_TOTAL_STEPS = 4;
const AMBIENT_ORBIT_SPEED = 0.00062;
const HUB_BUNDLE_DEGREE = 5;
const MINIMAP_W = 190;
const MINIMAP_H = 130;
const FLOW_ACTIVE_MIN = 4;
const FLOW_ACTIVE_MAX = 10;
const OVERLAY_SAFE_MARGIN = 12;
const LOCKED_VIEWPORT_COVERAGE = 0.86;
const LOCKED_FIT_MIN_SCALE = 0.24;
const GRAPH_MOTION = {
  nodePulse: {
    scaleMin: 0.01,
    scaleMax: 0.052,
    glowSwing: 0.2,
    periodMsMin: 2600,
    periodMsMax: 5200,
  },
  nodeTypeProfile: {
    student: { scaleMul: 1.02, speedMul: 1.02, glowMul: 1, flicker: 0.026 },
    company: { scaleMul: 0.78, speedMul: 0.88, glowMul: 1.2, flicker: 0.012 },
    club: { scaleMul: 1.12, speedMul: 1.05, glowMul: 1.02, flicker: 0.032 },
    interest: { scaleMul: 1.2, speedMul: 1.2, glowMul: 0.96, flicker: 0.06 },
    professor: { scaleMul: 0.9, speedMul: 0.94, glowMul: 1.02, flicker: 0.02 },
  },
  core: {
    pulseScale: 0.14,
    glowLift: 0.32,
    waveSpeed: 0.00145,
    neighborRadiusPx: 290,
    neighborScale: 0.042,
    neighborGlow: 0.16,
  },
  field: {
    coreOpacityBase: 0.22,
    coreOpacitySwing: 0.24,
    densityOpacity: 0.32,
    driftPx: 16,
    updateLerp: 0.08,
  },
  satellites: {
    maxPerNode: 3,
    radiusMin: 12,
    radiusMax: 22,
    speedMin: 0.00045,
    speedMax: 0.00078,
    opacity: 0.62,
  },
  hover: {
    nodeScale: 0.11,
    neighborScale: 0.03,
    unrelatedOpacity: 0.18,
    edgeOpacity: 0.96,
    neighborEdgeOpacity: 0.1,
    edgeWidthMul: 1.28,
  },
  magnetic: {
    radius: 190,
    maxOffsetPx: 2.8,
    auraOffsetMul: 1.22,
  },
  tension: {
    hoverCurveTension: 0.62,
  },
  snap: {
    settleOvershoot: 1.032,
    settleInMs: 520,
    settleSnapMs: 140,
    settleBackMs: 180,
  },
  parallax: {
    ambientLayerMul: 0.008,
    farMul: 0.15,
    midMul: 0.3,
    nearMul: 0.5,
  },
  clickBurst: {
    nodeSpikeScale: 0.16,
    edgeRiseOpacity: 0.92,
    edgeStaggerMs: 58,
    neighborStaggerMs: 42,
    settleMs: 520,
  },
  premium: {
    hoverMs: 150,
    localWakeMs: 220,
    selectCompressMs: 96,
    selectReleaseMs: 320,
    panelDelayMs: 140,
  },
  selected: {
    pulseScale: 0.048,
    pulseSpeedMul: 1.34,
    glowLift: 0.2,
    neighborGlowLift: 0.08,
  },
  ambientEdge: {
    strengthThreshold: 0.24,
    driftAmplitude: 0.24,
    driftSpeedMin: 0.0002,
    driftSpeedMax: 0.0004,
    activeRatio: 0.74,
  },
  cohorts: {
    nodeCount: 4,
    edgeCount: 3,
  },
  depth: {
    foregroundScale: 1.12,
    foregroundGlow: 0.18,
    backgroundScale: 0.9,
    backgroundDim: 0.16,
    edgeForegroundLift: 0.16,
    edgeBackgroundDrop: 0.1,
  },
  edgeFlow: {
    visibleMin: FLOW_ACTIVE_MIN,
    visibleMax: FLOW_ACTIVE_MAX,
  },
  microActivation: {
    minIntervalMs: 1900,
    maxIntervalMs: 4300,
    nodeCountMin: 1,
    nodeCountMax: 3,
    durationMs: 1100,
    intensity: 0.24,
  },
  idle: {
    timeoutMsMin: 4200,
    timeoutMsMax: 6200,
    hintDurationMs: 1700,
    hintCooldownMsMin: 4600,
    hintCooldownMsMax: 7800,
    opportunityDurationMs: 1100,
    opportunityIntervalMsMin: 9200,
    opportunityIntervalMsMax: 14800,
    scanIntervalMsMin: 23000,
    scanIntervalMsMax: 36000,
    cascadeIntervalMinMs: 5000,
    cascadeIntervalMaxMs: 9000,
    cascadeNodeMin: 3,
    cascadeNodeMax: 5,
    cascadeEdgeMin: 2,
    cascadeEdgeMax: 4,
    cascadeStepMs: 140,
  },
  cluster: {
    baseOpacity: 0.1,
    breathOpacitySwing: 0.12,
    radiusBase: 124,
    radiusSpreadFactor: 0.18,
  },
  labels: {
    fadeMs: 180,
  },
  signature: {
    ignitionStepMs: 120,
    ignitionNodeLift: 0.26,
    ignitionEdgeLift: 0.22,
    fullPulseMs: 520,
    fullPulseNodeOpacity: 1,
    fullPulseEdgeOpacity: 0.74,
  },
};

type GraphMode = "free" | "locked" | "path";
type MotionTier = "full" | "balanced" | "performance";

const getInitialMotionTier = (nodeCount: number, linkCount: number, reducedMotion: boolean): MotionTier => {
  if (reducedMotion) return "performance";
  const complexity = nodeCount + linkCount * 0.65;
  if (complexity > 520) return "performance";
  if (complexity > 260) return "balanced";
  return "full";
};

const MOTION_PROFILE: Record<MotionTier, {
  flowMin: number;
  flowMax: number;
  activeNodeCohorts: number;
  activeEdgeCohorts: number;
  heavyTickDiv: number;
  pointerThrottleMs: number;
  magneticRadiusMul: number;
  ambientDampenOnInteraction: number;
}> = {
  full: {
    flowMin: FLOW_ACTIVE_MIN,
    flowMax: 8,
    activeNodeCohorts: 4,
    activeEdgeCohorts: 3,
    heavyTickDiv: 1,
    pointerThrottleMs: 16,
    magneticRadiusMul: 1,
    ambientDampenOnInteraction: 0.55,
  },
  balanced: {
    flowMin: 3,
    flowMax: 6,
    activeNodeCohorts: 3,
    activeEdgeCohorts: 2,
    heavyTickDiv: 2,
    pointerThrottleMs: 24,
    magneticRadiusMul: 0.88,
    ambientDampenOnInteraction: 0.38,
  },
  performance: {
    flowMin: 3,
    flowMax: 4,
    activeNodeCohorts: 2,
    activeEdgeCohorts: 1,
    heavyTickDiv: 3,
    pointerThrottleMs: 34,
    magneticRadiusMul: 0.72,
    ambientDampenOnInteraction: 0.26,
  },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const edgeStrength = (l: GraphLink) => clamp01(((l.weight ?? 0.5) * 0.74) + ((l.opacity ?? 0.65) * 0.26));
const edgeTierFromStrength = (s: number) => s >= 0.78 ? 1 : s >= 0.48 ? 2 : 3;
const edgeWidthFromStrength = (s: number) => EDGE_WIDTH_MIN + easeInOut(s) * (EDGE_WIDTH_MAX - EDGE_WIDTH_MIN);
const edgeOpacityFromStrength = (s: number) => 0.04 + easeInOut(s) * 0.26;
const edgePairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const isCompanyRel = (rel: string) => rel === "WORKS_AT" || rel === "WORKED_AT";
const edgeDashForLink = (l: GraphLink) => {
  // Company links should always be visually primary and solid.
  if (isCompanyRel(l.rel)) return null;
  return (l.style === "dashed" || l.rel === "INTERESTED_IN") ? "5,4" : null;
};
const edgeStrokeColorForLink = (l: GraphLink) => {
  if (l.rel === "CONNECTED_TO") return "#8b5cf6";
  if (isCompanyRel(l.rel)) return "#93c5fd";
  if (l.rel === "MEMBER_OF" || l.rel === "SAME_MAJOR") return "#58789b";
  if (l.rel === "INTERESTED_IN") return "#4a647e";
  return null;
};
const edgeWidthForLink = (l: GraphLink) => {
  const base = edgeWidthFromStrength(edgeStrength(l));
  if (l.rel === "CONNECTED_TO" || isCompanyRel(l.rel)) return base + 0.7;
  if (l.rel === "MEMBER_OF" || l.rel === "SAME_MAJOR") return Math.max(0.85, base * 0.82);
  if (l.rel === "INTERESTED_IN") return Math.max(0.75, base * 0.74);
  return base;
};

const lockedOrbitRadiusForConnections = (count: number) => {
  const clamped = Math.max(0, count);
  if (clamped <= 0) return 104;
  const minRadius = 118;
  const grown = minRadius + Math.sqrt(clamped) * 20;
  return Math.min(300, grown);
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
  const lift = Math.max(30, dist * 0.28);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 - lift;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
};

const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase();
const normalizeSearchName = (v: unknown) => normalize(v).replace(/[^a-z0-9]/g, "");

const resolveCurrentUserNode = (
  nodes: GraphNode[],
  user: { id?: string; email?: string; name?: string; major?: string } | null
) => {
  if (!user) return null;
  const userId = normalize(user.id);
  const userEmail = normalize(user.email);
  const userEmailLocalPart = userEmail.includes("@") ? userEmail.split("@")[0] : "";
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
      details.email,
    ];
    return candidates.some((c) => {
      const value = normalize(c);
      return value && (value === userId || value === userEmail || value === userEmailLocalPart);
    });
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

  const nameTokens = userName.split(/\s+/).filter(Boolean);
  const scored = nodes
    .filter((n) => n.type === "student")
    .map((n) => {
      const details = (n.details ?? {}) as Record<string, unknown>;
      const label = normalize(n.label);
      const detailName = normalize(details.name);
      const detailMajor = normalize(details.major);
      let score = 0;
      if (userEmailLocalPart && (label.includes(userEmailLocalPart) || detailName.includes(userEmailLocalPart))) score += 5;
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

  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { nodes, links, loading, error } = useGraphData();
  const [introComplete, setIntroComplete] = useState(true);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<GraphMode>("free");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<NodeType>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [pathNodeIds, setPathNodeIds] = useState<string[]>([]);
  const [pathStatus, setPathStatus] = useState<"idle" | "searching" | "found" | "notfound">("idle");
  const [visibleCount, setVisibleCount] = useState(0);
  const [hoverCard, setHoverCard] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [d3Ready, setD3Ready] = useState(false);
  const [graphSettling, setGraphSettling] = useState(true);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());

  // Lens mode removed: keep ref hard-disabled so legacy branches stay inactive.
  const lensModeRef = useRef(false);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const heatmapModeRef = useRef(false);
  useEffect(() => { heatmapModeRef.current = heatmapMode; }, [heatmapMode]);
  const lensPosRef = useRef<{ x: number, y: number } | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoMessage, setDemoMessage] = useState<string>("");
  const viewMode: "2d" = "2d";
  const [motionTier, setMotionTier] = useState<MotionTier>("balanced");
  const [spatialFocusNodeIds, setSpatialFocusNodeIds] = useState<string[]>([]);
  const [edgeExplain, setEdgeExplain] = useState<{ link: GraphLink; reasons: string[]; x: number; y: number } | null>(null);
  const [overlaySafeRight, setOverlaySafeRight] = useState(20);
  const [overlayNoFlyRect, setOverlayNoFlyRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const currentUserNode = useMemo(
    () => resolveCurrentUserNode(nodes, user),
    [nodes, user]
  );
  const currentUserNodeId = currentUserNode?.id ?? user?.id ?? null;
  const perfTierOverride = useMemo(() => {
    const raw = (searchParams.get("perf") ?? "").toLowerCase();
    if (raw === "full" || raw === "balanced" || raw === "performance") return raw as MotionTier;
    return null;
  }, [searchParams]);
  const perfDebug = useMemo(() => searchParams.get("perfDebug") === "1", [searchParams]);
  const ambientSpecks = useMemo(() => {
    type Speck = { id: string; x: number; y: number; size: number; opacity: number; twinkle: boolean };
    const makeLayer = (prefix: string, count: number, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${prefix}-${i}`,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: minSize + Math.random() * (maxSize - minSize),
        opacity: minOpacity + Math.random() * (maxOpacity - minOpacity),
        twinkle: Math.random() < 0.22,
      })) as Speck[];
    return {
      far: makeLayer("far", 20, 0.8, 1.35, 0.18, 0.34),
      mid: makeLayer("mid", 18, 1, 1.7, 0.22, 0.42),
      near: makeLayer("near", 16, 1.1, 2.1, 0.26, 0.5),
    };
  }, []);

  // ── D3 Refs ───────────────────────────────────────────────────────────────
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bgGlowRef = useRef<HTMLDivElement>(null);
  const ambientFxRef = useRef<HTMLDivElement>(null);
  const ambientFarRef = useRef<HTMLDivElement>(null);
  const ambientMidRef = useRef<HTMLDivElement>(null);
  const ambientNearRef = useRef<HTMLDivElement>(null);
  const ambientGrainRef = useRef<HTMLDivElement>(null);
  const energyCoreRef = useRef<HTMLDivElement>(null);
  const energyDensityRef = useRef<HTMLDivElement>(null);
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
  const searchMatchesRef = useRef<Set<string>>(new Set());
  const dimsRef = useRef({ w: 900, h: 600 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // ── Pan inertia refs ──────────────────────────────────────────────────────
  const inertiaRafRef = useRef<number | null>(null);
  const inertiaDeltaRef = useRef({ dx: 0, dy: 0 });
  const lastZoomXRef = useRef<number | null>(null);
  const lastZoomYRef = useRef<number | null>(null);
  const demoTimerRef = useRef<number | null>(null);
  const selectionCommitTimerRef = useRef<number | null>(null);
  const searchMessageTimerRef = useRef<number | null>(null);
  const demoAppliedStepRef = useRef<number>(-1);
  const draggingNodeIdRef = useRef<string | null>(null);
  const dragNeighborhoodRef = useRef<Set<string>>(new Set());
  const particleRafRef = useRef<number | null>(null);
  const updateMiniViewportRef = useRef<(() => void) | null>(null);
  const focusRafRef = useRef<number | null>(null);
  const scanSweepRef = useRef<HTMLDivElement>(null);
  const viewModeRef = useRef<"2d" | "3d">("2d");
  const demoModeRef = useRef(false);
  const multiSelectedCountRef = useRef(0);
  const lastInteractionAtRef = useRef(0);
  const idleTimeoutAtRef = useRef(0);
  const heavyInteractionUntilRef = useRef(0);
  const motionTierRef = useRef<MotionTier>("balanced");
  const pointerAwareRafRef = useRef<number | null>(null);
  const pointerAwareLastTsRef = useRef(0);
  const pointerAwarePendingRef = useRef<{ x: number; y: number } | null>(null);
  const motionDebugTsRef = useRef(0);
  const parallaxPanRef = useRef({
    densityX: 0,
    densityY: 0,
    coreX: 0,
    coreY: 0,
  });

  // ── Clear hover card when leaving free mode ───────────────────────────────
  useEffect(() => { if (mode !== "free") setHoverCard(null); }, [mode]);
  useEffect(() => { setEdgeExplain(null); }, [mode, selectedNode?.id, pathNodeIds.length]);

  // ── Stable-ref callbacks (avoids D3 setup re-running on mode changes) ─────
  const modeRef = useRef<GraphMode>("free");
  const selectedIdRef = useRef<string | null>(null);
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { linksRef.current = links; }, [links]);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const pathNodeIdsRef = useRef<string[]>([]);
  const searchActiveRef = useRef(false);
  const currentZoomKRef = useRef(1);
  const flickerTimeRef = useRef(0);
  useEffect(() => { pathNodeIdsRef.current = pathNodeIds; }, [pathNodeIds]);
  useEffect(() => { hiddenTypesRef.current = hiddenTypes; }, [hiddenTypes]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { demoModeRef.current = demoMode; }, [demoMode]);
  useEffect(() => { multiSelectedCountRef.current = multiSelectedIds.size; }, [multiSelectedIds.size]);
  useEffect(() => { motionTierRef.current = motionTier; }, [motionTier]);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const autoTier = getInitialMotionTier(nodes.length, links.length, reducedMotion);
    const next = perfTierOverride ?? (autoTier === "full" ? "balanced" : autoTier);
    setMotionTier(next);
    motionTierRef.current = next;
  }, [nodes.length, links.length, perfTierOverride]);
  useEffect(() => {
    if (loading) {
      setGraphSettling(true);
      return;
    }
    if (!nodes.length) setGraphSettling(false);
  }, [loading, nodes.length]);
  useEffect(() => {
    setIntroComplete(true);
  }, [user?.id, nodes.length]);

  const noteInteraction = useCallback(() => {
    const now = performance.now();
    lastInteractionAtRef.current = now;
    idleTimeoutAtRef.current = now + GRAPH_MOTION.idle.timeoutMsMin + Math.random() * (GRAPH_MOTION.idle.timeoutMsMax - GRAPH_MOTION.idle.timeoutMsMin);
  }, []);
  const markHeavyInteraction = useCallback((ms = 420) => {
    const now = performance.now();
    heavyInteractionUntilRef.current = Math.max(heavyInteractionUntilRef.current, now + ms);
    noteInteraction();
  }, [noteInteraction]);
  const showSearchMessage = useCallback((message: string) => {
    setSearchMessage(message);
    if (searchMessageTimerRef.current) {
      window.clearTimeout(searchMessageTimerRef.current);
      searchMessageTimerRef.current = null;
    }
    searchMessageTimerRef.current = window.setTimeout(() => {
      setSearchMessage("");
      searchMessageTimerRef.current = null;
    }, 1800);
  }, []);
  useEffect(() => {
    noteInteraction();
  }, [noteInteraction]);
  useEffect(() => () => {
    if (searchMessageTimerRef.current) {
      window.clearTimeout(searchMessageTimerRef.current);
      searchMessageTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!introComplete) return;
    markHeavyInteraction(560);
  }, [searchQuery, companyQuery, introComplete, markHeavyInteraction]);

  useEffect(() => {
    const onKey = () => noteInteraction();
    window.addEventListener("keydown", onKey, { passive: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [noteInteraction]);

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

  const triggerNeuralEcho = useCallback((n: GraphNode) => {
    if (!svgRef.current) return;

    // 1. Audio Synthesis (Subtle Synapse Tick)
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
        setTimeout(() => ctx.close(), 200);
      }
    } catch (e) { /* ignore audio errors */ }

    // 2. Shockwave Visuals
    const currentTransform = d3.zoomTransform(svgRef.current);
    const screenX = (n.x ?? 0) * currentTransform.k + currentTransform.x;
    const screenY = (n.y ?? 0) * currentTransform.k + currentTransform.y;

    const wave = document.createElement("div");
    wave.className = "neuralEchoShockwave";
    wave.style.left = `${screenX}px`;
    wave.style.top = `${screenY}px`;
    rootRef.current?.appendChild(wave);
    setTimeout(() => wave.remove(), 1000);

    // 3. UI Momentum (Jitter)
    const header = document.querySelector(".graphHeader");
    const toolbar = document.querySelector(".toolbar");
    header?.classList.add("uiPulse");
    toolbar?.classList.add("uiPulse");
    setTimeout(() => {
      header?.classList.remove("uiPulse");
      toolbar?.classList.remove("uiPulse");
    }, 200);
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
    const radialPad = neighborCount > 0 ? 24 : 20;
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
    const snapScale = Math.min(FIT_MAX_SCALE, scale * GRAPH_MOTION.snap.settleOvershoot);
    const snapTransform = d3.zoomIdentity
      .translate(w / 2 - snapScale * sx, h / 2 - snapScale * sy)
      .scale(snapScale);

    const zoom = zoomRef.current;
    d3.select(svgRef.current)
      .interrupt()
      .transition()
      .duration(GRAPH_MOTION.snap.settleInMs || duration)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, transform)
      .transition()
      .duration(GRAPH_MOTION.snap.settleSnapMs)
      .ease(d3.easeCubicOut)
      .call(zoom.transform, snapTransform)
      .transition()
      .duration(GRAPH_MOTION.snap.settleBackMs)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, transform);
  }, [getGraphViewportDims]);

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

  const fadeLabels = useCallback((opacityGetter: number | ((n: GraphNode) => number), duration = GRAPH_MOTION.labels.fadeMs ?? LABEL_FADE_MS) => {
    const labels = labelSelRef.current;
    if (!labels) return;
    const getOpacity = typeof opacityGetter === "function" ? opacityGetter : () => opacityGetter;
    labels.interrupt().transition().duration(duration).style("opacity", (n: GraphNode) => clamp01(getOpacity(n)));
  }, []);
  const defaultLabelOpacity = useCallback((n: GraphNode) => {
    if (n.type === "interest") return 0.38;
    return n.id === currentUserNodeId ? 1 : 0.95;
  }, [currentUserNodeId]);

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

  const triggerScanSweep = useCallback(() => {
    const el = scanSweepRef.current;
    if (!el) return;
    el.classList.remove("graphScanSweep--active");
    // force reflow to restart CSS animation
    void el.offsetWidth;
    el.classList.add("graphScanSweep--active");
  }, []);

  const triggerFullSystemPulse = useCallback((centerId?: string | null) => {
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    const rippleLayer = rippleLayerRef.current;
    if (!nodeSel || !linkSel) return;
    const centerNode = centerId ? nodesRef.current.find((n) => n.id === centerId) : null;
    const cx = centerNode?.x ?? dimsRef.current.w / 2;
    const cy = centerNode?.y ?? dimsRef.current.h / 2;
    const el = ambientFxRef.current;
    if (el) {
      el.classList.remove("graphAmbientFx--systemPulse");
      void el.offsetWidth;
      el.classList.add("graphAmbientFx--systemPulse");
    }
    if (rippleLayer) {
      rippleLayer.append("circle")
        .attr("class", "system-pulse-ring")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", 18)
        .attr("stroke-opacity", 0.62)
        .attr("fill-opacity", 0.13)
        .transition()
        .duration(880)
        .ease(d3.easeCubicOut)
        .attr("r", Math.max(dimsRef.current.w, dimsRef.current.h) * 0.78)
        .attr("stroke-opacity", 0)
        .attr("fill-opacity", 0)
        .remove();
    }
    nodeSel.select<SVGCircleElement>("circle.main-circle")
      .interrupt("sig-pulse")
      .transition("sig-pulse")
      .duration(GRAPH_MOTION.signature.fullPulseMs)
      .attr("fill-opacity", (d: GraphNode) => d.id === centerId ? 1 : 0.95)
      .transition("sig-pulse")
      .duration(360)
      .attr("fill-opacity", (d: GraphNode) => d.id === currentUserNodeId ? 1 : 0.9);
    linkSel
      .interrupt("sig-pulse")
      .transition("sig-pulse")
      .duration(GRAPH_MOTION.signature.fullPulseMs)
      .attr("stroke-opacity", (l: GraphLink) => Math.max(edgeOpacityFromStrength(edgeStrength(l)), GRAPH_MOTION.signature.fullPulseEdgeOpacity))
      .transition("sig-pulse")
      .duration(380)
      .attr("stroke-opacity", (l: GraphLink) => edgeOpacityFromStrength(edgeStrength(l)));
  }, [currentUserNodeId]);

  const triggerOpportunityExplosion = useCallback((pathIds: string[]) => {
    if (!pathIds.length) return;
    const centerId = pathIds[pathIds.length - 1];
    triggerFullSystemPulse(centerId);
    const nodeSel = nodeSelRef.current;
    const rippleLayer = rippleLayerRef.current;
    const center = nodesRef.current.find((n) => n.id === centerId);
    if (nodeSel && center) {
      nodeSel
        .filter((n: GraphNode) => pathIds.includes(n.id))
        .select<SVGCircleElement>("circle.main-circle")
        .interrupt("opp-burst")
        .transition("opp-burst")
        .delay((n: GraphNode) => pathIds.indexOf(n.id) * 52)
        .duration(210)
        .attr("stroke-opacity", 1)
        .attr("fill-opacity", 1)
        .transition("opp-burst")
        .duration(460)
        .attr("fill-opacity", (n: GraphNode) => n.id === currentUserNodeId ? 1 : 0.9);
    }
    if (rippleLayer && center?.x != null && center?.y != null) {
      rippleLayer.append("circle")
        .attr("class", "opportunity-burst-ring")
        .attr("cx", center.x)
        .attr("cy", center.y)
        .attr("r", Math.max(10, (center.r ?? 12) * 0.7))
        .attr("stroke-opacity", 0.86)
        .attr("fill-opacity", 0.24)
        .transition()
        .duration(760)
        .ease(d3.easeCubicOut)
        .attr("r", (center.r ?? 12) + 96)
        .attr("stroke-opacity", 0)
        .attr("fill-opacity", 0)
        .remove();
    }
  }, [triggerFullSystemPulse, currentUserNodeId]);

  const playClickActivationBurst = useCallback((d: GraphNode) => {
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    const layer = rippleLayerRef.current;
    if (!nodeSel || !linkSel) return;
    const connectedIds = new Set<string>();
    const connectedLinks = (visibleLinksRef.current.length ? visibleLinksRef.current : linksRef.current)
      .filter((l) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        if (s === d.id) connectedIds.add(t);
        if (t === d.id) connectedIds.add(s);
        return s === d.id || t === d.id;
      })
      .sort((a, b) => edgeStrength(b) - edgeStrength(a))
      .slice(0, 14);

    const main = nodeSel
      .filter((n: GraphNode) => n.id === d.id)
      .select<SVGCircleElement>("circle.main-circle");
    main.interrupt()
      .transition()
      .duration(GRAPH_MOTION.premium.selectCompressMs)
      .ease(d3.easeCubicOut)
      .attr("r", (n: GraphNode) => (n.r ?? 12) * 0.96)
      .transition()
      .duration(Math.max(120, GRAPH_MOTION.premium.selectReleaseMs - 120))
      .ease(d3.easeCubicOut)
      .attr("r", (n: GraphNode) => (n.r ?? 12) * (1 + GRAPH_MOTION.clickBurst.nodeSpikeScale * 0.78))
      .attr("filter", "url(#glow-selected)")
      .transition()
      .duration(GRAPH_MOTION.premium.selectReleaseMs)
      .ease(d3.easeCubicInOut)
      .attr("r", (n: GraphNode) => n.r ?? 12);

    if (layer && d.x != null && d.y != null) {
      layer.append("circle")
        .attr("class", "node-ripple node-ripple--burst")
        .attr("cx", d.x)
        .attr("cy", d.y)
        .attr("r", Math.max(8, (d.r ?? 12) * 0.9))
        .attr("stroke-opacity", 0.74)
        .attr("fill-opacity", 0.2)
        .transition()
        .duration(760)
        .ease(d3.easeCubicOut)
        .attr("r", (d.r ?? 12) + 76)
        .attr("stroke-opacity", 0)
        .attr("fill-opacity", 0)
        .remove();
    }

    linkSel
      .filter((l: GraphLink) => connectedLinks.includes(l))
      .interrupt()
      .transition()
      .delay((l: GraphLink) => connectedLinks.indexOf(l) * GRAPH_MOTION.clickBurst.edgeStaggerMs)
      .duration(250)
      .attr("stroke-opacity", (l: GraphLink) => Math.max(GRAPH_MOTION.clickBurst.edgeRiseOpacity, edgeOpacityFromStrength(edgeStrength(l))))
      .transition()
      .duration(430)
      .attr("stroke-opacity", (l: GraphLink) => edgeOpacityFromStrength(edgeStrength(l)));

    nodeSel
      .filter((n: GraphNode) => connectedIds.has(n.id))
      .select<SVGCircleElement>("circle.main-circle")
      .interrupt()
      .transition()
      .delay((n: GraphNode, i: number) => i * GRAPH_MOTION.clickBurst.neighborStaggerMs)
      .duration(GRAPH_MOTION.premium.localWakeMs)
      .attr("fill-opacity", 0.98)
      .attr("stroke-opacity", 1)
      .transition()
      .duration(360)
      .attr("fill-opacity", 0.9)
      .attr("stroke-opacity", NODE_FLICKER_BASE);
  }, []);

  // ── Enter Locked Mode (Six-Degrees Gravity Shockwave) ─────────────────────
  const enterLocked = useCallback((d: GraphNode) => {
    const sim = simRef.current;
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    const rippleLayer = rippleLayerRef.current;
    if (!sim || !nodeSel || !linkSel || !rippleLayer) return;

    // SHOCKWAVE VISUAL
    if (d.x != null && d.y != null) {
      rippleLayer.append("circle")
        .attr("cx", d.x).attr("cy", d.y)
        .attr("r", 10)
        .attr("stroke", "#facc15")
        .attr("stroke-width", 6)
        .attr("fill", "none")
        .transition().duration(1400).ease(d3.easeCubicOut)
        .attr("r", Math.max(dimsRef.current.w, dimsRef.current.h) * 1.5)
        .attr("stroke-opacity", 0)
        .attr("stroke-width", 0)
        .remove();
    }

    const { w, h } = getGraphViewportDims();
    const cx = w / 2, cy = h / 2;
    const degree1 = directNeighbors(d);
    const d1Set = new Set(degree1.map(n => n.id));

    // Find degree 2 connections
    const d2Set = new Set<string>();
    const degree2: GraphNode[] = [];
    degree1.forEach(n1 => {
      const nbrs = directNeighbors(n1);
      nbrs.forEach(n2 => {
        if (n2.id !== d.id && !d1Set.has(n2.id) && !d2Set.has(n2.id)) {
          d2Set.add(n2.id);
          degree2.push(n2);
        }
      });
    });

    const orbitRadius1 = lockedOrbitRadiusForConnections(degree1.length);
    const orbitRadius2 = Math.min(600, orbitRadius1 * 2.4);
    const orbitBlast = orbitRadius1 * 8; // Blow unrelated nodes far off-screen

    // Move selected to center
    d.fx = cx; d.fy = cy;

    // 1st Degree Inner Orbit
    degree1.forEach((nb, i) => {
      const angle = (i / degree1.length) * 2 * Math.PI - Math.PI / 2;
      nb.fx = cx + orbitRadius1 * Math.cos(angle);
      nb.fy = cy + orbitRadius1 * Math.sin(angle);
    });

    // 2nd Degree Outer Orbit
    degree2.forEach((nb, i) => {
      const angle = (i / degree2.length) * 2 * Math.PI;
      nb.fx = cx + orbitRadius2 * Math.cos(angle);
      nb.fy = cy + orbitRadius2 * Math.sin(angle);
    });

    // Blast away the rest
    nodesRef.current.forEach(n => {
      if (n.id !== d.id && !d1Set.has(n.id) && !d2Set.has(n.id)) {
        const dx = (n.x ?? cx) - cx;
        const dy = (n.y ?? cy) - cy;
        const dist = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
        const ux = dx / dist;
        const uy = dy / dist;
        n.fx = cx + ux * orbitBlast;
        n.fy = cy + uy * orbitBlast;
      }
    });

    sim.alpha(0.85).restart();

    // Node visibility
    nodeSel.transition().duration(800).ease(d3.easeElasticOut.amplitude(1.2).period(0.6))
      .style("opacity", (n: GraphNode) => n.id === d.id || d1Set.has(n.id) ? 1 : d2Set.has(n.id) ? 0.65 : 0.05)
      .style("pointer-events", (n: GraphNode) => n.id === d.id || d1Set.has(n.id) || d2Set.has(n.id) ? "all" : "none");

    nodeSel
      .classed("node-selected-anchor", (n: GraphNode) => n.id === d.id)
      .classed("node-selected-neighbor", (n: GraphNode) => d1Set.has(n.id));

    nodeSel.select<SVGCircleElement>("circle.main-circle")
      .attr("filter", (n: GraphNode) => n.id === d.id ? "url(#glow-selected)" : (d1Set.has(n.id) || d2Set.has(n.id)) ? "url(#glow-soft)" : null)
      .transition().duration(800).ease(d3.easeElasticOut.amplitude(1.2).period(0.6))
      .attr("r", (n: GraphNode) => n.id === d.id ? (n.r ?? 12) * 1.8 : d1Set.has(n.id) ? (n.r ?? 12) * 1.15 : (n.r ?? 12) * 0.9);

    // Labels
    fadeLabels((n: GraphNode) => (
      n.id === d.id || d1Set.has(n.id) || d2Set.has(n.id) ? 1 : 0
    ), 600);

    // Edges
    linkSel.transition().duration(600).attr("stroke-opacity", (l: GraphLink) => {
      const s = getNodeId(l.source), t = getNodeId(l.target);
      const isInner = (s === d.id && d1Set.has(t)) || (t === d.id && d1Set.has(s));
      const isOuter = (d1Set.has(s) && d2Set.has(t)) || (d1Set.has(t) && d2Set.has(s));
      return isInner ? 0.95 : isOuter ? 0.35 : 0;
    });

    linkSel
      .filter((l: GraphLink) => {
        const s = getNodeId(l.source), t = getNodeId(l.target);
        return (s === d.id && d1Set.has(t)) || (t === d.id && d1Set.has(s));
      })
      .transition().duration(600)
      .attr("stroke", "#facc15")
      .attr("stroke-width", (l: GraphLink) => edgeWidthFromStrength(edgeStrength(l)) * 1.6)
      .attr("filter", "url(#glow-selected)");

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
    nodeSel.classed("node-selected-anchor", false).classed("node-selected-neighbor", false);

    nodeSel.select<SVGCircleElement>("circle.main-circle")
      .attr("filter", (n: GraphNode) => baseNodeFilterRef.current(n))
      .transition().duration(400)
      .attr("r", (n: GraphNode) => n.r ?? 12);

    fadeLabels(defaultLabelOpacity, 400);

    linkSel.transition().duration(400)
      .attr("stroke-opacity", (l: GraphLink) => defOp(l))
      .attr("stroke", (l: GraphLink) => edgeStrokeColorForLink(l))
      .attr("stroke-width", (l: GraphLink) => edgeWidthForLink(l))
      .attr("filter", null)
      .attr("stroke-dasharray", (l: GraphLink) => edgeDashForLink(l))
      .attr("stroke-dashoffset", null);
    linkSel.classed("link-hover-energized", false);

    d3.selectAll(".link.path-pulse").classed("path-pulse", false);
    d3.selectAll(".path-overlay").remove();
  }, []); // eslint-disable-line

  // ── Select / Deselect ─────────────────────────────────────────────────────
  const selectNodeFn = useCallback((d: GraphNode, fromDemo = false) => {
    noteInteraction();
    if (!fromDemo) {
      setDemoMode(false);
      setDemoStep(0);
      setDemoMessage("");
      if (demoTimerRef.current) {
        window.clearTimeout(demoTimerRef.current);
        demoTimerRef.current = null;
      }
    }
    playClickActivationBurst(d);
    triggerNeuralEcho(d);
    const localDegree = (visibleLinksRef.current.length ? visibleLinksRef.current : linksRef.current)
      .reduce((acc, l) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        return acc + ((s === d.id || t === d.id) ? 1 : 0);
      }, 0);
    if (localDegree >= 5 || d.type === "company" || fromDemo) {
      triggerFullSystemPulse(d.id);
    }
    spawnNodeRipple(d);
    setMultiSelectedIds(new Set());
    selectedIdRef.current = d.id;
    if (selectionCommitTimerRef.current) {
      window.clearTimeout(selectionCommitTimerRef.current);
      selectionCommitTimerRef.current = null;
    }
    selectionCommitTimerRef.current = window.setTimeout(() => {
      setSelectedNode(d);
      selectionCommitTimerRef.current = null;
    }, fromDemo ? 70 : GRAPH_MOTION.premium.panelDelayMs);
    setMode("locked");
    setPathNodeIds([]);
    setPathStatus("idle");
    setCompanyQuery("");
    d3.selectAll(".link.path-pulse").classed("path-pulse", false);
    d3.selectAll(".path-overlay").remove();
  }, [noteInteraction, playClickActivationBurst, spawnNodeRipple, triggerFullSystemPulse]);

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
    noteInteraction();
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
    if (selectionCommitTimerRef.current) {
      window.clearTimeout(selectionCommitTimerRef.current);
      selectionCommitTimerRef.current = null;
    }
    exitToFree();
  }, [exitToFree, noteInteraction]);

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
    // Reset the viewport to identity so the selected node's locked layout is visible.
    d3.select(svgRef.current)
      .interrupt()
      .transition().duration(600).ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, d3.zoomIdentity);

    setSearchParams({}, { replace: true });
  }, [searchParams, nodes, introComplete, d3Ready, selectNodeFn, setSearchParams]);

  // ── Company path search ───────────────────────────────────────────────────
  const findPath = useCallback(async (overrideLabel?: string) => {
    noteInteraction();
    const fromId = selectedIdRef.current ?? currentUserNodeId ?? user?.id;
    const queryLabel = overrideLabel ?? companyQuery;
    if (!fromId || !queryLabel.trim()) return;

    const target = nodesRef.current.find(
      n => n.type === "company" && n.label.toLowerCase() === queryLabel.toLowerCase()
    );
    if (!target) { setPathStatus("notfound"); return; }

    setPathStatus("searching");
    try {
      const res = await fetch(`${API}/api/graph/path?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(target.id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json() as { nodeIds: string[]; rels: string[] };
      if (!data.nodeIds?.length) { setPathStatus("notfound"); return; }
      setPathNodeIds(data.nodeIds);
      setPathStatus("found");
      setMode("path");
    } catch {
      setPathStatus("notfound");
    }
  }, [companyQuery, noteInteraction, user]);

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
    setGraphSettling(true);

    const rootEl = rootRef.current;
    const svg = d3.select(svgRef.current)
      .on("mousemove", (e: MouseEvent) => {
        if (lensModeRef.current) {
          const pt = d3.pointer(e, g.node());
          lensPosRef.current = { x: pt[0], y: pt[1] };
          if (simRef.current) simRef.current.alpha(Math.max(simRef.current.alpha(), 0.05)).restart();
        }
      })
      .on("mouseleave", () => {
        if (lensModeRef.current) {
          lensPosRef.current = null;
          if (simRef.current) simRef.current.alpha(Math.max(simRef.current.alpha(), 0.05)).restart();
        }
      });
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

    // ── Gooey Filter for Clusters (Organic Blobs) ──
    const goo = defs.append("filter").attr("id", "goo-blobs").attr("color-interpolation-filters", "sRGB");
    goo.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", 22).attr("result", "blur");
    goo.append("feColorMatrix").attr("in", "blur").attr("mode", "matrix").attr("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10").attr("result", "goo");
    goo.append("feComposite").attr("in", "SourceGraphic").attr("in2", "goo").attr("operator", "atop");

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
    const baseNodeFilter = (n: GraphNode) => {
      if (n.id === currentUserNodeId) return "url(#glow-selected)";
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
    const pickFlowLinkIndex = (allowedIndices?: number[]) => {
      if (allowedIndices && allowedIndices.length > 0) {
        let localTotal = 0;
        for (const idx of allowedIndices) localTotal += (flowWeights[idx] ?? 0);
        if (localTotal > 0) {
          let roll = Math.random() * localTotal;
          for (const idx of allowedIndices) {
            roll -= (flowWeights[idx] ?? 0);
            if (roll <= 0) return idx;
          }
          return allowedIndices[allowedIndices.length - 1];
        }
      }
      if (!flowLinks.length || flowWeightTotal <= 0) return -1;
      let roll = Math.random() * flowWeightTotal;
      for (let i = 0; i < flowWeights.length; i++) {
        roll -= flowWeights[i];
        if (roll <= 0) return i;
      }
      return flowWeights.length - 1;
    };
    const linkIndicesByNode = new Map<string, number[]>();
    const linkIndexByKey = new Map<string, number>();
    const simEdgeRanked = simLinks
      .map((l, i) => ({ i, strength: edgeStrength(l) }))
      .sort((a, b) => b.strength - a.strength)
      .map((x) => x.i);
    simLinks.forEach((l, i) => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      if (!linkIndicesByNode.has(s)) linkIndicesByNode.set(s, []);
      if (!linkIndicesByNode.has(t)) linkIndicesByNode.set(t, []);
      linkIndicesByNode.get(s)?.push(i);
      linkIndicesByNode.get(t)?.push(i);
      linkIndexByKey.set(edgePairKey(s, t), i);
    });
    const flowIndicesByNode = new Map<string, number[]>();
    const flowIndexByKey = new Map<string, number>();
    const flowEdgeRanked = flowLinks
      .map((l, i) => ({ i, strength: edgeStrength(l) }))
      .sort((a, b) => b.strength - a.strength)
      .map((x) => x.i);
    flowLinks.forEach((l, i) => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      if (!flowIndicesByNode.has(s)) flowIndicesByNode.set(s, []);
      if (!flowIndicesByNode.has(t)) flowIndicesByNode.set(t, []);
      flowIndicesByNode.get(s)?.push(i);
      flowIndicesByNode.get(t)?.push(i);
      flowIndexByKey.set(edgePairKey(s, t), i);
    });

    const g = svg.append("g").attr("class", "graph-root");

    // ── Zoom ──────────────────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 4])
      .wheelDelta((event: WheelEvent) => -event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025))
      // Soft boundary: prevent drifting into empty space more than 2× canvas
      .translateExtent([[-width * 2, -height * 2], [width * 3, height * 3]])
      .on("start.inertia", () => {
        markHeavyInteraction(520);
        // Instant interrupt: any new drag/pan cancels ongoing glide
        if (inertiaRafRef.current) cancelAnimationFrame(inertiaRafRef.current);
        inertiaRafRef.current = null;
        lastZoomXRef.current = null;
        lastZoomYRef.current = null;
        inertiaDeltaRef.current = { dx: 0, dy: 0 };
      })
      .on("zoom", (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (e.sourceEvent) markHeavyInteraction(360);
        g.attr("transform", e.transform.toString());
        currentZoomKRef.current = e.transform.k;
        if (bgGlowRef.current) {
          const parallaxX = e.transform.x * 0.014;
          const parallaxY = e.transform.y * 0.014;
          bgGlowRef.current.style.transform = `translate(${parallaxX}px, ${parallaxY}px) scale(${1 + (e.transform.k - 1) * 0.02})`;
        }
        if (ambientFxRef.current) {
          const px = e.transform.x * GRAPH_MOTION.parallax.ambientLayerMul;
          const py = e.transform.y * GRAPH_MOTION.parallax.ambientLayerMul;
          ambientFxRef.current.style.transform = `translate(${px}px, ${py}px)`;
        }
        parallaxPanRef.current = {
          coreX: e.transform.x * (GRAPH_MOTION.parallax.ambientLayerMul * 0.8),
          coreY: e.transform.y * (GRAPH_MOTION.parallax.ambientLayerMul * 0.8),
          densityX: e.transform.x * (GRAPH_MOTION.parallax.ambientLayerMul * 1.2),
          densityY: e.transform.y * (GRAPH_MOTION.parallax.ambientLayerMul * 1.2),
        };
        if (ambientFarRef.current) {
          const fx = e.transform.x * GRAPH_MOTION.parallax.farMul * 0.02;
          const fy = e.transform.y * GRAPH_MOTION.parallax.farMul * 0.02;
          ambientFarRef.current.style.transform = `translate(${fx}px, ${fy}px)`;
        }
        if (ambientMidRef.current) {
          const mx = e.transform.x * GRAPH_MOTION.parallax.midMul * 0.02;
          const my = e.transform.y * GRAPH_MOTION.parallax.midMul * 0.02;
          ambientMidRef.current.style.transform = `translate(${mx}px, ${my}px)`;
        }
        if (ambientNearRef.current) {
          const nx = e.transform.x * GRAPH_MOTION.parallax.nearMul * 0.02;
          const ny = e.transform.y * GRAPH_MOTION.parallax.nearMul * 0.02;
          ambientNearRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
        }
        if (ambientGrainRef.current) {
          const gx = e.transform.x * 0.004;
          const gy = e.transform.y * 0.004;
          ambientGrainRef.current.style.transform = `translate(${gx}px, ${gy}px)`;
        }
        updateMiniViewportRef.current?.();
        // Show more labels when zoomed in
        if (modeRef.current === "free" && !searchActiveRef.current && !hoveredNodeIdRef.current) {
          fadeLabels(defaultLabelOpacity, 120);
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
        markHeavyInteraction(260);
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

    // Edge Bundling algorithm: pull long edges into semantic 'highways'
    const curvePathForLink = (d: GraphLink) => {
      const s = d.source as GraphNode;
      const t = d.target as GraphNode;
      const sx = s?.x ?? 0;
      const sy = s?.y ?? 0;
      const tx = t?.x ?? 0;
      const ty = t?.y ?? 0;
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
      const ux = dx / dist;
      const uy = dy / dist;

      const sPad = Math.max(3, (s?.r ?? 10) * 0.86);
      const tPad = Math.max(3, (t?.r ?? 10) * 0.86);
      const x1 = sx + ux * sPad;
      const y1 = sy + uy * sPad;
      const x2 = tx - ux * tPad;
      const y2 = ty - uy * tPad;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      // Bundling logic: the longer the edge, the harder it is pulled to the graph center
      const bundleX = dimsRef.current.w / 2;
      const bundleY = dimsRef.current.h / 2;
      const bundleStrength = clamp01(Math.pow(dist / 650, 1.8)) * 0.94; // Exponential pull for very long links

      // Spread offset to give the bundle physical thickness
      const curveLift = Math.max(10, dist * 0.16);
      const liftX = -uy * curveLift;
      const liftY = ux * curveLift;

      const cx = midX + (bundleX - midX) * bundleStrength + liftX;
      const cy = midY + (bundleY - midY) * bundleStrength + liftY;

      return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
    };

    // ── Links ─────────────────────────────────────────────────────────────
    const linkSel = g.append("g")
      .selectAll<SVGPathElement, GraphLink>("path")
      .data(simLinks).enter().append("path")
      .attr("class", (d: GraphLink) => {
        const sId = getNodeId(d.source);
        const tId = getNodeId(d.target);
        const maxDeg = Math.max(degree[sId] ?? 0, degree[tId] ?? 0);
        const depthClass = maxDeg >= 5 ? " link-depth-foreground" : maxDeg <= 2 ? " link-depth-background" : " link-depth-mid";
        const dashedClass = d.style === "dashed" && !isCompanyRel(d.rel) ? " link-dashed" : "";
        const companyClass = isCompanyRel(d.rel) ? " link-company-primary" : "";
        return `link link-t${edgeTier(d)}${dashedClass}${companyClass}${d.style === "direct" ? " link-direct" : ""}${depthClass}`;
      })
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
    // ── Pulse layer (between links and nodes) ────────────────────────────
    const pulseLayer = g.append("g").attr("class", "edge-pulse-layer").attr("pointer-events", "none");
    const rippleLayer = g.append("g").attr("class", "node-ripple-layer").attr("pointer-events", "none");
    const satelliteLayer = g.append("g").attr("class", "node-satellite-layer").attr("pointer-events", "none");
    pulseLayerRef.current = pulseLayer;
    rippleLayerRef.current = rippleLayer;
    const flowPathNodes = linkSel.nodes();
    let mainCircleNodes: SVGCircleElement[] = [];
    let auraRingNodes: SVGCircleElement[] = [];
    let auraHaloNodes: SVGCircleElement[] = [];
    const coreSeedId = currentUserNode?.id && nodeById.has(currentUserNode.id)
      ? currentUserNode.id
      : [...Object.entries(degree)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const importantNodeIds = new Set<string>(
      [...Object.entries(degree)]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([id]) => id)
    );
    if (coreSeedId) importantNodeIds.add(coreSeedId);
    if (currentUserNodeId) importantNodeIds.add(currentUserNodeId);
    const importantNodes = nodes.filter((n: GraphNode) => importantNodeIds.has(n.id));
    const satellitesData: Array<{ key: string; nodeId: string; orbit: number; speed: number; phase: number; size: number }> = [];
    importantNodes.forEach((n: GraphNode, idx: number) => {
      const rankBoost = n.id === coreSeedId ? 1 : 0;
      const count = Math.min(
        GRAPH_MOTION.satellites.maxPerNode,
        1 + rankBoost + (((degree[n.id] ?? 0) > HUB_BUNDLE_DEGREE + 1) ? 1 : 0)
      );
      for (let i = 0; i < count; i++) {
        satellitesData.push({
          key: `${n.id}-${i}`,
          nodeId: n.id,
          orbit: GRAPH_MOTION.satellites.radiusMin + Math.random() * (GRAPH_MOTION.satellites.radiusMax - GRAPH_MOTION.satellites.radiusMin) + i * 4,
          speed: GRAPH_MOTION.satellites.speedMin + Math.random() * (GRAPH_MOTION.satellites.speedMax - GRAPH_MOTION.satellites.speedMin),
          phase: Math.random() * Math.PI * 2 + idx * 0.2 + i * 0.8,
          size: 0.9 + Math.random() * 1.3,
        });
      }
    });
    const satelliteSel = satelliteLayer.selectAll<SVGCircleElement, { key: string; nodeId: string; orbit: number; speed: number; phase: number; size: number }>("circle")
      .data(satellitesData)
      .enter()
      .append("circle")
      .attr("class", "node-satellite")
      .attr("r", (d) => d.size)
      .attr("fill-opacity", 0);
    const nodePulseMeta = nodes.map((n: GraphNode, i: number) => {
      const profile = GRAPH_MOTION.nodeTypeProfile[n.type] ?? GRAPH_MOTION.nodeTypeProfile.student;
      const profile = GRAPH_MOTION.nodeTypeProfile[n.type] ?? GRAPH_MOTION.nodeTypeProfile.student;
      const period = GRAPH_MOTION.nodePulse.periodMsMin + Math.random() * (GRAPH_MOTION.nodePulse.periodMsMax - GRAPH_MOTION.nodePulse.periodMsMin);
      const cohort = i % GRAPH_MOTION.cohorts.nodeCount;
      return {
        id: n.id,
        cohort,
        phase: Math.random() * Math.PI * 2 + i * 0.13,
        periodMs: (period / profile.speedMul) * (0.92 + cohort * 0.06),
        scaleAmp: (GRAPH_MOTION.nodePulse.scaleMin + Math.random() * (GRAPH_MOTION.nodePulse.scaleMax - GRAPH_MOTION.nodePulse.scaleMin)) * profile.scaleMul,
        glowAmp: GRAPH_MOTION.nodePulse.glowSwing * profile.glowMul,
        flicker: profile.flicker,
      };
    });
    const edgeEnergyMeta = simLinks.map((l: GraphLink, i: number) => {
      const strength = edgeStrength(l);
      const edgeTypeBonus = l.rel === "CONNECTED_TO" ? 1.1 : isCompanyRel(l.rel) ? 1.06 : 0.96;
      const cohort = i % GRAPH_MOTION.cohorts.edgeCount;
      return {
        key: edgePairKey(getNodeId(l.source), getNodeId(l.target)),
        cohort,
        active: strength >= GRAPH_MOTION.ambientEdge.strengthThreshold && Math.random() < GRAPH_MOTION.ambientEdge.activeRatio * edgeTypeBonus,
        phase: Math.random() * Math.PI * 2 + i * 0.2,
        speed: (GRAPH_MOTION.ambientEdge.driftSpeedMin + Math.random() * (GRAPH_MOTION.ambientEdge.driftSpeedMax - GRAPH_MOTION.ambientEdge.driftSpeedMin)) * (0.9 + cohort * 0.16),
      };
    });
    const neighborsById = new Map<string, Set<string>>();
    simLinks.forEach((l: GraphLink) => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      if (!neighborsById.has(s)) neighborsById.set(s, new Set());
      if (!neighborsById.has(t)) neighborsById.set(t, new Set());
      neighborsById.get(s)?.add(t);
      neighborsById.get(t)?.add(s);
    });
    const nodeBoosts = new Map<string, { start: number; until: number; intensity: number }>();
    const edgeBoosts = new Map<string, { start: number; until: number; intensity: number }>();
    const ignitionTimers: number[] = [];
    let idleHintNodeId: string | null = null;
    let idleHintUntil = 0;
    let nextMicroActivationAt = 700 + Math.random() * 1200;
    let nextIdleHintAt = 1800 + Math.random() * 2200;
    let nextIdleCascadeAt = GRAPH_MOTION.idle.cascadeIntervalMinMs + Math.random() * (GRAPH_MOTION.idle.cascadeIntervalMaxMs - GRAPH_MOTION.idle.cascadeIntervalMinMs);
    let nextOpportunityAt = GRAPH_MOTION.idle.opportunityIntervalMsMin + Math.random() * (GRAPH_MOTION.idle.opportunityIntervalMsMax - GRAPH_MOTION.idle.opportunityIntervalMsMin);
    let nextScanAt = GRAPH_MOTION.idle.scanIntervalMsMin + Math.random() * (GRAPH_MOTION.idle.scanIntervalMsMax - GRAPH_MOTION.idle.scanIntervalMsMin);

    let lastFlowTs = 0;
    let nextFlowBurstAt = 1300;
    const spawnFlowParticle = (allowedIndices?: number[]) => {
      if (activeParticles.length >= MOTION_PROFILE[motionTierRef.current].flowMax) return;
      const linkIdx = pickFlowLinkIndex(allowedIndices);
      if (linkIdx < 0 || linkIdx >= flowPathNodes.length) return;
      const l = flowLinks[linkIdx];
      const sId = getNodeId(l.source);
      const tId = getNodeId(l.target);
      const sNode = nodeById.get(sId);
      const tNode = nodeById.get(tId);
      if (!sNode || !tNode) return;
      if (hiddenTypesRef.current.has(sNode.type) || hiddenTypesRef.current.has(tNode.type)) return;
      const pathEl = flowPathNodes[linkIdx];
      if (!pathEl) return;
      const strength = edgeStrength(l);
      const particle = pulseLayer.append<SVGCircleElement>("circle")
        .attr("class", "flow-particle")
        .attr("r", 2 + strength * 2.9)
        .attr("fill-opacity", 0);
      activeParticles.push({
        el: particle,
        linkIdx,
        t: 0,
        speed: 0.00009 + strength * 0.00013,
        size: 2 + strength * 2.9,
      });
    };

    const animateParticles = (ts: number) => {
      if (!lastFlowTs) lastFlowTs = ts;
      const dt = ts - lastFlowTs;
      lastFlowTs = ts;
      const profile = MOTION_PROFILE[motionTierRef.current];
      const lod = currentZoomKRef.current < 0.65 ? 0 : currentZoomKRef.current < 1.2 ? 1 : 2;
      const heavyInteraction = ts < heavyInteractionUntilRef.current;
      if (rootEl) rootEl.classList.toggle("perf-interacting", heavyInteraction);
      const ambientDampen = heavyInteraction ? profile.ambientDampenOnInteraction : 1;
      if (ts - motionDebugTsRef.current > 2200) {
        motionDebugTsRef.current = ts;
        const frameBudget = dt > 33 ? "low" : dt > 22 ? "medium" : "good";
        if (frameBudget === "low" && !perfTierOverride) {
          if (motionTierRef.current === "full") {
            motionTierRef.current = "balanced";
            setMotionTier("balanced");
          } else if (motionTierRef.current === "balanced") {
            motionTierRef.current = "performance";
            setMotionTier("performance");
          }
        }
        if (perfDebug) {
          console.debug("[CampusGraph/perf]", {
            tier: motionTierRef.current,
            frameBudget,
            dt: Math.round(dt),
            nodes: nodes.length,
            links: simLinks.length,
            activeFlow: activeParticles.length,
            zoom: Number(currentZoomKRef.current.toFixed(2)),
          });
        }
      }
      const ambientAllowed = viewModeRef.current === "2d"
        && modeRef.current === "free"
        && !searchActiveRef.current
        && !draggingNodeIdRef.current
        && !demoModeRef.current
        && multiSelectedCountRef.current === 0;
      const ambientDecorAllowed = ambientAllowed && !heavyInteraction;
      const idleAllowed = ambientDecorAllowed
        && !hoveredNodeIdRef.current
        && ts - lastInteractionAtRef.current >= 420
        && ts >= idleTimeoutAtRef.current;
      const focusId = hoveredNodeIdRef.current ?? ((modeRef.current === "locked" || modeRef.current === "path") ? selectedIdRef.current : null);
      const oneHop = new Set<string>(focusId ? [...(neighborsById.get(focusId) ?? new Set<string>())] : []);
      const twoHop = new Set<string>();
      if (focusId && (lod >= 1 || motionTierRef.current === "full")) {
        oneHop.forEach((nid) => {
          const next = neighborsById.get(nid);
          if (!next) return;
          next.forEach((x) => {
            if (x !== focusId && !oneHop.has(x)) twoHop.add(x);
          });
        });
      }
      const maxAnimatedEdges = Math.max(8, Math.floor(nodes.length / 5));
      const prioritizedSimEdgeSet = new Set<number>();
      const prioritizedFlowEdgeSet = new Set<number>();
      const pathIds = pathNodeIdsRef.current;
      for (let i = 0; i < pathIds.length - 1; i++) {
        const key = edgePairKey(pathIds[i], pathIds[i + 1]);
        const simIdx = linkIndexByKey.get(key);
        if (simIdx != null && prioritizedSimEdgeSet.size < maxAnimatedEdges) prioritizedSimEdgeSet.add(simIdx);
        const flowIdx = flowIndexByKey.get(key);
        if (flowIdx != null && prioritizedFlowEdgeSet.size < maxAnimatedEdges) prioritizedFlowEdgeSet.add(flowIdx);
      }
      if (focusId) {
        const focusSim = linkIndicesByNode.get(focusId) ?? [];
        for (const idx of focusSim) {
          if (prioritizedSimEdgeSet.size >= maxAnimatedEdges) break;
          prioritizedSimEdgeSet.add(idx);
        }
        const focusFlow = flowIndicesByNode.get(focusId) ?? [];
        for (const idx of focusFlow) {
          if (prioritizedFlowEdgeSet.size >= maxAnimatedEdges) break;
          prioritizedFlowEdgeSet.add(idx);
        }
      }
      if (prioritizedSimEdgeSet.size < maxAnimatedEdges && oneHop.size) {
        for (const nid of oneHop) {
          const list = linkIndicesByNode.get(nid) ?? [];
          for (const idx of list) {
            if (prioritizedSimEdgeSet.size >= maxAnimatedEdges) break;
            prioritizedSimEdgeSet.add(idx);
          }
          if (prioritizedSimEdgeSet.size >= maxAnimatedEdges) break;
        }
      }
      if (prioritizedFlowEdgeSet.size < maxAnimatedEdges && oneHop.size) {
        for (const nid of oneHop) {
          const list = flowIndicesByNode.get(nid) ?? [];
          for (const idx of list) {
            if (prioritizedFlowEdgeSet.size >= maxAnimatedEdges) break;
            prioritizedFlowEdgeSet.add(idx);
          }
          if (prioritizedFlowEdgeSet.size >= maxAnimatedEdges) break;
        }
      }
      for (const idx of simEdgeRanked) {
        if (prioritizedSimEdgeSet.size >= maxAnimatedEdges) break;
        prioritizedSimEdgeSet.add(idx);
      }
      for (const idx of flowEdgeRanked) {
        if (prioritizedFlowEdgeSet.size >= maxAnimatedEdges) break;
        prioritizedFlowEdgeSet.add(idx);
      }
      const prioritizedFlowIndices = [...prioritizedFlowEdgeSet];

      if (modeRef.current === "free" && !heavyInteraction && flowLinks.length > 0) {
        const targetMax = Math.max(4, Math.floor(nodes.length / 5));
        const targetMin = Math.floor(targetMax * 0.7);
        if (activeParticles.length < targetMin) {
          const need = targetMin - activeParticles.length;
          for (let i = 0; i < need; i++) spawnFlowParticle(prioritizedFlowIndices);
        }
        nextFlowBurstAt -= dt;
        if (nextFlowBurstAt <= 0) {
          const burst = Math.max(3, Math.floor(targetMax / 4));
          const room = Math.max(0, targetMax - activeParticles.length);
          const spawnCount = Math.min(burst, room);
          for (let i = 0; i < spawnCount; i++) spawnFlowParticle(prioritizedFlowIndices);
          const burstMul = motionTierRef.current === "performance" ? 1.32 : motionTierRef.current === "balanced" ? 1.15 : 1;
          nextFlowBurstAt = (1000 + Math.random() * 1500) * burstMul;
        }
      }
      for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        const pathEl = flowPathNodes[p.linkIdx];
        const lnk = flowLinks[p.linkIdx];
        if (!pathEl || !lnk) { p.el.remove(); activeParticles.splice(i, 1); continue; }
        const sId = getNodeId(lnk.source);
        const tId = getNodeId(lnk.target);
        const sNode = nodeById.get(sId);
        const tNode = nodeById.get(tId);
        if (!sNode || !tNode) {
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
          .attr("fill-opacity", clamp01(fade) * (0.56 + strength * 0.48));
      }

      if (mainCircleNodes.length) {
        const ambientBase = viewModeRef.current !== "2d" ? 0 : modeRef.current === "path" ? 0 : modeRef.current === "locked" ? 0.56 : 1;
        const tierMul = motionTierRef.current === "full" ? 1 : motionTierRef.current === "balanced" ? 0.86 : 0.72;
        const ambientGain = ambientBase * ambientDampen * tierMul;
        const visibleNodesFrame = nodes.filter((n: GraphNode) => !hiddenTypesRef.current.has(n.type) && n.x != null && n.y != null);
        const visibleByType = new Map<NodeType, GraphNode[]>();
        for (const n of visibleNodesFrame) {
          const arr = visibleByType.get(n.type) ?? [];
          arr.push(n);
          visibleByType.set(n.type, arr);
        }
        if (ambientDecorAllowed && !hoveredNodeIdRef.current) {
          nextMicroActivationAt -= dt;
          if (nextMicroActivationAt <= 0) {
            const countRange = GRAPH_MOTION.microActivation.nodeCountMax - GRAPH_MOTION.microActivation.nodeCountMin + 1;
            const pickCount = GRAPH_MOTION.microActivation.nodeCountMin + Math.floor(Math.random() * Math.max(1, countRange));
            const pool = nodes.filter((n: GraphNode) => !hiddenTypesRef.current.has(n.type) && n.id !== selectedIdRef.current);
            for (let i = 0; i < pickCount && pool.length; i++) {
              const idx = Math.floor(Math.random() * pool.length);
              const n = pool.splice(idx, 1)[0];
              nodeBoosts.set(n.id, { start: ts, until: ts + GRAPH_MOTION.microActivation.durationMs, intensity: GRAPH_MOTION.microActivation.intensity });
              const edgeNbrs = neighborsById.get(n.id);
              edgeNbrs?.forEach((neighborId) => {
                edgeBoosts.set(edgePairKey(n.id, neighborId), {
                  start: ts,
                  until: ts + GRAPH_MOTION.microActivation.durationMs * 0.82,
                  intensity: GRAPH_MOTION.microActivation.intensity * 0.7,
                });
              });
            }
            nextMicroActivationAt = GRAPH_MOTION.microActivation.minIntervalMs + Math.random() * (GRAPH_MOTION.microActivation.maxIntervalMs - GRAPH_MOTION.microActivation.minIntervalMs);
          }
        }

        if (idleAllowed) {
          nextIdleHintAt -= dt;
          nextIdleCascadeAt -= dt;
          nextOpportunityAt -= dt;
          nextScanAt -= dt;

          if (nextIdleHintAt <= 0 && !idleHintNodeId) {
            const pool = nodes
              .filter((n: GraphNode) => !hiddenTypesRef.current.has(n.type))
              .sort((a: GraphNode, b: GraphNode) => (degree[b.id] ?? 0) - (degree[a.id] ?? 0))
              .slice(0, 16);
            const target = pool[Math.floor(Math.random() * Math.max(1, pool.length))];
            if (target) {
              idleHintNodeId = target.id;
              idleHintUntil = ts + GRAPH_MOTION.idle.hintDurationMs;
              nodeBoosts.set(target.id, { start: ts, until: idleHintUntil, intensity: 0.22 });
              neighborsById.get(target.id)?.forEach((nid) => {
                nodeBoosts.set(nid, { start: ts, until: ts + GRAPH_MOTION.idle.hintDurationMs * 0.8, intensity: 0.11 });
                edgeBoosts.set(edgePairKey(target.id, nid), { start: ts, until: ts + GRAPH_MOTION.idle.hintDurationMs * 0.86, intensity: 0.16 });
              });
            }
            nextIdleHintAt = GRAPH_MOTION.idle.hintCooldownMsMin + Math.random() * (GRAPH_MOTION.idle.hintCooldownMsMax - GRAPH_MOTION.idle.hintCooldownMsMin);
          }

          if (nextIdleCascadeAt <= 0) {
            const visibleNodes = nodes
              .filter((n: GraphNode) => !hiddenTypesRef.current.has(n.type))
              .sort((a: GraphNode, b: GraphNode) => (degree[b.id] ?? 0) - (degree[a.id] ?? 0))
              .slice(0, 22);
            const seed = visibleNodes[Math.floor(Math.random() * Math.max(1, visibleNodes.length))];
            if (seed) {
              const nodeCount = GRAPH_MOTION.idle.cascadeNodeMin
                + Math.floor(Math.random() * (GRAPH_MOTION.idle.cascadeNodeMax - GRAPH_MOTION.idle.cascadeNodeMin + 1));
              const edgeCount = GRAPH_MOTION.idle.cascadeEdgeMin
                + Math.floor(Math.random() * (GRAPH_MOTION.idle.cascadeEdgeMax - GRAPH_MOTION.idle.cascadeEdgeMin + 1));
              const sequence: string[] = [seed.id];
              const seen = new Set<string>(sequence);
              for (let i = 0; i < sequence.length && sequence.length < nodeCount; i++) {
                const cur = sequence[i];
                const nbrs = [...(neighborsById.get(cur) ?? new Set<string>())]
                  .filter((id) => !seen.has(id))
                  .sort((a, b) => (degree[b] ?? 0) - (degree[a] ?? 0));
                const pick = nbrs.slice(0, 2 + Math.floor(Math.random() * 2));
                pick.forEach((id) => {
                  if (sequence.length < nodeCount && !seen.has(id)) {
                    seen.add(id);
                    sequence.push(id);
                  }
                });
              }
              sequence.forEach((nid, idx) => {
                const start = ts + idx * GRAPH_MOTION.idle.cascadeStepMs;
                const until = start + 880;
                nodeBoosts.set(nid, { start, until, intensity: 0.16 });
              });
              let placedEdges = 0;
              for (let i = 1; i < sequence.length && placedEdges < edgeCount; i++) {
                const a = sequence[i - 1];
                const b = sequence[i];
                const start = ts + i * GRAPH_MOTION.idle.cascadeStepMs;
                edgeBoosts.set(edgePairKey(a, b), { start, until: start + 820, intensity: 0.18 });
                placedEdges++;
              }
            }
            nextIdleCascadeAt = GRAPH_MOTION.idle.cascadeIntervalMinMs + Math.random() * (GRAPH_MOTION.idle.cascadeIntervalMaxMs - GRAPH_MOTION.idle.cascadeIntervalMinMs);
          }

          if (nextOpportunityAt <= 0) {
            const weakLinks = simLinks
              .filter((l: GraphLink) => edgeStrength(l) <= 0.46)
              .filter((l: GraphLink) => {
                const s = nodeById.get(getNodeId(l.source));
                const t = nodeById.get(getNodeId(l.target));
                return Boolean(s && t && !hiddenTypesRef.current.has(s.type) && !hiddenTypesRef.current.has(t.type));
              });
            if (weakLinks.length) {
              const target = weakLinks[Math.floor(Math.random() * weakLinks.length)];
              const s = getNodeId(target.source);
              const t = getNodeId(target.target);
              edgeBoosts.set(edgePairKey(s, t), { start: ts, until: ts + GRAPH_MOTION.idle.opportunityDurationMs, intensity: 0.2 });
              nodeBoosts.set(s, { start: ts, until: ts + GRAPH_MOTION.idle.opportunityDurationMs, intensity: 0.1 });
              nodeBoosts.set(t, { start: ts, until: ts + GRAPH_MOTION.idle.opportunityDurationMs, intensity: 0.1 });
            }
            nextOpportunityAt = GRAPH_MOTION.idle.opportunityIntervalMsMin + Math.random() * (GRAPH_MOTION.idle.opportunityIntervalMsMax - GRAPH_MOTION.idle.opportunityIntervalMsMin);
          }

          if (nextScanAt <= 0) {
            triggerScanSweep();
            nextScanAt = GRAPH_MOTION.idle.scanIntervalMsMin + Math.random() * (GRAPH_MOTION.idle.scanIntervalMsMax - GRAPH_MOTION.idle.scanIntervalMsMin);
          }
        }

        if (idleHintNodeId && ts >= idleHintUntil) idleHintNodeId = null;

        const coreId = selectedIdRef.current && modeRef.current === "locked"
          ? selectedIdRef.current
          : (currentUserNode?.id && nodeById.has(currentUserNode.id) ? currentUserNode.id : coreSeedId);
        const coreNode = coreId ? nodeById.get(coreId) : null;
        const ambientBreathingIds = new Set<string>();
        if (!focusId && coreId) {
          ambientBreathingIds.add(coreId);
          const local = [...(neighborsById.get(coreId) ?? new Set<string>())]
            .sort((a, b) => (degree[b] ?? 0) - (degree[a] ?? 0))
            .slice(0, 6);
          local.forEach((id) => ambientBreathingIds.add(id));
        }
        const coreBeat = Math.sin(ts * GRAPH_MOTION.core.waveSpeed) * 0.5 + 0.5;
        const coreRadius = GRAPH_MOTION.core.neighborRadiusPx;

        if (energyCoreRef.current || energyDensityRef.current) {
          const w = dimsRef.current.w;
          const h = dimsRef.current.h;
          const weighted = visibleNodesFrame.reduce((acc, n) => {
            const wt = (degree[n.id] ?? 1) + 1;
            return { x: acc.x + (n.x ?? 0) * wt, y: acc.y + (n.y ?? 0) * wt, w: acc.w + wt };
          }, { x: 0, y: 0, w: 0 });
          const denseX = weighted.w > 0 ? weighted.x / weighted.w : w / 2;
          const denseY = weighted.w > 0 ? weighted.y / weighted.w : h / 2;

          if (energyDensityRef.current) {
            const driftX = Math.sin(ts * 0.00012) * GRAPH_MOTION.field.driftPx;
            const driftY = Math.cos(ts * 0.0001) * GRAPH_MOTION.field.driftPx;
            const pan = parallaxPanRef.current;
            energyDensityRef.current.style.transform = `translate(${pan.densityX + driftX}px, ${pan.densityY + driftY}px)`;
            energyDensityRef.current.style.opacity = `${GRAPH_MOTION.field.densityOpacity * ambientGain}`;
            energyDensityRef.current.style.background = `radial-gradient(ellipse at ${(denseX / Math.max(1, w)) * 100}% ${(denseY / Math.max(1, h)) * 100}%, rgba(86,156,242,0.38) 0%, rgba(67,125,214,0.19) 26%, rgba(25,44,83,0.12) 54%, rgba(7,14,27,0) 78%)`;
          }
          if (energyCoreRef.current && coreNode?.x != null && coreNode?.y != null) {
            const corePx = (coreNode.x / Math.max(1, w)) * 100;
            const corePy = (coreNode.y / Math.max(1, h)) * 100;
            const opacity = (GRAPH_MOTION.field.coreOpacityBase + coreBeat * GRAPH_MOTION.field.coreOpacitySwing) * ambientGain;
            energyCoreRef.current.style.opacity = `${opacity}`;
            const pan = parallaxPanRef.current;
            energyCoreRef.current.style.transform = `translate(${pan.coreX}px, ${pan.coreY}px)`;
            energyCoreRef.current.style.background = `radial-gradient(circle at ${corePx}% ${corePy}%, rgba(164,212,255,0.62) 0%, rgba(118,170,255,0.28) 17%, rgba(61,95,173,0.18) 36%, rgba(10,20,40,0) 70%)`;
          }
        }

        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const circle = mainCircleNodes[i];
          if (!circle || hiddenTypesRef.current.has(n.type)) continue;
          const auraRing = auraRingNodes[i];
          const auraHalo = auraHaloNodes[i];
          const pulseMeta = nodePulseMeta[i];
          const cohortActive = pulseMeta.cohort < MOTION_PROFILE[motionTierRef.current].activeNodeCohorts;
          const nodeAmbientMul = cohortActive ? 1 : 0.28;
          const focusZoneMul = !focusId
            ? (ambientBreathingIds.has(n.id) ? (n.id === coreId ? 1 : 0.45) : 0.04)
            : n.id === focusId
              ? 1.18
              : oneHop.has(n.id)
                ? 0.58
                : twoHop.has(n.id)
                  ? 0.3
                  : 0.08;
          const wave = Math.sin((ts / Math.max(1, pulseMeta.periodMs)) * Math.PI * 2 + pulseMeta.phase);
          const boostData = nodeBoosts.get(n.id);
          let boost = 0;
          if (boostData) {
            if (boostData.until <= ts) {
              nodeBoosts.delete(n.id);
            } else if (ts >= boostData.start) {
              boost = clamp01((boostData.until - ts) / Math.max(1, GRAPH_MOTION.microActivation.durationMs)) * boostData.intensity;
            }
          }

          let scale = pulseMeta.scaleAmp * (0.5 + wave * 0.5) * ambientGain * nodeAmbientMul * focusZoneMul;
          let fillLift = boost * ambientGain * Math.max(0.4, focusZoneMul);
          let strokeLift = ((wave * 0.5 + 0.5) * pulseMeta.glowAmp * 0.2 + boost * 0.7) * ambientGain * nodeAmbientMul * focusZoneMul;
          let auraLift = ((wave * 0.5 + 0.5) * 0.22 + boost * 0.7) * ambientGain * nodeAmbientMul * focusZoneMul;
          const cohortWave = Math.sin(ts * (0.00036 + pulseMeta.cohort * 0.00004) + pulseMeta.phase + pulseMeta.cohort * 0.75) * 0.5 + 0.5;
          scale += 0.008 * cohortWave * ambientGain * nodeAmbientMul * focusZoneMul;
          strokeLift += 0.028 * cohortWave * ambientGain * nodeAmbientMul * focusZoneMul;

          if (coreNode?.x != null && coreNode?.y != null && n.x != null && n.y != null) {
            const dx = n.x - coreNode.x;
            const dy = n.y - coreNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const near = clamp01(1 - dist / coreRadius);
            if (n.id === coreId) {
              scale += GRAPH_MOTION.core.pulseScale * coreBeat * ambientGain;
              strokeLift += GRAPH_MOTION.core.glowLift * coreBeat * ambientGain;
              auraLift += 0.36 * coreBeat * ambientGain;
            } else if (near > 0) {
              const propagated = near * near * coreBeat;
              scale += GRAPH_MOTION.core.neighborScale * propagated * ambientGain;
              strokeLift += GRAPH_MOTION.core.neighborGlow * propagated * ambientGain;
              auraLift += 0.16 * propagated * ambientGain;
            }
          }
          const hoveredId = hoveredNodeIdRef.current;
          if (hoveredId && n.id === hoveredId) {
            scale += GRAPH_MOTION.hover.nodeScale;
            fillLift += 0.08;
            strokeLift += 0.22;
            auraLift += 0.22;
          } else if (hoveredId && neighborsById.get(hoveredId)?.has(n.id)) {
            scale += GRAPH_MOTION.hover.neighborScale;
            fillLift += 0.03;
            strokeLift += 0.08;
            auraLift += 0.08;
          }
          if (selectedIdRef.current && modeRef.current === "locked" && n.id === selectedIdRef.current) {
            scale += GRAPH_MOTION.selected.pulseScale * (0.5 + wave * 0.5) * GRAPH_MOTION.selected.pulseSpeedMul;
            strokeLift += GRAPH_MOTION.selected.glowLift;
            auraLift += 0.19;
          } else if (selectedIdRef.current && modeRef.current === "locked" && neighborsById.get(selectedIdRef.current)?.has(n.id)) {
            strokeLift += GRAPH_MOTION.selected.neighborGlowLift;
            auraLift += 0.08;
          }

          const baseFill = n.id === currentUserNodeId ? 1 : 0.9;
          const baseStroke = NODE_FLICKER_BASE;
          circle.setAttribute("r", `${(n.r ?? 12) * (1 + scale)}`);
          circle.setAttribute("fill-opacity", `${clamp01(baseFill + fillLift)}`);
          circle.setAttribute("stroke-opacity", `${clamp01(baseStroke + strokeLift + Math.sin(ts * pulseMeta.flicker * 0.02 + pulseMeta.phase) * 0.04)}`);
          if (auraRing) {
            const auraScale = 1 + scale * 0.65 + auraLift * 0.26;
            auraRing.setAttribute("r", `${(n.r ?? 12) * auraScale + 4.4}`);
            auraRing.setAttribute("stroke-opacity", `${clamp01(0.28 + auraLift * 0.84)}`);
          }
          if (auraHalo) {
            const haloScale = 1.22 + scale * 0.7 + auraLift * 0.35;
            auraHalo.setAttribute("r", `${(n.r ?? 12) * haloScale + 4}`);
            auraHalo.setAttribute("fill-opacity", `${clamp01(0.06 + auraLift * 0.4)}`);
          }
        }

        satelliteSel.each(function (d) {
          const target = nodeById.get(d.nodeId);
          if (!target || target.x == null || target.y == null || hiddenTypesRef.current.has(target.type)) {
            this.setAttribute("fill-opacity", "0");
            return;
          }
          const isFocused = d.nodeId === selectedIdRef.current || d.nodeId === coreId;
          const hoverAdj = hoveredNodeIdRef.current === d.nodeId ? 0.2 : 0;
          const a = ts * d.speed + d.phase;
          const radius = d.orbit + (isFocused ? 3.2 : 0);
          this.setAttribute("cx", `${(target.x ?? 0) + Math.cos(a) * radius}`);
          this.setAttribute("cy", `${(target.y ?? 0) + Math.sin(a) * radius}`);
          this.setAttribute("fill", TYPE_COLOR[target.type]);
          this.setAttribute("fill-opacity", `${(GRAPH_MOTION.satellites.opacity + (isFocused ? 0.16 : 0) + hoverAdj) * ambientGain}`);
        });

        if (ambientDecorAllowed && !hoveredNodeIdRef.current) {
          for (let i = 0; i < simLinks.length; i++) {
            const l = simLinks[i];
            const pathEl = flowPathNodes[i];
            if (!pathEl) continue;
            const sId = getNodeId(l.source);
            const tId = getNodeId(l.target);
            const sNode = nodeById.get(sId);
            const tNode = nodeById.get(tId);
            if (!sNode || !tNode || hiddenTypesRef.current.has(sNode.type) || hiddenTypesRef.current.has(tNode.type)) continue;
            const base = defOp(l);
            const driftMeta = edgeEnergyMeta[i];
            const edgeCohortActive = (driftMeta?.cohort ?? 0) < profile.activeEdgeCohorts;
            const edgeBudgeted = prioritizedSimEdgeSet.has(i);
            const cohortAmp = driftMeta?.cohort === 0 ? 0.16 : driftMeta?.cohort === 1 ? 0.1 : 0.06;
            const drift = driftMeta?.active
              ? (Math.sin(ts * driftMeta.speed + driftMeta.phase) * 0.5 + 0.5)
              * (GRAPH_MOTION.ambientEdge.driftAmplitude + cohortAmp)
              * ambientGain
              * (edgeCohortActive ? 1 : 0.3)
              * (edgeBudgeted ? 1 : focusId ? 0.06 : 0.22)
              : 0;
            const edgeBoost = edgeBoosts.get(driftMeta?.key ?? "");
            let boost = 0;
            if (edgeBoost) {
              if (edgeBoost.until <= ts) edgeBoosts.delete(driftMeta.key);
              else if (ts >= edgeBoost.start) boost = clamp01((edgeBoost.until - ts) / Math.max(1, GRAPH_MOTION.idle.opportunityDurationMs)) * edgeBoost.intensity;
            }
            const sDegree = degree[sId] ?? 0;
            const tDegree = degree[tId] ?? 0;
            const nodeMax = Math.max(sDegree, tDegree);
            const depthLift = selectedIdRef.current && (sId === selectedIdRef.current || tId === selectedIdRef.current)
              ? GRAPH_MOTION.depth.edgeForegroundLift
              : nodeMax >= 5
                ? GRAPH_MOTION.depth.edgeForegroundLift * 0.7
                : GRAPH_MOTION.depth.edgeBackgroundDrop * -1;
            const focusSuppression = focusId && !edgeBudgeted ? -0.08 : 0;
            pathEl.setAttribute("stroke-opacity", `${clamp01(base + drift + boost + depthLift + focusSuppression)}`);
          }
        }

      }
      particleRafRef.current = requestAnimationFrame(animateParticles);
    };
    particleRafRef.current = requestAnimationFrame(animateParticles);

    // ── Nodes ─────────────────────────────────────────────────────────────
    const nodeSel = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes).enter().append("g")
      .attr("class", (d: GraphNode) => {
        const elevated = (degree[d.id] ?? 0) >= 5 || d.type === "company" || d.id === currentUserNodeId;
        const background = !elevated && (degree[d.id] ?? 0) <= 2;
        const currentUser = d.id === currentUserNodeId ? " node-current-user" : "";
        const important = elevated ? " node-important" : "";
        const depth = elevated ? " node-depth-foreground" : background ? " node-depth-background" : " node-depth-mid";
        return `node${currentUser}${important}${depth}`;
      })
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (e: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            markHeavyInteraction(720);
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
            markHeavyInteraction(280);
            d.fx = e.x; d.fy = e.y;
          })
          .on("end", (e: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            markHeavyInteraction(320);
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
        noteInteraction();
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
        noteInteraction();
        if (modeRef.current !== "free") return;
        nodeSel.select<SVGCircleElement>("circle.main-circle").attr("transform", null);
        nodeSel.select<SVGCircleElement>("circle.node-aura-ring").attr("transform", null);
        nodeSel.select<SVGCircleElement>("circle.node-aura-halo").attr("transform", null);
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
          return (s === d.id || t === d.id) ? GRAPH_MOTION.hover.edgeOpacity : GRAPH_MOTION.hover.neighborEdgeOpacity;
        });
        linkSel
          .classed("link-hover-energized", (l: GraphLink) => {
            const s = getNodeId(l.source), t = getNodeId(l.target);
            return s === d.id || t === d.id;
          })
          .attr("stroke-width", (l: GraphLink) => {
            const s = getNodeId(l.source), t = getNodeId(l.target);
            if (s === d.id || t === d.id) return edgeWidthForLink(l) * GRAPH_MOTION.hover.edgeWidthMul;
            return edgeWidthForLink(l) * 0.92;
          });
        nodeSel.transition().duration(GRAPH_MOTION.premium.hoverMs)
          .style("opacity", (n: GraphNode) => conn.has(n.id) ? 1 : GRAPH_MOTION.hover.unrelatedOpacity);
        fadeLabels((n: GraphNode) => (conn.has(n.id) ? 1 : 0), 140);
        nodeSel.select<SVGCircleElement>("circle.main-circle")
          .transition()
          .duration(GRAPH_MOTION.premium.hoverMs)
          .attr("r", (n: GraphNode) => {
            if (n.id === d.id) return (n.r ?? 12) * (1 + GRAPH_MOTION.hover.nodeScale);
            if (conn.has(n.id)) return (n.r ?? 12) * (1 + GRAPH_MOTION.hover.neighborScale);
            return n.r ?? 12;
          });
        nodeSel.filter((n: GraphNode) => n.id === d.id)
          .select<SVGCircleElement>("circle.main-circle")
          .attr("filter", "url(#glow-selected)");
      })
      .on("mouseleave", () => {
        noteInteraction();
        if (modeRef.current !== "free") return;
        hoveredNodeIdRef.current = null;
        setHoverCard(null);
        if (draggingNodeIdRef.current) return;
        linkSel.attr("stroke-opacity", (l: GraphLink) => defOp(l));
        linkSel.classed("link-hover-energized", false).attr("stroke-width", (l: GraphLink) => edgeWidthForLink(l));
        nodeSel.transition().duration(180).style("opacity", 1);
        nodeSel.select<SVGCircleElement>("circle.main-circle")
          .transition()
          .duration(180)
          .attr("r", (n: GraphNode) => n.r ?? 12);
        fadeLabels((n: GraphNode) => {
          return defaultLabelOpacity(n);
        }, 200);
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

    const auraHalos = nodeSel.append("circle")
      .attr("class", (d: GraphNode) => `node-aura-halo node-aura-halo--${d.type}`)
      .attr("r", (d: GraphNode) => (d.r ?? 12) * 1.56)
      .attr("fill", (d: GraphNode) => TYPE_COLOR[d.type])
      .attr("fill-opacity", (d: GraphNode) => d.id === coreSeedId ? 0.22 : 0.11)
      .attr("pointer-events", "none");

    const auraRings = nodeSel.append("circle")
      .attr("class", (d: GraphNode) => `node-aura-ring node-aura-ring--${d.type}`)
      .attr("r", (d: GraphNode) => (d.r ?? 12) + 4.5)
      .attr("fill", "none")
      .attr("stroke", (d: GraphNode) => TYPE_COLOR[d.type])
      .attr("stroke-opacity", (d: GraphNode) => d.id === coreSeedId ? 0.64 : 0.36)
      .attr("stroke-width", (d: GraphNode) => d.type === "company" ? 1.25 : 1)
      .attr("pointer-events", "none");

    // Main circle
    const mainCircles = nodeSel.append("circle")
      .attr("class", (d: GraphNode) =>
        `main-circle ambient-glow${d.type === "company" || d.id === currentUserNodeId ? " ambient-glow--hi" : ""}`
      )
      .attr("r", (d: GraphNode) => d.r ?? 12)
      .attr("fill", (d: GraphNode) =>
        d.id === currentUserNodeId ? "#facc15" : TYPE_COLOR[d.type]
      )
      .attr("fill-opacity", (d: GraphNode) => d.id === currentUserNodeId ? 1 : 0.9)
      .attr("stroke", (d: GraphNode) =>
        d.id === currentUserNodeId ? "#fef3c7" : TYPE_COLOR[d.type]
      )
      .attr("stroke-width", (d: GraphNode) => d.id === currentUserNodeId ? 3 : 2)
      .attr("stroke-opacity", 0.9)
      .attr("filter", (d: GraphNode) => baseNodeFilter(d));
    mainCircleNodes = mainCircles.nodes();
    auraRingNodes = auraRings.nodes();
    auraHaloNodes = auraHalos.nodes();

    // Label (hidden at default zoom in free mode)
    const labels = nodeSel.append("text")
      .attr("dy", (d: GraphNode) => (d.r ?? 12) + 14)
      .text((d: GraphNode) => {
        const label = typeof d.label === "string" ? d.label : "";
        return label.length > 20 ? label.slice(0, 18) + "…" : label;
      })
      .text((d: GraphNode) => {
        const label = typeof d.label === "string" ? d.label : "";
        return label.length > 20 ? label.slice(0, 18) + "..." : label;
      })
      .attr("font-size", (d: GraphNode) => d.type === "company" ? "11px" : "10px")
      .attr("font-weight", (d: GraphNode) =>
        d.id === currentUserNodeId
          ? "800"
          : ["company", "professor"].includes(d.type) ? "600" : "400"
      )
      .attr("fill", (d: GraphNode) =>
        d.id === currentUserNodeId ? "#fef9c3" : d.type === "interest" ? "#8ea0b7" : "#cbd5e1"
      )
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .style("opacity", (d: GraphNode) => defaultLabelOpacity(d));
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
    const HIGH_CONNECTION_DEGREE = 5;
    const resolvedCurrentUserId = currentUserNodeId;
    const isHighConnectionStudent = (n: GraphNode) => n.type === "student" && (degree[n.id] ?? 0) >= HIGH_CONNECTION_DEGREE;

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id((d: GraphNode) => d.id)
        .distance((d: d3.SimulationLinkDatum<GraphNode>) => {
          const s = d.source as GraphNode, t = d.target as GraphNode;
          const sHub = hubIds.has(s.id) || (degree[s.id] ?? 0) > HUB_BUNDLE_DEGREE;
          const tHub = hubIds.has(t.id) || (degree[t.id] ?? 0) > HUB_BUNDLE_DEGREE;
          const sHighStudent = isHighConnectionStudent(s);
          const tHighStudent = isHighConnectionStudent(t);
          const touchesCurrentUser = Boolean(resolvedCurrentUserId && (s.id === resolvedCurrentUserId || t.id === resolvedCurrentUserId));
          if (s.type === "student" && t.type === "student") {
            if (touchesCurrentUser && (sHighStudent || tHighStudent)) return 252;
            if (touchesCurrentUser) return 224;
            if (sHighStudent && tHighStudent) return 266;
            if (sHighStudent || tHighStudent) return 236;
            return 194;
          }
          if (sHub || tHub) return 226;
          return ["company", "club"].includes(s.type) || ["company", "club"].includes(t.type) ? 164 : 128;
        })
        .strength(0.4)
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength((d: GraphNode) =>
        d.type === "club"
          ? -1020
          : d.type === "company"
            ? -920
            : d.type === "student"
              ? (-820
                - ((degree[d.id] ?? 0) >= HIGH_CONNECTION_DEGREE ? 220 : 0)
                - (resolvedCurrentUserId && d.id === resolvedCurrentUserId ? 180 : 0))
              : -670))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.03))
      .force("collision", d3.forceCollide<GraphNode>().radius((d: GraphNode) => {
        const deg = degree[d.id] ?? 0;
        const highBonus = deg >= HIGH_CONNECTION_DEGREE ? 14 : 0;
        const userBonus = resolvedCurrentUserId && d.id === resolvedCurrentUserId ? 10 : 0;
        return (d.r ?? 12) + ((deg > HUB_BUNDLE_DEGREE ? 24 : 17) + highBonus + userBonus);
      }).strength(0.94))
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

    const highConnectionSpreadForce = (alpha: number) => {
      const spreadNodes = nodes.filter((n: GraphNode) =>
        isHighConnectionStudent(n) || (resolvedCurrentUserId && n.id === resolvedCurrentUserId)
      );
      for (let i = 0; i < spreadNodes.length; i++) {
        const a = spreadNodes[i];
        if (a.x == null || a.y == null) continue;
        for (let j = i + 1; j < spreadNodes.length; j++) {
          const b = spreadNodes[j];
          if (b.x == null || b.y == null) continue;
          let dx = (a.x as number) - (b.x as number);
          let dy = (a.y as number) - (b.y as number);
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.001) {
            dx = (Math.random() - 0.5) * 0.01;
            dy = (Math.random() - 0.5) * 0.01;
            dist = Math.sqrt(dx * dx + dy * dy);
          }
          const pairIncludesCurrent = Boolean(resolvedCurrentUserId && (a.id === resolvedCurrentUserId || b.id === resolvedCurrentUserId));
          const minDist = pairIncludesCurrent ? 284 : 248;
          if (dist >= minDist) continue;
          const ux = dx / dist;
          const uy = dy / dist;
          const push = ((minDist - dist) / minDist) * alpha * (pairIncludesCurrent ? 0.74 : 0.58);
          a.vx = (a.vx ?? 0) + ux * push;
          a.vy = (a.vy ?? 0) + uy * push;
          b.vx = (b.vx ?? 0) - ux * push;
          b.vy = (b.vy ?? 0) - uy * push;
        }
      }
    };
    sim.force("highConnectionSpread", highConnectionSpreadForce as d3.Force<GraphNode, GraphLink>);

    const ambientOrbitForce = (alpha: number) => {
      if (modeRef.current !== "free" || searchActiveRef.current || draggingNodeIdRef.current || demoMode) return;
      if (performance.now() < heavyInteractionUntilRef.current) return;
      const cx = width / 2;
      const cy = height / 2;
      const coreId = selectedIdRef.current ?? (currentUserNode?.id && nodeById.has(currentUserNode.id) ? currentUserNode.id : coreSeedId);
      let applied = 0;
      nodes.forEach((n: GraphNode) => {
        if (applied >= 8) return;
        if (n.id === coreId) return;
        if ((degree[n.id] ?? 0) >= 5) return;
        if (n.x == null || n.y == null) return;
        const dx = n.x - cx;
        const dy = n.y - cy;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const tangential = AMBIENT_ORBIT_SPEED * 0.46 * (0.35 + Math.min(1.2, dist / 380)) * (0.45 + alpha);
        n.vx = (n.vx ?? 0) + (-dy / dist) * tangential;
        n.vy = (n.vy ?? 0) + (dx / dist) * tangential;
        applied += 1;
      });
    };
    sim.force("ambientOrbit", ambientOrbitForce as d3.Force<GraphNode, GraphLink>);

    const quantumCollapseForce = (alpha: number) => {
      if (!searchActiveRef.current || modeRef.current !== "free") return;
      const matches = searchMatchesRef.current;
      if (matches.size === 0) return;

      const cx = width / 2;
      const cy = height / 2;

      nodes.forEach((n: GraphNode) => {
        if (n.x == null || n.y == null) return;
        if (matches.has(n.id)) {
          // Magnetize to center
          n.vx = (n.vx ?? 0) + (cx - n.x) * alpha * 1.5;
          n.vy = (n.vy ?? 0) + (cy - n.y) * alpha * 1.5;
        } else {
          // Crumble (push outwards chaotically)
          const dx = n.x - cx;
          const dy = n.y - cy;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const push = 1800 * alpha; // High outward force
          n.vx = (n.vx ?? 0) + (dx / dist) * push + (Math.random() - 0.5) * 15 * alpha;
          n.vy = (n.vy ?? 0) + (dy / dist) * push + (Math.random() - 0.5) * 15 * alpha;
        }
      });
    };
    sim.force("quantumCollapse", quantumCollapseForce as d3.Force<GraphNode, GraphLink>);

    // Pre-settle layout so nodes/links are already in place on first paint.
    const warmupTicks = Math.max(320, Math.min(720, Math.round(nodes.length * 3.4)));
    for (let i = 0; i < warmupTicks; i += 1) sim.tick();
    sim.alpha(0);
    sim.stop();
    linkSel.attr("d", (d: GraphLink) => curvePathForLink(d));
    nodeSel.attr("transform", (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    if (zoomRef.current && svgRef.current) {
      const positionedNodes = nodes.filter((n) => n.x != null && n.y != null);
      if (positionedNodes.length) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        positionedNodes.forEach((n) => {
          const x = n.x as number;
          const y = n.y as number;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        });
        const dx = maxX - minX || 1;
        const dy = maxY - minY || 1;
        const scale = Math.max(FIT_MIN_SCALE, Math.min(FIT_MAX_SCALE, 0.82 / Math.max(dx / width, dy / height)));
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const initialTransform = d3.zoomIdentity
          .translate(width / 2 - scale * midX, height / 2 - scale * midY)
          .scale(scale);
        d3.select(svgRef.current)
          .interrupt()
          .call(zoomRef.current.transform, initialTransform);
      }
    }

    let tick = 0;
    sim.on("tick", () => {
      tick += 1;
      const profile = MOTION_PROFILE[motionTierRef.current];
      const hoveredId = hoveredNodeIdRef.current;
      const activeForce = sim.alpha() > 0.045 || draggingNodeIdRef.current != null;
      const runHeavyTick = activeForce || hoveredId != null || modeRef.current === "path" || tick % profile.heavyTickDiv === 0;
      if (runHeavyTick) {
        linkSel.attr("d", (d: GraphLink) => curvePathForLink(d));
        nodeSel.attr("transform", (d: GraphNode) => {
          let nx = d.x ?? 0;
          let ny = d.y ?? 0;
          let scaleMul = 1;

          if (lensModeRef.current && lensPosRef.current && modeRef.current === "free") {
            const LENS_RADIUS = 280;
            const dx = nx - lensPosRef.current.x;
            const dy = ny - lensPosRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < LENS_RADIUS && dist > 0.01) {
              const force = 1 - dist / LENS_RADIUS;
              // Push radius outward and scale up heavily based on proximity
              const stretch = Math.pow(force, 1.2) * LENS_RADIUS * 1.8;
              nx += (dx / dist) * stretch;
              ny += (dy / dist) * stretch;
              scaleMul = 1 + force * 2.2;
            }
          }

          if (scaleMul !== 1) {
            return `translate(${nx},${ny}) scale(${scaleMul})`;
          }
          return `translate(${nx},${ny})`;
        });
        nodeSel.attr("class", null);

        // If lens is over a node, reveal labels!
        if (lensModeRef.current && lensPosRef.current && modeRef.current === "free") {
          nodeSel.select("text.node-label").style("opacity", (n: GraphNode) => {
            if (!lensPosRef.current) return 0;
            const dx = (n.x ?? 0) - lensPosRef.current.x;
            const dy = (n.y ?? 0) - lensPosRef.current.y;
            return Math.sqrt(dx * dx + dy * dy) < 280 ? 1 : 0;
          });
        }

        // Live Pulse Heatmap (Idea 15)
        if (heatmapModeRef.current && nodes.length > 0) {
          let sSumX = 0, sSumY = 0, sCount = 0;
          let oSumX = 0, oSumY = 0, oCount = 0;

          nodes.forEach(n => {
            if (n.x == null || n.y == null) return;
            if (n.type === 'student' && (degree[n.id] ?? 0) > 3) {
              sSumX += n.x; sSumY += n.y; sCount++;
            } else if (n.type === 'company' && (degree[n.id] ?? 0) < 2) {
              oSumX += n.x; oSumY += n.y; oCount++;
            }
          });

          if (energyDensityRef.current && sCount > 0) {
            const px = (sSumX / sCount) / width * 100;
            const py = (sSumY / sCount) / height * 100;
            energyDensityRef.current.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(16, 185, 129, 0.28) 0%, transparent 65%)`;
          }
          if (energyCoreRef.current && oCount > 0) {
            const px = (oSumX / oCount) / width * 100;
            const py = (oSumY / oCount) / height * 100;
            energyCoreRef.current.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(192, 57, 43, 0.18) 0%, transparent 55%)`;
          }
        }
      }

      if (modeRef.current === "path" && svgRef.current) {
        if (runHeavyTick || tick % 2 === 0) {
          d3.select(svgRef.current)
            .selectAll<SVGPathElement, unknown>(".path-overlay path")
            .attr("d", function () {
              const sourceId = this.getAttribute("data-source-id");
              const targetId = this.getAttribute("data-target-id");
              if (!sourceId || !targetId) return this.getAttribute("d") ?? "";
              const source = nodeById.get(sourceId);
              const target = nodeById.get(targetId);
              if (!source || !target) return this.getAttribute("d") ?? "";
              return curvePathBetweenNodes(source, target);
            });
        }
      }
      if (runHeavyTick || tick % 2 === 0) {
        updateMiniFn?.();
        updateMiniViewportRef.current?.();
      }

      if (runHeavyTick && modeRef.current === "free" && !hoveredNodeIdRef.current && !searchActiveRef.current) {
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

      if (runHeavyTick && (motionTierRef.current !== "performance" || hoveredId || selectedIdRef.current)) {
        flickerTimeRef.current += 0.014;
        nodeSel.select<SVGCircleElement>("circle.main-circle")
          .attr("stroke-opacity", (n: GraphNode, i: number) => {
            const amp = NODE_FLICKER_SWING + ((n.id === selectedIdRef.current || n.id === currentUserNodeId) ? NODE_FLICKER_HIGHLIGHT_BONUS : 0);
            const wave = Math.sin(flickerTimeRef.current + i * 0.53);
            return clamp01(NODE_FLICKER_BASE + wave * amp);
          });
      }

      // ── Edge pulse update ──────────────────────────────────────────────
      // CONSTANTS (tweak here):
      // particles animate via requestAnimationFrame loop

    });

    nodeSelRef.current = nodeSel;
    linkSelRef.current = linkSel as d3.Selection<SVGPathElement, GraphLink, SVGGElement, unknown>;
    simRef.current = sim;
    setD3Ready(true);
    simRef.current = sim;
    pulseLayerRef.current = pulseLayer;
    rippleLayerRef.current = rippleLayer;
    setD3Ready(true);
    let allowResizeForces = false;
    requestAnimationFrame(() => {
      setGraphSettling(false);
      window.setTimeout(() => {
        allowResizeForces = true;
      }, 500);
    });

    const applyCursorAwareness = (gx: number, gy: number) => {
      if (modeRef.current !== "free" || draggingNodeIdRef.current || hoveredNodeIdRef.current) return;
      const profile = MOTION_PROFILE[motionTierRef.current];
      const radius = GRAPH_MOTION.magnetic.radius * profile.magneticRadiusMul;
      const radiusSq = radius * radius;
      nodeSel.select<SVGCircleElement>("circle.main-circle")
        .attr("fill-opacity", (n: GraphNode) => {
          const dx = (n.x ?? 0) - gx;
          const dy = (n.y ?? 0) - gy;
          const distSq = dx * dx + dy * dy;
          if (distSq >= radiusSq) return n.id === currentUserNodeId ? 1 : 0.9;
          const t = 1 - Math.sqrt(distSq) / radius;
          return (n.id === currentUserNodeId ? 1 : 0.9) + t * 0.18;
        })
        .attr("transform", (n: GraphNode) => {
          const dx = gx - (n.x ?? 0);
          const dy = gy - (n.y ?? 0);
          const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
          if (dist >= radius) return "translate(0,0)";
          const t = 1 - dist / radius;
          const pull = GRAPH_MOTION.magnetic.maxOffsetPx * t * t;
          const ox = (dx / dist) * pull;
          const oy = (dy / dist) * pull;
          return `translate(${ox},${oy})`;
        });
      nodeSel.select<SVGCircleElement>("circle.node-aura-ring")
        .attr("transform", (n: GraphNode) => {
          const dx = gx - (n.x ?? 0);
          const dy = gy - (n.y ?? 0);
          const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
          if (dist >= radius) return "translate(0,0)";
          const t = 1 - dist / radius;
          const pull = GRAPH_MOTION.magnetic.maxOffsetPx * GRAPH_MOTION.magnetic.auraOffsetMul * t * t;
          return `translate(${(dx / dist) * pull},${(dy / dist) * pull})`;
        });
      nodeSel.select<SVGCircleElement>("circle.node-aura-halo")
        .attr("transform", (n: GraphNode) => {
          const dx = gx - (n.x ?? 0);
          const dy = gy - (n.y ?? 0);
          const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
          if (dist >= radius) return "translate(0,0)";
          const t = 1 - dist / radius;
          const pull = GRAPH_MOTION.magnetic.maxOffsetPx * (GRAPH_MOTION.magnetic.auraOffsetMul + 0.18) * t * t;
          return `translate(${(dx / dist) * pull},${(dy / dist) * pull})`;
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
      markHeavyInteraction(180);
      const [mx, my] = d3.pointer(e, svgRef.current);
      const currentTransform = d3.zoomTransform(svgRef.current);
      const gx = (mx - currentTransform.x) / currentTransform.k;
      const gy = (my - currentTransform.y) / currentTransform.k;
      pointerAwarePendingRef.current = { x: gx, y: gy };
      const now = performance.now();
      if (now - pointerAwareLastTsRef.current < MOTION_PROFILE[motionTierRef.current].pointerThrottleMs) return;
      if (pointerAwareRafRef.current != null) return;
      pointerAwareRafRef.current = requestAnimationFrame(() => {
        pointerAwareRafRef.current = null;
        pointerAwareLastTsRef.current = performance.now();
        const pending = pointerAwarePendingRef.current;
        if (!pending) return;
        applyCursorAwareness(pending.x, pending.y);
      });
    });

    svg.on("mouseleave.aware", () => {
      if (modeRef.current !== "free" || draggingNodeIdRef.current) return;
      pointerAwarePendingRef.current = null;
      if (pointerAwareRafRef.current != null) {
        cancelAnimationFrame(pointerAwareRafRef.current);
        pointerAwareRafRef.current = null;
      }
      nodeSel.select<SVGCircleElement>("circle.main-circle")
        .attr("fill-opacity", (n: GraphNode) => n.id === currentUserNodeId ? 1 : 0.9)
        .attr("transform", null);
      nodeSel.select<SVGCircleElement>("circle.node-aura-ring").attr("transform", null);
      nodeSel.select<SVGCircleElement>("circle.node-aura-halo").attr("transform", null);
      linkSel.attr("stroke-opacity", (l: GraphLink) => defOp(l));
    });

    svg.on("click", () => {
      noteInteraction();
      setEdgeExplain(null);
      if (modeRef.current !== "free") deselectAll();
    });

    let resizeObserver: ResizeObserver | null = null;
    const onResize = () => {
      const { w, h } = getGraphViewportDims();
      dimsRef.current = { w, h };
      sim.force("center", d3.forceCenter(w / 2, h / 2).strength(0.04));
      if (allowResizeForces) sim.alpha(0.3).restart();
      updateMiniViewportRef.current?.();
    };
    window.addEventListener("resize", onResize);
    if (typeof ResizeObserver !== "undefined" && svgRef.current) {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(svgRef.current);
    }

    return () => {
      setGraphSettling(true);
      setD3Ready(false);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
      if (inertiaRafRef.current) cancelAnimationFrame(inertiaRafRef.current);
      if (particleRafRef.current) cancelAnimationFrame(particleRafRef.current);
      if (pointerAwareRafRef.current != null) cancelAnimationFrame(pointerAwareRafRef.current);
      if (demoTimerRef.current) {
        window.clearTimeout(demoTimerRef.current);
        demoTimerRef.current = null;
      }
      if (selectionCommitTimerRef.current) {
        window.clearTimeout(selectionCommitTimerRef.current);
        selectionCommitTimerRef.current = null;
      }
      ignitionTimers.forEach((t) => window.clearTimeout(t));
      activeParticles.forEach(p => p.el.remove());
      activeParticles.length = 0;
      pulseLayerRef.current = null;
      rippleLayerRef.current = null;
      labelSelRef.current = null;
      rootEl?.classList.remove("perf-interacting");
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
    triggerOpportunityExplosion(pathNodeIds);
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
  }, [mode, pathNodeIds, fadeLabels, fitToNodeIds, triggerOpportunityExplosion]);

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
    const matches = new Set(searchMatches.map((n) => n.id));
    const wasActive = searchMatchesRef.current.size > 0;
    searchMatchesRef.current = matches;

    if (!searchQuery.trim()) {
      nodeSelRef.current?.transition().duration(200).style("opacity", 1);
      linkSelRef.current?.transition().duration(180).attr("stroke-opacity", (l: GraphLink) => defOp(l));
      fadeLabels(defaultLabelOpacity, 140);
      if (wasActive) simRef.current?.alpha(0.8).restart(); // Recover from explosion
      return;
    }

    simRef.current?.alpha(1).restart(); // Trigger quantum collapse
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
    fadeLabels((d: GraphNode) => (matches.has(d.id) ? defaultLabelOpacity(d) : 0), 120);
  }, [searchQuery, searchMatches, mode, fadeLabels, multiSelectedIds.size, defaultLabelOpacity]);

  const userConnCount = useMemo(() =>
    links.filter(l =>
      getNodeId(l.source) === currentUserNodeId || getNodeId(l.target) === currentUserNodeId
    ).length,
    [links, currentUserNodeId]);

  const visibleTypeCounts = useMemo(() => ({
    students: nodes.filter(n => n.type === "student" && !hiddenTypes.has(n.type)).length,
    organizations: nodes.filter(n => n.type === "club" && !hiddenTypes.has(n.type)).length,
    companies: nodes.filter(n => n.type === "company" && !hiddenTypes.has(n.type)).length,
  }), [hiddenTypes, nodes]);

  const reachableCompanies = useMemo(() => {
    const fromId = selectedNode?.id ?? currentUserNodeId ?? user?.id;
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
  }, [links, nodes, selectedNode?.id, currentUserNodeId, user?.id]);

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
    fadeLabels(defaultLabelOpacity, 120);
  }, [viewMode, mode, fadeLabels, defaultLabelOpacity]);

  useEffect(() => {
    const nodeSel = nodeSelRef.current;
    if (!nodeSel) return;

    if (heatmapMode) {
      const degree: Record<string, number> = {};
      links.forEach((l) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        degree[s] = (degree[s] ?? 0) + 1;
        degree[t] = (degree[t] ?? 0) + 1;
      });
      const maxDeg = Math.max(...nodes.map(n => degree[n.id] ?? 1), 1);
      const thermalColor = (n: GraphNode) => {
        let score = (degree[n.id] ?? 1) / maxDeg;
        if (n.type === "company" || n.type === "professor") score = Math.min(1, score + 0.35);
        if (score < 0.15) return "#020b1e"; // Cold deep space
        if (score < 0.35) return "#240046"; // Cold purple
        if (score < 0.55) return "#7b2cbf"; // Warm magenta
        if (score < 0.75) return "#f72585"; // Hot pink/red
        if (score < 0.90) return "#ff9e00"; // Hot orange
        return "#ffff3f"; // White/Yellow core heat
      };

      nodeSel.select("circle.main-circle").transition().duration(800)
        .attr("fill", thermalColor)
        .attr("stroke", thermalColor);
      nodeSel.select("circle.node-aura-halo").transition().duration(800)
        .attr("fill", thermalColor);
      nodeSel.select("circle.node-aura-ring").transition().duration(800)
        .attr("stroke", thermalColor);

    } else {
      nodeSel.select("circle.main-circle").transition().duration(800)
        .attr("fill", (d: GraphNode) => d.id === currentUserNodeId ? "#facc15" : TYPE_COLOR[d.type])
        .attr("stroke", (d: GraphNode) => d.id === currentUserNodeId ? "#fef3c7" : TYPE_COLOR[d.type]);
      nodeSel.select("circle.node-aura-halo").transition().duration(800)
        .attr("fill", (d: GraphNode) => TYPE_COLOR[d.type]);
      nodeSel.select("circle.node-aura-ring").transition().duration(800)
        .attr("stroke", (d: GraphNode) => TYPE_COLOR[d.type]);
    }
  }, [heatmapMode, nodes, links, currentUserNodeId]);

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
  }, [selectedNode, selectedNode?.id, viewMode, demoMode, mode, pathNodeIds.length, overlaySafeRight]);

  const selectNodeFromSpatial = useCallback((id: string) => {
    noteInteraction();
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
  }, [nodes, noteInteraction]);

  const handleSearchEnter = useCallback((rawQuery: string) => {
    const query = normalizeSearchName(rawQuery);
    setSearchQuery("");
    searchActiveRef.current = false;
    searchMatchesRef.current = new Set();

    if (!query) {
      showSearchMessage("Type a name, then press Enter");
      return;
    }

    const namesForNode = (n: GraphNode) => [
      n.label,
      n.details?.name,
      n.details?.label,
    ].map(normalizeSearchName).filter(Boolean);

    const exactMatches = nodes.filter((n) => namesForNode(n).some((name) => name === query));
    const candidates = exactMatches.length > 0
      ? exactMatches
      : nodes.filter((n) => namesForNode(n).some((name) => name.includes(query)));

    if (candidates.length === 0) {
      showSearchMessage("No matching node found");
      return;
    }
    if (candidates.length > 1) {
      showSearchMessage("Multiple matches. Type more of the name");
      return;
    }

    const target = candidates[0];
    setSearchInput(target.label);
    if (viewMode === "3d") {
      selectNodeFromSpatial(target.id);
      return;
    }
    selectNodeFn(target);
  }, [nodes, viewMode, selectNodeFromSpatial, selectNodeFn, showSearchMessage]);

  const handleSpatialBackgroundClick = useCallback(() => {
    noteInteraction();
    setEdgeExplain(null);
    if (modeRef.current !== "free") {
      deselectAll();
    }
  }, [deselectAll, noteInteraction]);

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
        if (selectionCommitTimerRef.current) {
          window.clearTimeout(selectionCommitTimerRef.current);
          selectionCommitTimerRef.current = null;
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
    noteInteraction();
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
    if (selectionCommitTimerRef.current) {
      window.clearTimeout(selectionCommitTimerRef.current);
      selectionCommitTimerRef.current = null;
    }
  }, [exitToFree, noteInteraction]);

  const startDemoMode = useCallback(() => {
    noteInteraction();
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
  }, [exitToFree, noteInteraction, stopDemoMode]);
  const stageDemoMessage = useCallback((message: string, delayMs = 220) => {
    if (demoTimerRef.current) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    demoTimerRef.current = window.setTimeout(() => {
      setDemoMessage(message);
      demoTimerRef.current = null;
    }, delayMs);
  }, []);
  useEffect(() => {
    if (!demoMode) return;
    if (demoAppliedStepRef.current === demoStep) return;
    demoAppliedStepRef.current = demoStep;

    const userNode = currentUserNode;
    if (!userNode) {
      stageDemoMessage("Walkthrough unavailable: current profile node is not present in this graph.", 120);
      return;
    }
    const userNeighbors = topNeighbors(userNode, 8);
    const contextNeighbors = userNeighbors
      .filter((n) => n.type === "club" || n.type === "interest")
      .slice(0, 3);
    const demoCompany = reachableCompanies[0];

    if (demoStep === 0 && userNode) {
      stageDemoMessage("Step 1/4 - Focus on your profile node", 220);
      if (viewMode === "2d") triggerFullSystemPulse(userNode.id);
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
      stageDemoMessage("Step 2/4 - Nearby clubs and interests reveal your network context", 240);
      if (viewMode === "2d") triggerFullSystemPulse(userNode.id);
      const focusIds = [userNode.id, ...(contextNeighbors.length ? contextNeighbors : userNeighbors.slice(0, 2)).map((n) => n.id)];
      if (viewMode === "3d") {
        setSpatialFocusNodeIds(focusIds);
      } else {
        fitToNodeIds(focusIds, 900);
      }
      return;
    }
    if (demoStep === 2 && demoCompany) {
      stageDemoMessage(`Step 3/4 - Trace strongest path to ${demoCompany.label}`, 260);
      if (viewMode === "2d") triggerFullSystemPulse(demoCompany.id);
      setCompanyQuery(demoCompany.label);
      if (viewMode === "3d") {
        setSpatialFocusNodeIds(userNode ? [userNode.id, demoCompany.id] : [demoCompany.id]);
      }
      void findPath(demoCompany.label);
      return;
    }
    if (demoStep === 3) {
      stageDemoMessage("Step 4/4 - Path insight: your network has a credible route to this opportunity", 260);
      if (viewMode === "3d" && pathNodeIds.length) {
        setSpatialFocusNodeIds(pathNodeIds);
      }
    }
  }, [demoMode, demoStep, currentUserNode, topNeighbors, reachableCompanies, selectNodeFn, fitToNodeIds, findPath, viewMode, pathNodeIds, triggerFullSystemPulse, stageDemoMessage]);

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
  const graphInitialLoad = loading || graphSettling || !d3Ready;

  const edgeExplainStyle = (() => {
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
  })();

  return (
    <div className={`root perf-${motionTier}${graphInitialLoad ? " graph-initializing" : ""}`} ref={rootRef} data-motion-tier={motionTier}>

      {/* Intro animation overlay — renders on top while graph loads underneath */}

      <div className="graphHeader">
        <div className="graphHeaderCopy">
          <span className="graphEyebrow">Campus Connections</span>
          <h1 className="graphTitle">Campus Network</h1>
          <p className="graphSubtitle">{modeDescription}</p>
        </div>

        <div className="graphHeaderMeta">
          <button
            type="button"
            className={`graphDemoBtn${demoMode ? " graphDemoBtn--active" : ""}`}
            onClick={() => demoMode ? stopDemoMode() : startDemoMode()}
          >
            {demoMode ? "Exit Walkthrough" : "Start Walkthrough"}
          </button>
          <span className={`graphModeBadge graphModeBadge--${mode}`}>{modeLabel}</span>
          {perfDebug && (
            <span className="graphHeaderChip graphHeaderChip--perf">
              motion: <strong>{motionTier}</strong>
            </span>
          )}
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
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          onEnter={handleSearchEnter}
          message={searchMessage}
        />
        <FilterBar hiddenTypes={hiddenTypes} onToggleType={toggleType} />
        <button
          className={`btn-ghost ${heatmapMode ? "active" : ""}`}
          style={{ padding: "4px 8px", background: heatmapMode ? "rgba(255, 69, 0, 0.2)" : undefined, color: heatmapMode ? "#ff4500" : undefined, border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", display: "flex", gap: "6px", alignItems: "center", cursor: "pointer" }}
          onClick={() => setHeatmapMode(p => !p)}
          title="Toggle Thermal Heatmap"
        >
          <Flame size={14} />
          {heatmapMode ? "Heatmap: ON" : "Heatmap"}
        </button>
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
      <div className="main" data-heatmap={heatmapMode}>
        <div ref={ambientFxRef} className={`graphAmbientFx${viewMode === "3d" ? " graphAmbientFx--hidden" : ""}`} aria-hidden="true">
          <div className="graphAmbientLayer graphAmbientLayer--far" ref={ambientFarRef}>
            {ambientSpecks.far.map((speck) => (
              <span
                key={speck.id}
                className={`graphSpeck${speck.twinkle ? " graphSpeck--twinkle" : ""}`}
                style={{
                  left: `${speck.x}%`,
                  top: `${speck.y}%`,
                  width: `${speck.size}px`,
                  height: `${speck.size}px`,
                  opacity: speck.opacity,
                }}
              />
            ))}
          </div>
          <div className="graphAmbientLayer graphAmbientLayer--mid" ref={ambientMidRef}>
            {ambientSpecks.mid.map((speck) => (
              <span
                key={speck.id}
                className={`graphSpeck graphSpeck--mid${speck.twinkle ? " graphSpeck--twinkle" : ""}`}
                style={{
                  left: `${speck.x}%`,
                  top: `${speck.y}%`,
                  width: `${speck.size}px`,
                  height: `${speck.size}px`,
                  opacity: speck.opacity,
                }}
              />
            ))}
          </div>
          <div className="graphAmbientLayer graphAmbientLayer--near" ref={ambientNearRef}>
            {ambientSpecks.near.map((speck) => (
              <span
                key={speck.id}
                className={`graphSpeck graphSpeck--near${speck.twinkle ? " graphSpeck--twinkle" : ""}`}
                style={{
                  left: `${speck.x}%`,
                  top: `${speck.y}%`,
                  width: `${speck.size}px`,
                  height: `${speck.size}px`,
                  opacity: speck.opacity,
                }}
              />
            ))}
          </div>
          <div className="graphAmbientGrain" ref={ambientGrainRef} />
          <div className="graphEnergyField graphEnergyField--density" ref={energyDensityRef} />
          <div className="graphEnergyField graphEnergyField--core" ref={energyCoreRef} />
          <div className="graphAmbientFog graphAmbientFog--core" />
          <div className="graphAmbientFog graphAmbientFog--secondary" />
          <div className="graphAmbientSpecks" />
          <div className="graphScanSweep" ref={scanSweepRef} />
        </div>
        <div className="bgGlow" ref={bgGlowRef} />
        <svg id="graph-svg" ref={svgRef} style={{ flex: 1 }} className={viewMode === "3d" ? "graph2DHidden" : "graph2DVisible"} />
        {graphInitialLoad && (
          <div className="graphInitialLoad" aria-live="polite" aria-busy="true">
            <div className="graphInitialLoadTitle">Preparing campus network</div>
            <div className="graphInitialLoadText">Settling nodes before display</div>
          </div>
        )}
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
              currentUserId={currentUserNodeId ?? ""}
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
