// ─────────────────────────────────────────────────────────────────────────────
// CampusGraph.tsx
// Main component — owns all state and D3 logic
// Data comes from Neo4j via the useGraphData hook (no more static files)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";

import { GraphNode, GraphLink, NodeType } from "./types/graphNodes";
import { TYPE_COLOR }                     from "./constants/maps";
import { getNodeId }                      from "./utils/getNodeId";
import { useGraphData }                   from "./hooks/useGraphData";
import SidePanel                          from "./components/SidePanel";
import FilterBar                          from "./components/FilterBar";
import SearchBar                          from "./components/SearchBar";
import Legend                             from "./components/Legend";
import { useAuth }                        from "../../context/AuthContext";
import "./CampusGraph.css";

export default function CampusGraph() {

  const { logout } = useAuth();
  const navigate   = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────────
  // Replaces the old static NODES and LINKS imports
  // loading = true while fetch is in progress
  // error   = string message if fetch failed, null if ok
  const { nodes, links, loading, error } = useGraphData();

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hiddenTypes,  setHiddenTypes]  = useState<Set<NodeType>>(new Set());
  const [searchQuery,  setSearchQuery]  = useState<string>("");
  const [visibleCount, setVisibleCount] = useState<number>(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  // useRef — holds D3 selections without triggering re-renders
  const svgRef     = useRef<SVGSVGElement>(null);
  const nodeSelRef = useRef<d3.Selection<SVGGElement,   GraphNode, SVGGElement, unknown> | null>(null);
  const linkSelRef = useRef<d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null);
  const simRef     = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const selectNode = useCallback((d: GraphNode) => {
    setSelectedNode(d);
    const connected = new Set([d.id]);
    links.forEach(l => {
      const s = getNodeId(l.source), t = getNodeId(l.target);
      if (s === d.id) connected.add(t);
      if (t === d.id) connected.add(s);
    });
    nodeSelRef.current
      ?.classed("dimmed",   n => !connected.has(n.id))
       .classed("selected", n => n.id === d.id);
    linkSelRef.current?.classed("highlighted", l =>
      getNodeId(l.source) === d.id || getNodeId(l.target) === d.id
    );
  // links is from the hook so it belongs in the dependency array
  }, [links]);

  const deselectAll = useCallback(() => {
    setSelectedNode(null);
    nodeSelRef.current?.classed("dimmed", false).classed("selected", false);
    linkSelRef.current?.classed("highlighted", false);
  }, []);

  const toggleType = (type: NodeType) => {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // ── D3 Setup ──────────────────────────────────────────────────────────────
  // Wont run until loading is false and data has arrived
  // nodes and links are in the dependency array — D3 rebuilds if data refreshes
  useEffect(() => {
    // Guard 1 — dont run while data is still fetching
    if (loading) return;

    // Guard 2 — dont run if the fetch failed
    if (error) return;

    // Guard 3 — dont run if SVG ref isnt attached to the DOM yet
    if (!svgRef.current) return;

    // Guard 4 — dont run if data came back empty
    if (nodes.length === 0) return;

    const svg    = d3.select(svgRef.current);
    const width  = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Set initial visible count now that we have real data
    setVisibleCount(nodes.length);

    // Compute degree-based node radii — more connections = bigger node
    const degree: Record<string, number> = {};
    nodes.forEach(n => (degree[n.id] = 0));
    links.forEach(l => {
      const s = l.source as string, t = l.target as string;
      degree[s] = (degree[s] || 0) + 1;
      degree[t] = (degree[t] || 0) + 1;
    });
    nodes.forEach(n => (n.r = Math.max(10, Math.min(24, 8 + (degree[n.id] || 0) * 1.8))));

    // Deep-copy links so D3 can mutate source/target without modifying originals
    const simLinks: GraphLink[] = links.map(l => ({ ...l }));

    const g = svg.append("g").attr("class", "graph-root");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom);

    // Link elements
    const linkSel = g.append("g")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(simLinks).enter().append("line")
      .attr("class", "link");

    // Node elements
    const nodeSel = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes).enter().append("g")
      .attr("class", "node")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on("click", (e, d) => { e.stopPropagation(); selectNode(d); });

    // Circle — fill is per-node so set via D3 attribute
    nodeSel.append("circle")
      .attr("r",              d => d.r ?? 10)
      .attr("fill",           d => TYPE_COLOR[d.type])
      .attr("fill-opacity",   0.85)
      .attr("stroke",         d => TYPE_COLOR[d.type])
      .attr("stroke-width",   2)
      .attr("stroke-opacity", 0.4);

    // Label text
    nodeSel.append("text")
      .attr("dy",             d => (d.r ?? 10) + 13)
      .text(d => d.label)
      .attr("font-size",      d => d.type === "company" ? "11px" : "10px")
      .attr("font-weight",    d => ["company", "professor"].includes(d.type) ? "600" : "400")
      .attr("fill",           "#cbd5e1")
      .attr("text-anchor",    "middle")
      .attr("pointer-events", "none");

    // Force simulation
    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id(d => d.id)
        .distance(d => {
          const s = d.source as GraphNode, t = d.target as GraphNode;
          return (["company", "club"].includes(s.type) || ["company", "club"].includes(t.type))
            ? 120 : 90;
        })
        .strength(0.5)
      )
      .force("charge",    d3.forceManyBody().strength(-320))
      .force("center",    d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius(d => (d.r ?? 10) + 14))
      .on("tick", () => {
        linkSel
          .attr("x1", d => (d.source as GraphNode).x ?? 0)
          .attr("y1", d => (d.source as GraphNode).y ?? 0)
          .attr("x2", d => (d.target as GraphNode).x ?? 0)
          .attr("y2", d => (d.target as GraphNode).y ?? 0);
        nodeSel.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    // Save to refs so filter/search effects can access D3 selections
    nodeSelRef.current = nodeSel;
    linkSelRef.current = linkSel;
    simRef.current     = sim;

    svg.on("click", () => deselectAll());

    const timer = setTimeout(() => sim.alpha(0.05).restart(), 2000);

    const onResize = () => {
      if (!svgRef.current) return;
      sim.force("center", d3.forceCenter(
        svgRef.current.clientWidth  / 2,
        svgRef.current.clientHeight / 2
      ));
      sim.alpha(0.3).restart();
    };
    window.addEventListener("resize", onResize);

    // Cleanup — runs when component unmounts OR when nodes/links change
    // Prevents D3 elements stacking up if data refreshes
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      sim.stop();
      svg.selectAll("*").remove();
    };

  }, [nodes, links, loading, error, selectNode, deselectAll]);

  // ── Effect: type filter ───────────────────────────────────────────────────
  useEffect(() => {
    nodeSelRef.current?.style("display", (d: GraphNode) =>
      hiddenTypes.has(d.type) ? "none" : null
    );
    linkSelRef.current?.style("display", (l: GraphLink) => {
      const s = nodes.find(n => n.id === getNodeId(l.source));
      const t = nodes.find(n => n.id === getNodeId(l.target));
      return s && t && (hiddenTypes.has(s.type) || hiddenTypes.has(t.type)) ? "none" : null;
    });
    setVisibleCount(nodes.filter(n => !hiddenTypes.has(n.type)).length);
  }, [hiddenTypes, nodes]);

  // ── Effect: search dimming ────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      nodeSelRef.current?.classed("dimmed", false);
      return;
    }
    const q       = searchQuery.toLowerCase();
    const matches = new Set(
      nodes.filter(n =>
        n.label.toLowerCase().includes(q) ||
        Object.values(n.details || {}).some(v => String(v).toLowerCase().includes(q))
      ).map(n => n.id)
    );
    nodeSelRef.current?.classed("dimmed", (d: GraphNode) => !matches.has(d.id));
  }, [searchQuery, nodes]);

  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="root">
        <div className="loadingState">
          <span>🕸️</span>
          <p>Loading Campus Graph...</p>
        </div>
      </div>
    );
  }

  // ── Error State ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="root">
        <div className="errorState">
          <span>⚠️</span>
          <p>Failed to load graph: {error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="root">

      {/* Navbar */}
      <nav className="navbar">
        <div className="navLogo">
          <span style={{ fontSize: "1.4rem" }}>🕸️</span>
          <div>
            <div>CampusGraph</div>
            <div className="navTagline">NJIT Network Explorer</div>
          </div>
        </div>
        <div className="navRight">
          {/* counts now come from live API data not hardcoded numbers */}
          {[`${nodes.length} Nodes`, `${links.length} Connections`, "Neo4j-Powered"].map(t => (
            <span key={t} className="navChip">{t}</span>
          ))}
          <button
            type="button"
            className="navChip"
            onClick={handleLogout}
            aria-label="Log out and return to login"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Toolbar */}
      <div className="toolbar">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <FilterBar hiddenTypes={hiddenTypes} onToggleType={toggleType} />
        <div className="toolbarStats">
          <span><b>{nodes.length}</b> nodes</span>
          <span><b>{links.length}</b> edges</span>
          <span><b>{visibleCount}</b> visible</span>
        </div>
      </div>

      {/* Main */}
      <div className="main">
        <svg id="graph-svg" ref={svgRef} style={{ flex: 1 }} />

        {/* SidePanel receives live links from the hook, not static data */}
        <SidePanel
          node={selectedNode}
          nodes={nodes}
          links={links}
          onClose={deselectAll}
          onSelectNode={id => {
            const n = nodes.find(x => x.id === id);
            if (n) selectNode(n);
          }}
        />

        <Legend />
      </div>

    </div>
  );
}