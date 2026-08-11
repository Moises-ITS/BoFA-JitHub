/**
 * utils/graphMath.ts — pure geometry and edge-styling math for the campus
 * graph. No React, no D3 selections, no side effects: every function maps
 * (link|node|number) → number|string, which is what makes this the most
 * unit-testable slice of the graph and why it was extracted first.
 *
 * The edge* family defines the visual grammar of relationships: strength
 * (weight+confidence blend) drives width/opacity/tier; relationship type
 * drives color and dash (company links always solid/primary, interest links
 * dashed/faint, student↔student connections purple).
 */
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { EDGE_WIDTH_MIN, EDGE_WIDTH_MAX } from "../constants/graphMotion";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const easeInOut = (t: number) => t * t * (3 - 2 * t);
export const edgeStrength = (l: GraphLink) => clamp01(((l.weight ?? 0.5) * 0.74) + ((l.opacity ?? 0.65) * 0.26));
export const edgeTierFromStrength = (s: number) => s >= 0.78 ? 1 : s >= 0.48 ? 2 : 3;
export const edgeWidthFromStrength = (s: number) => EDGE_WIDTH_MIN + easeInOut(s) * (EDGE_WIDTH_MAX - EDGE_WIDTH_MIN);
export const edgeOpacityFromStrength = (s: number) => 0.04 + easeInOut(s) * 0.26;
export const edgePairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const isCompanyRel = (rel: string) => rel === "WORKS_AT" || rel === "WORKED_AT";
export const edgeDashForLink = (l: GraphLink) => {
  // Company links should always be visually primary and solid.
  if (isCompanyRel(l.rel)) return null;
  return (l.style === "dashed" || l.rel === "INTERESTED_IN") ? "5,4" : null;
};
export const edgeStrokeColorForLink = (l: GraphLink) => {
  if (l.rel === "CONNECTED_TO") return "#8b5cf6";
  if (isCompanyRel(l.rel)) return "#93c5fd";
  if (l.rel === "MEMBER_OF" || l.rel === "SAME_MAJOR") return "#58789b";
  if (l.rel === "INTERESTED_IN") return "#4a647e";
  return null;
};
export const edgeWidthForLink = (l: GraphLink) => {
  const base = edgeWidthFromStrength(edgeStrength(l));
  if (l.rel === "CONNECTED_TO" || isCompanyRel(l.rel)) return base + 0.7;
  if (l.rel === "MEMBER_OF" || l.rel === "SAME_MAJOR") return Math.max(0.85, base * 0.82);
  if (l.rel === "INTERESTED_IN") return Math.max(0.75, base * 0.74);
  return base;
};

export const lockedOrbitRadiusForConnections = (count: number) => {
  const clamped = Math.max(0, count);
  if (clamped <= 0) return 104;
  const minRadius = 118;
  const grown = minRadius + Math.sqrt(clamped) * 20;
  return Math.min(300, grown);
};

export const curvePathBetweenNodes = (
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
