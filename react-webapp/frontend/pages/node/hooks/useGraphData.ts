// ─────────────────────────────────────────────────────────────────────────────
// hooks/useGraphData.ts
// Fetches nodes and links from the Express backend.
// Falls back to mock data when the backend is unavailable (local dev without API).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { mockNodes, mockLinks } from "../data/mockGraphData";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../lib/api";

interface GraphData {
  nodes:   GraphNode[];
  links:   GraphLink[];
  loading: boolean;
  error:   string | null;
  refresh: () => Promise<void>;
}

const GRAPH_NODE_TYPES = new Set<GraphNode["type"]>([
  "student",
  "club",
  "company",
  "professor",
  "interest",
]);

const GRAPH_LINK_STYLES = new Set<GraphLink["style"]>(["solid", "dashed", "direct"]);

const asString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
};

const asFiniteNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
};

const normalizeNode = (raw: unknown, index: number): GraphNode => {
  const node = (raw ?? {}) as Partial<GraphNode>;
  const id = asString(node.id, `node-${index}`);
  const label = asString(node.label, id);
  const type = GRAPH_NODE_TYPES.has(node.type as GraphNode["type"]) ? (node.type as GraphNode["type"]) : "student";
  const details = node.details && typeof node.details === "object" ? node.details : {};

  return {
    ...node,
    id,
    label,
    type,
    details,
  };
};

const normalizeLink = (raw: unknown): GraphLink | null => {
  const link = (raw ?? {}) as Partial<GraphLink>;
  if (link.source == null || link.target == null) return null;

  const style = GRAPH_LINK_STYLES.has(link.style as GraphLink["style"]) ? (link.style as GraphLink["style"]) : "solid";

  return {
    ...link,
    source: link.source,
    target: link.target,
    rel: asString(link.rel, ""),
    weight: asFiniteNumber(link.weight, 0),
    opacity: asFiniteNumber(link.opacity, 1),
    style,
  };
};

export function useGraphData(): GraphData {
  const { token, user } = useAuth();
  const [nodes,   setNodes]   = useState<GraphNode[]>([]);
  const [links,   setLinks]   = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);
  const fetchedForUserIdRef = useRef<string | null>(null);

  const fetchGraphData = useCallback(async (force = false) => {
    // API_BASE_URL always resolves (env var or localhost fallback), so unlike the
    // old inline env read, "no API" is no longer a possible state — only the
    // token gate below decides whether we're ready to fetch.
    const API = API_BASE_URL;
    const userId = user?.id ?? null;

    if (!token) {
      // Keep current graph state stable while auth/API initializes.
      // This avoids brief mock-data swaps when token availability changes.
      return;
    }

    if (
      !force &&
      userId &&
      fetchedForUserIdRef.current === userId &&
      nodes.length > 0 &&
      links.length > 0
    ) {
      return;
    }

    if (!force) setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [nodesRes, linksRes] = await Promise.all([
        fetch(`${API}/api/graph/nodes`, { headers }),
        fetch(`${API}/api/graph/links`, { headers }),
      ]);
      if (!nodesRes.ok) throw new Error(`Nodes fetch failed: ${nodesRes.status}`);
      if (!linksRes.ok) throw new Error(`Links fetch failed: ${linksRes.status}`);
      const nodesData = await nodesRes.json();
      const linksData = await linksRes.json();

      const normalizedNodes = Array.isArray(nodesData)
        ? nodesData.map((node, index) => normalizeNode(node, index))
        : [];
      const normalizedLinks = Array.isArray(linksData)
        ? linksData.map(normalizeLink).filter((link): link is GraphLink => link !== null)
        : [];

      setNodes(normalizedNodes);
      setLinks(normalizedLinks);
      setError(null);
      fetchedForUserIdRef.current = userId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useGraphData] Backend unreachable, falling back to mock data:", message);
      setNodes(mockNodes);
      setLinks(mockLinks);
      setError(message);
      fetchedForUserIdRef.current = null;
    } finally {
      if (force) return;
      setLoading(false);
    }
  }, [token, user?.id, nodes.length, links.length]);

  useEffect(() => {
    void fetchGraphData(false);
  }, [fetchGraphData]); // token may rotate; guard above prevents unnecessary refetches

  return { nodes, links, loading, error, refresh: () => fetchGraphData(true) };
}
