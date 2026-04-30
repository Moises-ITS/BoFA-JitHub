// ─────────────────────────────────────────────────────────────────────────────
// hooks/useGraphData.ts
// Fetches nodes and links from the Express backend.
// Falls back to mock data when the backend is unavailable (local dev without API).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { mockNodes, mockLinks } from "../data/mockGraphData";
import { useAuth } from "../../../context/AuthContext";

interface GraphData {
  nodes:   GraphNode[];
  links:   GraphLink[];
  loading: boolean;
  error:   string | null;
  refresh: () => Promise<void>;
}

export function useGraphData(): GraphData {
  const { token, user } = useAuth();
  const [nodes,   setNodes]   = useState<GraphNode[]>([]);
  const [links,   setLinks]   = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);
  const fetchedForUserIdRef = useRef<string | null>(null);

  const fetchGraphData = useCallback(async (force = false) => {
    const API = import.meta.env.VITE_API_URL;
    const userId = user?.id ?? null;

    if (!API || !token) {
      setNodes(mockNodes);
      setLinks(mockLinks);
      setLoading(false);
      fetchedForUserIdRef.current = null;
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
      const nodesData: GraphNode[] = await nodesRes.json();
      const linksData: GraphLink[] = await linksRes.json();
      setNodes(nodesData);
      setLinks(linksData);
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
