// ─────────────────────────────────────────────────────────────────────────────
// utils/getNodeId.ts
// Helper that safely extracts a node's string ID regardless of whether
// D3 has already replaced the string with a full GraphNode object
// ─────────────────────────────────────────────────────────────────────────────

import type { GraphNode } from "../types/graphNodes";

export function getNodeId(n: string | GraphNode): string {
  return typeof n === "object" ? n.id : n;
}