// ─────────────────────────────────────────────────────────────────────────────
// hooks/useGraphData.ts
// Fetches nodes and links from the Express backend
// Replaces the old static nodes.ts and links.ts files entirely
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { GraphNode, GraphLink } from "../types/graphNodes";

interface GraphData {
  nodes:   GraphNode[];
  links:   GraphLink[];
  loading: boolean;       // true while fetch is in progress
  error:   string | null; // error message if fetch failed, null if ok
}

export function useGraphData(): GraphData {
  const [nodes,   setNodes]   = useState<GraphNode[]>([]);
  const [links,   setLinks]   = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    // VITE_API_URL comes from frontend/.env.local
    // locally:    http://localhost:3001
    // production: https://your-backend.railway.app
    const API = import.meta.env.VITE_API_URL

    // Promise.all fetches both endpoints at the same time
    // rather than waiting for nodes to finish before starting links
    Promise.all([
      fetch(`${API}/api/graph/nodes`),
      fetch(`${API}/api/graph/links`),
    ])
      .then(async ([nodesRes, linksRes]) => {
        // check both responses came back ok before parsing
        if (!nodesRes.ok) throw new Error(`Nodes fetch failed: ${nodesRes.status}`);
        if (!linksRes.ok) throw new Error(`Links fetch failed: ${linksRes.status}`);

        const nodesData: GraphNode[] = await nodesRes.json();
        const linksData: GraphLink[] = await linksRes.json();

        setNodes(nodesData);
        setLinks(linksData);
      })
      .catch(err => {
        // catches both network errors and the thrown errors above
        setError(err.message);
      })
      .finally(() => {
        // always runs — sets loading to false whether fetch succeeded or failed
        setLoading(false);
      });

  }, []); // empty [] = fetch once when component mounts

  return { nodes, links, loading, error };
}