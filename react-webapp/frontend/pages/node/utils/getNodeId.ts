import { GraphNode } from "../types/graphNodes";

export function getNodeId(n: string | GraphNode): string {
  return typeof n === "object" ? n.id : n;
}
