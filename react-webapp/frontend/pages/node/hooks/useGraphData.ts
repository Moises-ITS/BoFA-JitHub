// ─────────────────────────────────────────────────────────────────────────────
// hooks/useGraphData.ts
// Fetches nodes and links from the Express backend.
// Falls back to mock data when the backend is unavailable (local dev without API).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import type { GraphNode, GraphLink } from "../types/graphNodes";
import { mockNodes, mockLinks } from "../data/mockGraphData";

interface GraphData {
  nodes:   GraphNode[];
  links:   GraphLink[];
  loading: boolean;
  error:   string | null;
}

export function useGraphData(): GraphData {
  const [nodes,   setNodes]   = useState<GraphNode[]>([]);
  const [links,   setLinks]   = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const API = import.meta.env.VITE_API_URL;

    if (!API) {
      setNodes(mockNodes);
      setLinks(mockLinks);
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`${API}/api/graph/nodes`),
      fetch(`${API}/api/graph/links`),
    ])
      .then(async ([nodesRes, linksRes]) => {
        if (!nodesRes.ok) throw new Error(`Nodes fetch failed: ${nodesRes.status}`);
        if (!linksRes.ok) throw new Error(`Links fetch failed: ${linksRes.status}`);
        const nodesData: GraphNode[] = await nodesRes.json();
        const linksData: GraphLink[] = await linksRes.json();
        setNodes(nodesData);
        setLinks(linksData);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[useGraphData] Backend unreachable, falling back to mock data:", message);
        setNodes(mockNodes);
        setLinks(mockLinks);
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { nodes, links, loading, error };
}
