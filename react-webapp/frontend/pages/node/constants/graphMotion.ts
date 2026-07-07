/**
 * constants/graphMotion.ts — every tunable number behind the campus graph's
 * motion design: pulse speeds, glow lifts, stagger timings, idle cadences,
 * and the per-device-tier performance profiles.
 *
 * WHY THIS FILE EXISTS: these ~200 lines of configuration lived at the top of
 * the 4,000-line CampusGraph component, so "tweak an animation timing" meant
 * opening the monolith. They are pure data with zero React/D3 dependencies —
 * a designer-facing tuning surface that deserves its own file.
 *
 * MOTION_PROFILE is the graph's performance governor: getInitialMotionTier
 * classifies the device/graph-size combination once, and the chosen profile
 * throttles cohort counts, pointer sampling, and flow-line volume so 2000-node
 * ambitions don't melt a mid-range laptop.
 */
export const MAX_NEIGHBORS = 9;
export const HUB_MAX = 6;
export const EDGE_WIDTH_MIN = 1.1;
export const EDGE_WIDTH_MAX = 3.9;
export const LABEL_FADE_MS = 180;
export const NODE_FLICKER_BASE = 0.84;
export const NODE_FLICKER_SWING = 0.08;
export const NODE_FLICKER_HIGHLIGHT_BONUS = 0.03;
export const FIT_PADDING = 96;
export const FIT_MIN_SCALE = 0.42;
export const FIT_MAX_SCALE = 2.35;
export const DEMO_TOTAL_STEPS = 4;
export const AMBIENT_ORBIT_SPEED = 0.00062;
export const HUB_BUNDLE_DEGREE = 5;
export const MINIMAP_W = 190;
export const MINIMAP_H = 130;
export const FLOW_ACTIVE_MIN = 4;
export const FLOW_ACTIVE_MAX = 10;
export const OVERLAY_SAFE_MARGIN = 12;
export const LOCKED_VIEWPORT_COVERAGE = 0.86;
export const LOCKED_FIT_MIN_SCALE = 0.24;
export const GRAPH_MOTION = {
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

export type MotionTier = "full" | "balanced" | "performance";

export const getInitialMotionTier = (nodeCount: number, linkCount: number, reducedMotion: boolean): MotionTier => {
  if (reducedMotion) return "performance";
  const complexity = nodeCount + linkCount * 0.65;
  if (complexity > 520) return "performance";
  if (complexity > 260) return "balanced";
  return "full";
};

export const MOTION_PROFILE: Record<MotionTier, {
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
