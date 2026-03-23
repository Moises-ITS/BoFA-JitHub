/// <reference types="vite/client" />
// ─────────────────────────────────────────────────────────────────────────────
// CampusGraph.tsx  —  Locked / Free / Path mode graph explorer
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import * as d3 from "d3";

import type { GraphNode, GraphLink, NodeType } from "./types/graphNodes";
import { TYPE_COLOR }                     from "./constants/maps";
import { getNodeId }                      from "./utils/getNodeId";
import { useGraphData }                   from "./hooks/useGraphData";
import SidePanel                          from "./components/SidePanel";
import FilterBar                          from "./components/FilterBar";
import SearchBar                          from "./components/SearchBar";
import Legend                             from "./components/Legend";
import TopConnected                       from "./components/TopConnected";
import HoverCard                          from "./components/HoverCard";
import { useAuth }                        from "../../context/AuthContext";
import { NetworkIntro }                   from "../../components/NetworkTransition";
import "./CampusGraph.css";

const API             = import.meta.env.VITE_API_URL ?? "";
const LOCKED_RADIUS   = 220;
const MAX_NEIGHBORS   = 9;
const HUB_MAX         = 6;

type GraphMode = "free" | "locked" | "path";

// ─────────────────────────────────────────────────────────────────────────────
export default function CampusGraph() {

  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { nodes, links, loading, error } = useGraphData();
  const [introComplete, setIntroComplete] = useState(false);
  const handleIntroComplete = useCallback(() => setIntroComplete(true), []);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [mode,                setMode]                = useState<GraphMode>("free");
  const [selectedNode,        setSelectedNode]        = useState<GraphNode | null>(null);
  const [hiddenTypes,         setHiddenTypes]         = useState<Set<NodeType>>(new Set());
  const [searchQuery,         setSearchQuery]         = useState("");
  const [companyQuery,        setCompanyQuery]        = useState("");
  const [pathNodeIds,         setPathNodeIds]         = useState<string[]>([]);
  const [pathStatus,          setPathStatus]          = useState<"idle"|"searching"|"found"|"notfound">("idle");
  const [hoverCard,           setHoverCard]           = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [d3Ready,             setD3Ready]             = useState(false);

  // ── D3 Refs ───────────────────────────────────────────────────────────────
  const svgRef     = useRef<SVGSVGElement>(null);
  const nodeSelRef = useRef<d3.Selection<SVGGElement,   GraphNode, SVGGElement, unknown> | null>(null);
  const linkSelRef = useRef<d3.Selection<SVGPathElement, GraphLink, SVGGElement, unknown> | null>(null);
  const simRef     = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const dimsRef    = useRef({ w: 900, h: 600 });
  const zoomRef    = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const introDoneRef = useRef(false);

  // ── Clear hover card when leaving free mode ───────────────────────────────
  useEffect(() => { if (mode !== "free") setHoverCard(null); }, [mode]);

  // ── Stable-ref callbacks (avoids D3 setup re-running on mode changes) ─────
  const modeRef          = useRef<GraphMode>("free");
  const selectedIdRef    = useRef<string | null>(null);
  const nodesRef         = useRef(nodes);
  const linksRef         = useRef(links);
  useEffect(() => { modeRef.current       = mode;   }, [mode]);
  useEffect(() => { nodesRef.current      = nodes;  }, [nodes]);
  useEffect(() => { linksRef.current      = links;  }, [links]);

  // ── Opacity helper ────────────────────────────────────────────────────────
  const defOp = (w: number) => w >= 0.8 ? 0.28 : w >= 0.5 ? 0.14 : 0.05;

  // ── Neighbor helper ───────────────────────────────────────────────────────
  const topNeighbors = (d: GraphNode, max: number): GraphNode[] => {
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
  };

  // ── Enter Locked Mode ─────────────────────────────────────────────────────
  const enterLocked = useCallback((d: GraphNode) => {
    const sim     = simRef.current;
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    if (!sim || !nodeSel || !linkSel) return;

    const { w, h }      = dimsRef.current;
    const cx = w / 2, cy = h / 2;
    const neighbors     = topNeighbors(d, MAX_NEIGHBORS);
    const neighborSet   = new Set(neighbors.map(n => n.id));

    // Freeze all nodes at current positions first
    nodesRef.current.forEach(n => { n.fx = n.x ?? cx; n.fy = n.y ?? cy; });

    // Move selected to center, neighbors to radial ring
    d.fx = cx; d.fy = cy;
    neighbors.forEach((nb, i) => {
      const angle = (i / neighbors.length) * 2 * Math.PI - Math.PI / 2;
      nb.fx = cx + LOCKED_RADIUS * Math.cos(angle);
      nb.fy = cy + LOCKED_RADIUS * Math.sin(angle);
    });

    sim.alpha(0.6).restart();

    // Node visibility
    nodeSel.transition().duration(500)
      .style("opacity",        (n: GraphNode) => n.id === d.id || neighborSet.has(n.id) ? 1 : 0)
      .style("pointer-events", (n: GraphNode) => n.id === d.id || neighborSet.has(n.id) ? "all" : "none");

    // Glow on selected + neighbors
    nodeSel.select<SVGCircleElement>("circle.main-circle")
      .attr("filter", (n: GraphNode) =>
        n.id === d.id    ? "url(#glow-selected)" :
        neighborSet.has(n.id) ? "url(#glow-soft)"     : null)
      .transition().duration(500)
      .attr("r", (n: GraphNode) => n.id === d.id ? (n.r ?? 12) * 1.5 : (n.r ?? 12));

    // Labels: show for selected + neighbors only
    nodeSel.select("text").transition().duration(500)
      .style("opacity", (n: GraphNode) => n.id === d.id || neighborSet.has(n.id) ? 1 : 0);

    // Edges: show only direct connections
    linkSel.transition().duration(500).attr("stroke-opacity", (l: GraphLink) => {
      const s = getNodeId(l.source), t = getNodeId(l.target);
      return (s === d.id && neighborSet.has(t)) || (t === d.id && neighborSet.has(s)) ? 0.85 : 0;
    });

  }, []); // eslint-disable-line

  // ── Exit to Free Mode ─────────────────────────────────────────────────────
  const exitToFree = useCallback(() => {
    const sim     = simRef.current;
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    if (!sim || !nodeSel || !linkSel) return;

    // Unpin all nodes
    nodesRef.current.forEach(n => { n.fx = null; n.fy = null; });
    sim.alpha(0.4).restart();

    nodeSel.transition().duration(400)
      .style("opacity", 1)
      .style("pointer-events", "all");

    nodeSel.select<SVGCircleElement>("circle.main-circle")
      .attr("filter", null)
      .transition().duration(400)
      .attr("r", (n: GraphNode) => n.r ?? 12);

    nodeSel.select("text").transition().duration(400).style("opacity", 0.6);

    linkSel.transition().duration(400)
      .attr("stroke-opacity", (l: GraphLink) => defOp(l.weight ?? 0.5))
      .attr("stroke", null)
      .attr("filter", null)
      .attr("stroke-dasharray", null)
      .attr("stroke-dashoffset", null);

    d3.selectAll(".link.path-pulse").classed("path-pulse", false);
    d3.selectAll(".path-overlay").remove();
  }, []); // eslint-disable-line

  // ── Select / Deselect ─────────────────────────────────────────────────────
  const selectNodeFn = useCallback((d: GraphNode) => {
    selectedIdRef.current = d.id;
    setSelectedNode(d);
    setMode("locked");
    setPathNodeIds([]);
    setPathStatus("idle");
    setCompanyQuery("");
    enterLocked(d);
  }, [enterLocked]);

  const deselectAll = useCallback(() => {
    selectedIdRef.current = null;
    setSelectedNode(null);
    setMode("free");
    setPathNodeIds([]);
    setPathStatus("idle");
    exitToFree();
  }, [exitToFree]);

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
    // The intro flyover zoom may be mid-flight targeting the current user's node.
    // Interrupt it and reset the viewport to identity so graph center is visible.
    d3.select(svgRef.current)
      .interrupt()
      .transition().duration(600).ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform, d3.zoomIdentity);

    setSearchParams({}, { replace: true });
  }, [searchParams, nodes, introComplete, d3Ready, selectNodeFn, setSearchParams]);

  // ── Company path search ───────────────────────────────────────────────────
  const findPath = useCallback(async (overrideLabel?: string) => {
    const fromId = selectedIdRef.current ?? user?.id;
    const queryLabel = overrideLabel ?? companyQuery;
    if (!fromId || !queryLabel.trim()) return;

    const target = nodesRef.current.find(
      n => n.type === "company" && n.label.toLowerCase() === queryLabel.toLowerCase()
    );
    if (!target) { setPathStatus("notfound"); return; }

    setPathStatus("searching");
    try {
      const res  = await fetch(`${API}/api/graph/path?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(target.id)}`);
      const data = await res.json() as { nodeIds: string[]; rels: string[] };
      if (!data.nodeIds?.length) { setPathStatus("notfound"); return; }
      setPathNodeIds(data.nodeIds);
      setPathStatus("found");
      setMode("path");
    } catch {
      setPathStatus("notfound");
    }
  }, [companyQuery, user]);

  const toggleType = useCallback((type: NodeType) =>
    setHiddenTypes(prev => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n; }), []);

  // ── D3 Setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || error || !svgRef.current || nodes.length === 0) return;

    const svg    = d3.select(svgRef.current);
    const width  = svgRef.current.clientWidth;
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
    addGlow("glow-soft",      3, "-60%");
    addGlow("glow-path",      4, "-60%");

    // ── Hub suppression ────────────────────────────────────────────────────
    const edgeTier  = (w: number) => w >= 0.8 ? 1 : w >= 0.5 ? 2 : 3;
    const edgeWidth = (w: number) => w >= 0.8 ? 3.5 : w >= 0.5 ? 2.2 : 1.2;

    const nodeEdges: Record<string, { link: GraphLink; w: number }[]> = {};
    for (const l of links) {
      const s = l.source as string, t = l.target as string, w = l.weight ?? 0.5;
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
    nodes.forEach((n: GraphNode) => (degree[n.id] = 0));
    visibleLinks.forEach(l => {
      const s = l.source as string, t = l.target as string;
      degree[s] = (degree[s] || 0) + 1;
      degree[t] = (degree[t] || 0) + 1;
    });
    const maxDeg = Math.max(...Object.values(degree), 1);
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
    const g = svg.append("g").attr("class", "graph-root");

    // ── Zoom ──────────────────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 4])
      // Soft boundary: prevent drifting into empty space more than 2× canvas
      .translateExtent([[-width * 2, -height * 2], [width * 3, height * 3]])
      .on("zoom", (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", e.transform.toString());
        // Show more labels when zoomed in
        if (modeRef.current === "free") {
          nodeSelRef.current?.select("text")
            .style("opacity", e.transform.k > 1.6 ? 1 : 0.6);
        }
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    // ── Links ─────────────────────────────────────────────────────────────
    const linkSel = g.append("g")
      .selectAll<SVGPathElement, GraphLink>("path")
      .data(simLinks).enter().append("path")
      .attr("class", (d: GraphLink) =>
        `link link-t${edgeTier(d.weight ?? 0.5)}${d.style === "dashed" ? " link-dashed" : ""}${d.style === "direct" ? " link-direct" : ""}`)
      .attr("stroke-width",   (d: GraphLink) => edgeWidth(d.weight ?? 0.5))
      .attr("stroke-opacity", (d: GraphLink) => defOp(d.weight ?? 0.5))
      .attr("fill", "none");

    // ── Nodes ─────────────────────────────────────────────────────────────
    const nodeSel = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes).enter().append("g")
      .attr("class", (d: GraphNode) =>
        d.id === user?.id ? "node node-current-user" : "node"
      )
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (e: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag",  (e: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            d.fx = e.x; d.fy = e.y;
          })
          .on("end",   (e: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            if (!e.active) sim.alphaTarget(0);
            if (modeRef.current === "free") { d.fx = null; d.fy = null; }
          })
      )
      .on("click",      (e: MouseEvent, d: GraphNode) => { e.stopPropagation(); selectNodeFn(d); })
      .on("mouseenter", (e: MouseEvent, d: GraphNode) => {
        if (modeRef.current !== "free") return;
        setHoverCard({ node: d, x: e.clientX, y: e.clientY });
        const conn = new Set([d.id]);
        simLinks.forEach(l => {
          const s = getNodeId(l.source), t = getNodeId(l.target);
          if (s === d.id) conn.add(t);
          if (t === d.id) conn.add(s);
        });
        linkSel.attr("stroke-opacity", (l: GraphLink) => {
          const s = getNodeId(l.source), t = getNodeId(l.target);
          return (s === d.id || t === d.id) ? 0.75 : 0.02;
        });
        nodeSel.transition().duration(150)
          .style("opacity", (n: GraphNode) => conn.has(n.id) ? 1 : 0.12);
        nodeSel.select("text").style("opacity", (n: GraphNode) => conn.has(n.id) ? 1 : 0);
        nodeSel.filter((n: GraphNode) => n.id === d.id)
          .select<SVGCircleElement>("circle.main-circle")
          .attr("filter", "url(#glow-soft)");
      })
      .on("mouseleave", () => {
        if (modeRef.current !== "free") return;
        setHoverCard(null);
        linkSel.attr("stroke-opacity", (l: GraphLink) => defOp(l.weight ?? 0.5));
        nodeSel.transition().duration(200).style("opacity", 1);
        nodeSel.select("text").style("opacity", 0.6);
        nodeSel.select<SVGCircleElement>("circle.main-circle").attr("filter", null);
      });

    // Company indicator ring (dashed outer ring)
    nodeSel.filter((d: GraphNode) => d.type === "company").append("circle")
      .attr("class", "company-ring")
      .attr("r",              (d: GraphNode) => (d.r ?? 12) + 6)
      .attr("fill",           "none")
      .attr("stroke",         TYPE_COLOR.company)
      .attr("stroke-width",   1.5)
      .attr("stroke-opacity", 0.35)
      .attr("stroke-dasharray","4,3");

    // Main circle
    nodeSel.append("circle")
      .attr("class",          "main-circle")
      .attr("r",              (d: GraphNode) => d.r ?? 12)
      .attr("fill",           (d: GraphNode) =>
        d.id === user?.id ? "#facc15" : TYPE_COLOR[d.type]
      )
      .attr("fill-opacity",   (d: GraphNode) => d.id === user?.id ? 1 : 0.9)
      .attr("stroke",         (d: GraphNode) =>
        d.id === user?.id ? "#fef3c7" : TYPE_COLOR[d.type]
      )
      .attr("stroke-width",   (d: GraphNode) => d.id === user?.id ? 3 : 2)
      .attr("stroke-opacity", 0.9)
      .attr("filter",         (d: GraphNode) =>
        d.id === user?.id ? "url(#glow-selected)" : null
      );

    // Label (hidden at default zoom in free mode)
    nodeSel.append("text")
      .attr("dy",             (d: GraphNode) => (d.r ?? 12) + 14)
      .text((d: GraphNode) => d.label.length > 20 ? d.label.slice(0, 18) + "…" : d.label)
      .attr("font-size",      (d: GraphNode) => d.type === "company" ? "11px" : "10px")
      .attr("font-weight",    (d: GraphNode) =>
        d.id === user?.id
          ? "800"
          : ["company","professor"].includes(d.type) ? "600" : "400"
      )
      .attr("fill",           (d: GraphNode) =>
        d.id === user?.id ? "#fef9c3" : "#cbd5e1"
      )
      .attr("text-anchor",    "middle")
      .attr("pointer-events", "none")
      .style("opacity",       0.8);

    // ── Force Simulation ──────────────────────────────────────────────────
    const clusterX: Partial<Record<string, number>> = { club:-0.28, company:0.28, professor:-0.14, interest:0.14, student:0 };
    const clusterY: Partial<Record<string, number>> = { club:0.1,  company:0.1,  professor:-0.25, interest:-0.2,  student:0 };

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id((d: GraphNode) => d.id)
        .distance((d: d3.SimulationLinkDatum<GraphNode>) => {
          const s = d.source as GraphNode, t = d.target as GraphNode;
          return ["company","club"].includes(s.type) || ["company","club"].includes(t.type) ? 145 : 100;
        })
        .strength(0.4)
      )
      .force("charge",    d3.forceManyBody<GraphNode>().strength((d: GraphNode) =>
        d.type === "club" ? -750 : d.type === "company" ? -620 : -490))
      .force("center",    d3.forceCenter(width / 2, height / 2).strength(0.04))
      .force("collision", d3.forceCollide<GraphNode>().radius((d: GraphNode) => (d.r ?? 12) + 18).strength(0.8))
      .force("x", d3.forceX<GraphNode>((d: GraphNode) => width  / 2 + (clusterX[d.type] ?? 0) * width ).strength(0.06))
      .force("y", d3.forceY<GraphNode>((d: GraphNode) => height / 2 + (clusterY[d.type] ?? 0) * height).strength(0.06));

    let tick = 0;
    sim.on("tick", () => {
      linkSel.attr("d", (d: GraphLink) => {
        const s = d.source as GraphNode, t = d.target as GraphNode;
        const x1 = s?.x ?? 0, y1 = s?.y ?? 0, x2 = t?.x ?? 0, y2 = t?.y ?? 0;
        return `M${x1},${y1} Q${(x1+x2)/2},${(y1+y2)/2-30} ${x2},${y2}`;
      });
      nodeSel.attr("transform", (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);

      // One-time intro flyover: show whole graph, then zoom to current user node
      if (!introDoneRef.current && user?.id && zoomRef.current && svgRef.current && ++tick > 45) {
        introDoneRef.current = true;
        const allNodes = nodesRef.current.filter(n => n.x != null && n.y != null);
        if (!allNodes.length) return;

        const { w, h } = dimsRef.current;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        allNodes.forEach(n => {
          const x = n.x as number, y = n.y as number;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        });

        const dx = maxX - minX || 1;
        const dy = maxY - minY || 1;
        const scaleFit = 0.85 / Math.max(dx / w, dy / h);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const fitTransform = d3.zoomIdentity
          .translate(w / 2 - scaleFit * midX, h / 2 - scaleFit * midY)
          .scale(scaleFit);

        const userNode = nodesRef.current.find(n => n.id === user.id && n.x != null && n.y != null);
        const scaleUser = 1.6;
        const userTransform = userNode
          ? d3.zoomIdentity
              .translate(w / 2 - scaleUser * (userNode.x as number), h / 2 - scaleUser * (userNode.y as number))
              .scale(scaleUser)
          : fitTransform;

        const zoomBehavior = zoomRef.current;
        const svgSel = d3.select(svgRef.current);

        svgSel
          .transition()
          .duration(1500)
          .ease(d3.easeCubicInOut)
          .call(zoomBehavior!.transform, fitTransform)
          .transition()
          .duration(1500)
          .ease(d3.easeCubicInOut)
          .call(zoomBehavior!.transform, userTransform);
      }
    });

    nodeSelRef.current = nodeSel;
    linkSelRef.current = linkSel as d3.Selection<SVGPathElement, GraphLink, SVGGElement, unknown>;
    simRef.current     = sim;
    setD3Ready(true);

    svg.on("click", () => { if (modeRef.current !== "free") deselectAll(); });

    const timer = setTimeout(() => sim.alpha(0.05).restart(), 3200);
    const onResize = () => {
      if (!svgRef.current) return;
      const w = svgRef.current.clientWidth, h = svgRef.current.clientHeight;
      dimsRef.current = { w, h };
      sim.force("center", d3.forceCenter(w/2, h/2).strength(0.04)).alpha(0.3).restart();
    };
    window.addEventListener("resize", onResize);

    return () => {
      setD3Ready(false);
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      sim.stop();
      svg.selectAll("*").remove();
    };
  }, [nodes, links, loading, error, user]); // eslint-disable-line

  // ── Path Mode Effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "path" || pathNodeIds.length < 2) return;
    const nodeSel = nodeSelRef.current;
    const linkSel = linkSelRef.current;
    if (!nodeSel || !linkSel || !svgRef.current) return;

    const pathSet = new Set(pathNodeIds);

    // Dim everything not on the path
    nodeSel.transition().duration(500)
      .style("opacity",        (n: GraphNode) => pathSet.has(n.id) ? 1 : 0.06)
      .style("pointer-events", (n: GraphNode) => pathSet.has(n.id) ? "all" : "none");
    nodeSel.select<SVGCircleElement>("circle.main-circle")
      .attr("filter", (n: GraphNode) => pathSet.has(n.id) ? "url(#glow-soft)" : null);
    nodeSel.select("text").transition().duration(500)
      .style("opacity", (n: GraphNode) => pathSet.has(n.id) ? 1 : 0);
    // Dim all existing edges — path edges are drawn as overlay to bypass hub-suppression
    linkSel.transition().duration(500).attr("stroke-opacity", 0.02);

    // Draw path edges as fresh overlay elements (bypasses hub-suppression filtering)
    const graphRoot = d3.select(svgRef.current).select<SVGGElement>(".graph-root");
    const overlay   = graphRoot.append("g").attr("class", "path-overlay");

    let step = 0;
    const interval = setInterval(() => {
      if (step >= pathNodeIds.length - 1) { clearInterval(interval); return; }
      const aId   = pathNodeIds[step];
      const bId   = pathNodeIds[step + 1];
      const aNode = nodesRef.current.find(n => n.id === aId);
      const bNode = nodesRef.current.find(n => n.id === bId);
      if (aNode && bNode) {
        const x1 = aNode.x ?? 0, y1 = aNode.y ?? 0;
        const x2 = bNode.x ?? 0, y2 = bNode.y ?? 0;
        const pathD = `M${x1},${y1} Q${(x1+x2)/2},${(y1+y2)/2-30} ${x2},${y2}`;
        const el = overlay.append("path")
          .attr("d",            pathD)
          .attr("fill",         "none")
          .attr("stroke",       "#e879f9")
          .attr("stroke-width", 2.5)
          .attr("filter",       "url(#glow-path)")
          .attr("stroke-opacity", 0);
        const len = (el.node() as SVGPathElement)?.getTotalLength() || 200;
        el.attr("stroke-dasharray",  len)
          .attr("stroke-dashoffset", len)
          .transition().duration(520).ease(d3.easeLinear)
          .attr("stroke-dashoffset", 0)
          .attr("stroke-opacity",    0.95);
      }
      step++;
    }, 560);

    return () => {
      clearInterval(interval);
      overlay.remove();
    };
  }, [mode, pathNodeIds]);

  // ── Filter Effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    nodeSelRef.current?.style("display", (d: GraphNode) => hiddenTypes.has(d.type) ? "none" : null);
    linkSelRef.current?.style("display", (l: GraphLink) => {
      const s = nodes.find(n => n.id === getNodeId(l.source));
      const t = nodes.find(n => n.id === getNodeId(l.target));
      return s && t && (hiddenTypes.has(s.type) || hiddenTypes.has(t.type)) ? "none" : null;
    });
  }, [hiddenTypes, nodes]);

  // ── Search Effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "free") return;
    if (!searchQuery.trim()) {
      nodeSelRef.current?.transition().duration(200).style("opacity", 1);
      nodeSelRef.current?.select("text").style("opacity", 0.6);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = new Set(nodes.filter(n =>
      n.label.toLowerCase().includes(q) ||
      Object.values(n.details || {}).some(v => String(v).toLowerCase().includes(q))
    ).map(n => n.id));
    nodeSelRef.current?.transition().duration(200)
      .style("opacity", (d: GraphNode) => matches.has(d.id) ? 1 : 0.07);
    nodeSelRef.current?.select("text")
      .style("opacity", (d: GraphNode) => matches.has(d.id) ? 1 : 0);
  }, [searchQuery, nodes, mode]);

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
  const userConnCount = useMemo(() =>
    links.filter(l =>
      getNodeId(l.source) === user?.id || getNodeId(l.target) === user?.id
    ).length,
  [links, user?.id]);

  const visibleTypeCounts = useMemo(() => ({
    students: nodes.filter(n => n.type === "student" && !hiddenTypes.has(n.type)).length,
    organizations: nodes.filter(n => n.type === "club" && !hiddenTypes.has(n.type)).length,
    companies: nodes.filter(n => n.type === "company" && !hiddenTypes.has(n.type)).length,
  }), [hiddenTypes, nodes]);

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

  return (
    <div className="root">

      {/* Intro animation overlay — renders on top while graph loads underneath */}
      {!introComplete && <NetworkIntro onComplete={handleIntroComplete} />}

      <div className="graphHeader">
        <div className="graphHeaderCopy">
          <span className="graphEyebrow">Campus Connections</span>
          <h1 className="graphTitle">Campus Network</h1>
          <p className="graphSubtitle">{modeDescription}</p>
        </div>

        <div className="graphHeaderMeta">
          <span className={`graphModeBadge graphModeBadge--${mode}`}>{modeLabel}</span>
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
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <FilterBar hiddenTypes={hiddenTypes} onToggleType={toggleType} />

        <div className="toolbarStats">
          <span><b>{visibleTypeCounts.students}</b> students</span>
          <span><b>{visibleTypeCounts.organizations}</b> orgs</span>
          <span><b>{visibleTypeCounts.companies}</b> companies</span>
        </div>
      </div>

      {/* Main */}
      <div className="main">
        <div className="bgGlow" />
        <svg id="graph-svg" ref={svgRef} style={{ flex: 1 }} />
        <SidePanel
          node={selectedNode}
          nodes={nodes}
          links={links}
          onClose={deselectAll}
          onSelectNode={id => { const n = nodes.find(x => x.id === id); if (n) selectNodeFn(n); }}
        />
        <Legend />
        <TopConnected
          nodes={nodes}
          links={links}
          currentUserId={user?.id ?? ""}
          onSelectNode={id => { const n = nodes.find(x => x.id === id); if (n) selectNodeFn(n); }}
        />
      </div>

      {/* Locked Mode overlay hint */}
      {mode === "locked" && (
        <div className="modeHint">
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
      {hoverCard && mode === "free" && (
        <HoverCard node={hoverCard.node} x={hoverCard.x} y={hoverCard.y} />
      )}
    </div>
  );
}
