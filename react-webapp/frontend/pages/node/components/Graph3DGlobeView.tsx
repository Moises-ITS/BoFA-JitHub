import { useEffect, useMemo, useRef, useState } from "react";

import type { GraphLink, GraphNode, NodeType } from "../types/graphNodes";
import { TYPE_COLOR } from "../constants/maps";
import { getNodeId } from "../utils/getNodeId";

interface Graph3DGlobeViewProps {
  active: boolean;
  nodes: GraphNode[];
  links: GraphLink[];
  hiddenTypes: Set<NodeType>;
  searchQuery: string;
  selectedNodeId: string | null;
  pathNodeIds: string[];
  focusNodeIds: string[];
  focusTriggerKey: string;
  lastPulseTs: number;
  onSelectNode: (id: string) => void;
  onBackgroundClick: () => void;
}

const SPATIAL = {
  floorY: -82,
  groundRadius: 1240,
  rings: [120, 250, 390, 540],
  layerRadius: [80, 220, 360, 510],
  layerHeight: [12, 38, 66, 98],
  cameraStart: { x: 0, y: 500, z: 970 },
  cameraTarget: { x: 0, y: 42, z: 0 },
  cameraFocusDistance: 330,
  cameraFocusLift: 160,
  cameraPolarLocked: 1.02,
  cameraAzimuthMin: -0.56,
  cameraAzimuthMax: 0.56,
  cameraZoomMin: 520,
  cameraZoomMax: 1280,
  autoRotateSpeed: 0.05,
  clockwiseOrbitSpeed: 0.0011,
  nodeScale: 0.28,
  fogNear: 620,
  fogFar: 2200,
};

const TYPE_AZIMUTH: Record<NodeType, number> = {
  student: -0.12,
  club: 1.36,
  company: 2.52,
  professor: 3.8,
  interest: 5.04,
};

const TYPE_HEIGHT: Record<NodeType, number> = {
  student: 0,
  club: 10,
  company: 18,
  professor: 14,
  interest: 7,
};

const edgePairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type GlobeNode = {
  id: string;
  label: string;
  type: NodeType;
  r: number;
  x: number;
  y: number;
  z: number;
  isSearchMatch: boolean;
  isSelected: boolean;
  isPath: boolean;
  layer: number;
  pathStep: number;
};

type GlobeLink = {
  source: string;
  target: string;
  rel: string;
  weight: number;
  opacity: number;
  isPath: boolean;
  isSearchMatch: boolean;
  pathStep: number;
};

type SpatialScaffold = {
  dispose: () => void;
};

const clampLayer = (n: number) => Math.max(0, Math.min(SPATIAL.layerRadius.length - 1, n));
const hash01 = (id: string) => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
};

const edgeStepKey = (a: string, b: string, step: number) => `${a}|${b}|${step}`;

const buildSpatialScaffold = (fg: any, THREE: any): SpatialScaffold => {
  const scene = fg.scene?.();
  if (!scene) return { dispose: () => undefined };

  const createdMaterials: any[] = [];
  const createdGeometry: any[] = [];
  const group = new THREE.Group();
  group.name = "spatial-scaffold";

  const makeMaterial = (material: any) => {
    createdMaterials.push(material);
    return material;
  };

  const makeGeometry = (geometry: any) => {
    createdGeometry.push(geometry);
    return geometry;
  };

  const floor = new THREE.Mesh(
    makeGeometry(new THREE.CircleGeometry(SPATIAL.groundRadius, 64)),
    makeMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x050912,
        transparent: true,
        opacity: 0.82,
        roughness: 0.95,
        metalness: 0.06,
      })
    )
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = SPATIAL.floorY;
  group.add(floor);

  const grid = new THREE.GridHelper(SPATIAL.groundRadius * 1.45, 34, 0x365178, 0x152338);
  const gridMaterial = grid.material as any;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.26;
  grid.position.y = SPATIAL.floorY + 0.6;
  group.add(grid);

  SPATIAL.rings.forEach((ringRadius, index) => {
    const ring = new THREE.Mesh(
      makeGeometry(new THREE.RingGeometry(Math.max(10, ringRadius - 1.4), ringRadius + 1.4, 96)),
      makeMaterial(
        new THREE.MeshBasicMaterial({
          color: index === SPATIAL.rings.length - 1 ? 0x254c78 : 0x1b3556,
          transparent: true,
          opacity: index === SPATIAL.rings.length - 1 ? 0.2 : 0.15,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = SPATIAL.floorY + 1.1 + index * 0.2;
    group.add(ring);
  });

  const northLineGeometry = makeGeometry(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, SPATIAL.floorY + 1.3, 0),
    new THREE.Vector3(0, SPATIAL.floorY + 1.3, -SPATIAL.groundRadius * 0.82),
  ]));
  const northLine = new THREE.Line(
    northLineGeometry,
    makeMaterial(new THREE.LineBasicMaterial({ color: 0x66a6f2, transparent: true, opacity: 0.34 }))
  );
  group.add(northLine);

  const northTip = new THREE.Mesh(
    makeGeometry(new THREE.ConeGeometry(9, 24, 18)),
    makeMaterial(new THREE.MeshBasicMaterial({ color: 0x9ac7ff, transparent: true, opacity: 0.84 }))
  );
  northTip.position.set(0, SPATIAL.floorY + 13, -SPATIAL.groundRadius * 0.82);
  northTip.rotation.x = -Math.PI / 2;
  group.add(northTip);

  const hemi = new THREE.HemisphereLight(0xa1ccff, 0x0a101b, 0.56);
  const key = new THREE.DirectionalLight(0x8ab7ff, 0.72);
  key.position.set(360, 580, 260);
  const rim = new THREE.DirectionalLight(0x7c5cff, 0.24);
  rim.position.set(-320, 220, -440);

  group.add(hemi);
  group.add(key);
  group.add(rim);

  const STAR_COUNT = 520;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const radius = 1050 + Math.random() * 920;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * Math.random());
    starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    starPositions[i * 3 + 1] = Math.max(SPATIAL.floorY + 30, Math.cos(phi) * radius * 0.7 + 240);
    starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const starGeometry = makeGeometry(new THREE.BufferGeometry());
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = makeMaterial(
    new THREE.PointsMaterial({
      color: 0xaecfff,
      size: 1.95,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    })
  );
  const stars = new THREE.Points(starGeometry, starMaterial);
  group.add(stars);

  const miniNetworkMaterial = makeMaterial(new THREE.MeshBasicMaterial({ color: 0x9dbce2, transparent: true, opacity: 0.31, depthWrite: false }));
  const miniLineMaterial = makeMaterial(new THREE.LineBasicMaterial({ color: 0x85abd8, transparent: true, opacity: 0.24, depthWrite: false }));
  for (let networkIdx = 0; networkIdx < 5; networkIdx++) {
    const cluster = new THREE.Group();
    const angle = (networkIdx / 5) * Math.PI * 2 + 0.3;
    const radial = 820 + networkIdx * 90;
    cluster.position.set(Math.cos(angle) * radial, 130 + (networkIdx % 3) * 48, Math.sin(angle) * radial);
    const points: any[] = [];
    const nodeCount = 10 + (networkIdx % 3) * 2;
    for (let i = 0; i < nodeCount; i++) {
      const px = (Math.random() - 0.5) * 120;
      const py = (Math.random() - 0.5) * 62;
      const pz = (Math.random() - 0.5) * 120;
      points.push(new THREE.Vector3(px, py, pz));
      const node = new THREE.Mesh(makeGeometry(new THREE.SphereGeometry(1.6 + Math.random() * 1.8, 10, 10)), miniNetworkMaterial);
      node.position.set(px, py, pz);
      cluster.add(node);
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dist = points[i].distanceTo(points[j]);
        const shouldLink = dist < 70 || (Math.random() < 0.08 && dist < 105);
        if (!shouldLink) continue;
        const geom = makeGeometry(new THREE.BufferGeometry().setFromPoints([points[i], points[j]]));
        const line = new THREE.Line(geom, miniLineMaterial);
        cluster.add(line);
      }
    }
    group.add(cluster);
  }

  const previousFog = scene.fog;
  scene.fog = new THREE.Fog(0x04070d, SPATIAL.fogNear, SPATIAL.fogFar);
  scene.add(group);

  return {
    dispose: () => {
      scene.remove(group);
      scene.fog = previousFog;
      createdGeometry.forEach((g) => g.dispose?.());
      createdMaterials.forEach((m) => m.dispose?.());
    },
  };
};

export default function Graph3DGlobeView({
  active,
  nodes,
  links,
  hiddenTypes,
  searchQuery,
  selectedNodeId,
  pathNodeIds,
  focusNodeIds,
  focusTriggerKey,
  lastPulseTs,
  onSelectNode,
  onBackgroundClick,
}: Graph3DGlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const stopAutoRotateRef = useRef<(() => void) | null>(null);
  const scaffoldRef = useRef<SpatialScaffold | null>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const graphVersionRef = useRef<string>("");
  const focusedNodeRef = useRef<string | null>(null);
  const lastFocusKeyRef = useRef<string>("");
  const [fgReadyToken, setFgReadyToken] = useState(0);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);
  useEffect(() => {
    onBackgroundClickRef.current = onBackgroundClick;
  }, [onBackgroundClick]);

  const pathNodeSet = useMemo(() => new Set(pathNodeIds), [pathNodeIds]);
  const pathEdgeSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < pathNodeIds.length - 1; i++) {
      set.add(edgePairKey(pathNodeIds[i], pathNodeIds[i + 1]));
    }
    return set;
  }, [pathNodeIds]);

  const graphData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const visibleNodes = nodes.filter((n) => !hiddenTypes.has(n.type));
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const nodeById = new Map(visibleNodes.map((n) => [n.id, n]));

    const adjacency = new Map<string, Set<string>>();
    const degree = new Map<string, number>();
    visibleNodes.forEach((n) => {
      adjacency.set(n.id, new Set());
      degree.set(n.id, 0);
    });

    links.forEach((l) => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      if (!visibleIds.has(s) || !visibleIds.has(t)) return;
      adjacency.get(s)?.add(t);
      adjacency.get(t)?.add(s);
      degree.set(s, (degree.get(s) ?? 0) + 1);
      degree.set(t, (degree.get(t) ?? 0) + 1);
    });

    const anchorId =
      (selectedNodeId && nodeById.has(selectedNodeId) ? selectedNodeId : null) ??
      (pathNodeIds.find((id) => nodeById.has(id)) ?? null) ??
      [...visibleNodes]
        .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0]
        ?.id ??
      null;

    const hopDepth = new Map<string, number>();
    if (anchorId) {
      hopDepth.set(anchorId, 0);
      const queue: string[] = [anchorId];
      while (queue.length) {
        const current = queue.shift();
        if (!current) continue;
        const currentDepth = hopDepth.get(current) ?? 0;
        if (currentDepth >= 3) continue;
        adjacency.get(current)?.forEach((next) => {
          if (hopDepth.has(next)) return;
          hopDepth.set(next, currentDepth + 1);
          queue.push(next);
        });
      }
    }

    const pathOrder = new Map<string, number>();
    pathNodeIds.forEach((id, index) => pathOrder.set(id, index));

    const nodeMap = new Map<string, GlobeNode>();
    const layerBuckets = new Map<number, GraphNode[]>();
    visibleNodes.forEach((n) => {
      const isCompany = n.type === "company";
      const baseLayer = clampLayer(hopDepth.get(n.id) ?? 3);
      const layer = isCompany ? Math.max(2, baseLayer) : baseLayer;
      if (!layerBuckets.has(layer)) layerBuckets.set(layer, []);
      layerBuckets.get(layer)?.push(n);
    });

    layerBuckets.forEach((bucket, layer) => {
      const sorted = [...bucket].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
      const layerCount = Math.max(1, sorted.length);
      sorted.forEach((n, i) => {
        const noise = hash01(n.id);
        const radiusNoise = (noise - 0.5) * 34;
        const angleNoise = (noise - 0.5) * 0.28;
        const globalAngle = (i / layerCount) * Math.PI * 2;
        const theta = globalAngle * 0.7 + TYPE_AZIMUTH[n.type] * 0.3 + angleNoise;
        const radius = SPATIAL.layerRadius[layer] + radiusNoise;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        const y = SPATIAL.layerHeight[layer] + TYPE_HEIGHT[n.type] + (noise - 0.5) * 8 + (pathNodeSet.has(n.id) ? 8 : 0);
        const isSearchMatch = !q || n.label.toLowerCase().includes(q) || Object.values(n.details || {}).some((v) => String(v).toLowerCase().includes(q));

        nodeMap.set(n.id, {
          id: n.id,
          label: n.label,
          type: n.type,
          r: n.r ?? 10,
          x,
          y,
          z,
          isSearchMatch,
          isSelected: n.id === selectedNodeId,
          isPath: pathNodeSet.has(n.id),
          layer,
          pathStep: pathOrder.get(n.id) ?? -1,
        });
      });
    });

    const pathEdgeOrder = new Map<string, number>();
    for (let i = 0; i < pathNodeIds.length - 1; i++) {
      pathEdgeOrder.set(edgeStepKey(pathNodeIds[i], pathNodeIds[i + 1], i), i);
      pathEdgeOrder.set(edgeStepKey(pathNodeIds[i + 1], pathNodeIds[i], i), i);
    }

    const globeLinks: GlobeLink[] = links
      .filter((l) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        return visibleIds.has(s) && visibleIds.has(t);
      })
      .map((l) => {
        const s = getNodeId(l.source);
        const t = getNodeId(l.target);
        const step = pathEdgeOrder.get(edgeStepKey(s, t, pathOrder.get(s) ?? -1)) ?? -1;
        return {
          source: s,
          target: t,
          rel: l.rel,
          weight: l.weight ?? 0.5,
          opacity: l.opacity ?? 0.5,
          isPath: pathEdgeSet.has(edgePairKey(s, t)),
          isSearchMatch: (nodeMap.get(s)?.isSearchMatch ?? false) && (nodeMap.get(t)?.isSearchMatch ?? false),
          pathStep: step,
        };
      });

    const pathSteps = pathNodeIds
      .map((id, index) => {
        const node = nodeMap.get(id);
        if (!node) return null;
        return {
          id,
          index,
          label: node.label,
        };
      })
      .filter((step): step is { id: string; index: number; label: string } => step !== null);

    const minimap = [...nodeMap.values()].map((n) => ({ id: n.id, x: n.x, z: n.z, isPath: n.isPath, isSelected: n.isSelected }));

    return {
      nodes: [...nodeMap.values()],
      links: globeLinks,
      pathSteps,
      minimap,
    };
  }, [hiddenTypes, links, nodes, pathEdgeSet, pathNodeIds, pathNodeSet, searchQuery, selectedNodeId]);

  const graphVersion = useMemo(() => {
    const hidden = [...hiddenTypes].sort().join(",");
    return `${nodes.length}|${links.length}|${hidden}|${pathNodeIds.join(">")}`;
  }, [hiddenTypes, links.length, nodes.length, pathNodeIds]);

  const minimapView = useMemo(() => {
    const bounds = Math.max(550, ...graphData.minimap.map((n) => Math.sqrt(n.x * n.x + n.z * n.z)));
    return graphData.minimap.map((n) => {
      const px = 50 + (n.x / bounds) * 42;
      const py = 50 + (n.z / bounds) * 42;
      return {
        ...n,
        px,
        py,
      };
    });
  }, [graphData.minimap]);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    let cancelled = false;
    let domEl: HTMLElement | null = null;
    let onInteraction: (() => void) | null = null;
    let controlsRef: any = null;
    let controlsClampHandler: (() => void) | null = null;

    const init = async () => {
      const [{ default: ForceGraph3D }, THREE] = await Promise.all([import("3d-force-graph"), import("three")]);
      if (cancelled || !containerRef.current) return;

      const fg = ForceGraph3D()(containerRef.current);
      fgRef.current = fg;

      const syncSize = () => {
        const host = containerRef.current;
        if (!host || !fgRef.current) return;
        fgRef.current.width(host.clientWidth);
        fgRef.current.height(host.clientHeight);
      };

      fg.backgroundColor("#04070d");
      fg.showNavInfo(false);
      fg.nodeRelSize(4);
      fg.nodeResolution(12);
      fg.enableNodeDrag(false);
      fg.warmupTicks(35);
      fg.cooldownTicks(70);
      fg.numDimensions(3);
      fg.onNodeClick((node: GlobeNode) => {
        focusedNodeRef.current = node.id;
        fg.cameraPosition(
          { x: node.x, y: SPATIAL.cameraStart.y, z: node.z + SPATIAL.cameraFocusDistance },
          { x: node.x, y: node.y, z: node.z },
          920
        );
        onSelectNodeRef.current(node.id);
      });
      fg.onNodeHover((node: GlobeNode | null) => {
        if (!containerRef.current) return;
        containerRef.current.style.cursor = node ? "pointer" : "grab";
      });
      fg.onBackgroundClick(() => onBackgroundClickRef.current());

      const controls = fg.controls?.();
      if (controls) {
        controlsRef = controls;
        controls.enableDamping = true;
        controls.dampingFactor = 0.075;
        controls.rotateSpeed = 0.4;
        controls.zoomSpeed = 0.78;
        controls.autoRotate = false;
        controls.autoRotateSpeed = SPATIAL.autoRotateSpeed;
        controls.minDistance = SPATIAL.cameraZoomMin;
        controls.maxDistance = SPATIAL.cameraZoomMax;
        controls.enablePan = false;
        controls.minPolarAngle = SPATIAL.cameraPolarLocked;
        controls.maxPolarAngle = SPATIAL.cameraPolarLocked;
        controls.minAzimuthAngle = SPATIAL.cameraAzimuthMin;
        controls.maxAzimuthAngle = SPATIAL.cameraAzimuthMax;
        controls.target?.set(SPATIAL.cameraTarget.x, SPATIAL.cameraTarget.y, SPATIAL.cameraTarget.z);
        controlsClampHandler = () => {
          if (!controls.target) return;
          controls.target.y = SPATIAL.cameraTarget.y;
          const camera = fg.camera?.();
          if (camera) {
            camera.position.y = SPATIAL.cameraStart.y;
          }
        };
        controls.addEventListener?.("change", controlsClampHandler);
        controlsClampHandler();
        controls.update();
      }

      onInteraction = () => {
        if (!controls) return;
        controls.autoRotate = false;
      };
      stopAutoRotateRef.current = onInteraction;

      domEl = fg.renderer?.()?.domElement as HTMLElement | null;
      if (domEl && onInteraction) {
        domEl.addEventListener("pointerdown", onInteraction, { passive: true });
        domEl.addEventListener("wheel", onInteraction, { passive: true });
      }

      window.addEventListener("resize", syncSize);
      syncSize();
      fg.graphData(graphData);
      graphVersionRef.current = graphVersion;
      fg.cameraPosition(SPATIAL.cameraStart, SPATIAL.cameraTarget, 1200);
      const renderer = fg.renderer?.();
      if (renderer) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.02;
      }
      scaffoldRef.current = buildSpatialScaffold(fg, THREE);
      setFgReadyToken((t) => t + 1);

      fg.d3Force("grounded-layout", (alpha: number) => {
        const currentNodes = (fg.graphData()?.nodes ?? []) as GlobeNode[];
        const orbitCos = Math.cos(SPATIAL.clockwiseOrbitSpeed);
        const orbitSin = Math.sin(SPATIAL.clockwiseOrbitSpeed);
        currentNodes.forEach((n) => {
          const rx = n.x * orbitCos + n.z * orbitSin;
          const rz = -n.x * orbitSin + n.z * orbitCos;
          n.x = rx;
          n.z = rz;
          const radial = Math.sqrt(n.x * n.x + n.z * n.z) || 1;
          const targetRadius = SPATIAL.layerRadius[n.layer];
          const radialPull = (targetRadius - radial) * alpha * 0.06;
          n.x += (n.x / radial) * radialPull;
          n.z += (n.z / radial) * radialPull;

          const targetY = SPATIAL.layerHeight[n.layer] + TYPE_HEIGHT[n.type] + (n.isPath ? 8 : 0);
          n.y += (targetY - n.y) * alpha * 0.16;
        });
      });

      fg.d3Force("charge")?.strength(-58);
      fg.d3Force("link")?.distance((l: GlobeLink) => (l.isPath ? 88 : 102)).strength((l: GlobeLink) => (l.isPath ? 0.42 : 0.2));

      const cleanup = () => {
        window.removeEventListener("resize", syncSize);
      };
      (fg as { __cleanup?: () => void }).__cleanup = cleanup;
    };

    void init();

    return () => {
      cancelled = true;
      if (domEl && stopAutoRotateRef.current) {
        domEl.removeEventListener("pointerdown", stopAutoRotateRef.current);
        domEl.removeEventListener("wheel", stopAutoRotateRef.current);
      }
      if (controlsRef && controlsClampHandler) {
        controlsRef.removeEventListener?.("change", controlsClampHandler);
      }
      scaffoldRef.current?.dispose();
      scaffoldRef.current = null;
      if (fgRef.current?.__cleanup) fgRef.current.__cleanup();
      if (fgRef.current?._destructor) fgRef.current._destructor();
      fgRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
      stopAutoRotateRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!active || !fg || !focusNodeIds.length) return;
    const focusKey = `${focusTriggerKey}|${focusNodeIds.join(">")}`;
    if (lastFocusKeyRef.current === focusKey) return;
    const liveNodes = (fg.graphData()?.nodes ?? []) as GlobeNode[];
    const targetNodes = liveNodes.filter((n) => focusNodeIds.includes(n.id));
    if (!targetNodes.length) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    targetNodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
      if (n.z < minZ) minZ = n.z;
      if (n.z > maxZ) maxZ = n.z;
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ, 1);
    const dist = Math.max(SPATIAL.cameraZoomMin + 30, Math.min(SPATIAL.cameraZoomMax - 80, 540 + span * 0.72));

    fg.cameraPosition(
      { x: cx, y: SPATIAL.cameraStart.y, z: cz + dist },
      { x: cx, y: cy, z: cz },
      980
    );
    focusedNodeRef.current = "__focus";
    lastFocusKeyRef.current = focusKey;
  }, [active, fgReadyToken, focusNodeIds, focusTriggerKey]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!active || !fg) return;

    if (graphVersionRef.current !== graphVersion) {
      fg.graphData(graphData);
      graphVersionRef.current = graphVersion;
      focusedNodeRef.current = null;
    }
    fg.nodeLabel((n: GlobeNode) => `${n.label} (${n.type}) · Layer ${n.layer + 1}`);
    fg.nodeColor((n: GlobeNode) => TYPE_COLOR[n.type]);
    fg.nodeVal((n: GlobeNode) => {
      const base = Math.max(2.2, n.r * SPATIAL.nodeScale);
      if (n.id === selectedNodeId) return base * 1.7;
      if (n.isPath) return base * 1.36;
      const q = searchQuery.trim().toLowerCase();
      const isSearchMatch = !q || n.label.toLowerCase().includes(q);
      if (!isSearchMatch && q) return base * 0.7;
      return base;
    });
    fg.linkColor((l: GlobeLink) => {
      if (l.isPath) return "#e879f9";
      if (!l.isSearchMatch && searchQuery.trim()) return "rgba(50,66,93,0.18)";
      return "rgba(128, 164, 209, 0.4)";
    });
    fg.linkOpacity((l: GlobeLink) => {
      if (l.isPath) return 0.95;
      if (!l.isSearchMatch && searchQuery.trim()) return 0.09;
      return Math.max(0.11, l.opacity * 0.42);
    });
    fg.linkWidth((l: GlobeLink) => {
      if (l.isPath) return 3.2;
      return 0.7 + l.weight * 1.06;
    });
    fg.linkCurvature((l: GlobeLink) => (l.isPath ? 0.18 : 0.03));
    fg.linkCurveRotation((l: GlobeLink) => (l.isPath ? 0.12 : 0));
    fg.linkDirectionalArrowLength((l: GlobeLink) => (l.isPath ? 5.2 : 0));
    fg.linkDirectionalArrowRelPos((l: GlobeLink) => (l.isPath ? 0.92 : 0));
    fg.linkDirectionalArrowColor(() => "#f5d0fe");
    fg.linkDirectionalParticles((l: GlobeLink) => (l.isPath ? 5 : l.weight > 0.78 ? 1 : 0));
    fg.linkDirectionalParticleWidth((l: GlobeLink) => (l.isPath ? 2.35 : 0.82));
    fg.linkDirectionalParticleSpeed((l: GlobeLink) => (l.isPath ? 0.016 + Math.max(0, l.pathStep) * 0.001 : 0.003 + l.weight * 0.003));

    // Idea 3: Monoliths (Unique 3D geometries for landmark nodes)
    fg.nodeThreeObject((node: GlobeNode) => {
        // High degree nodes or path endpoints get "Monolith" status
        const isLandmark = node.r > 15 || node.isPath || node.isSelected;
        if (!isLandmark) return null; // Default to sphere if null

        const THREE = (window as any).THREE;
        if (!THREE) return null;

        const group = new THREE.Group();
        
        // Base geometry based on type
        let geometry;
        if (node.type === "company") {
            geometry = new THREE.BoxGeometry(node.r * 0.5, node.r * 1.8, node.r * 0.5);
        } else if (node.type === "club") {
            geometry = new THREE.OctahedronGeometry(node.r * 0.7);
        } else {
            geometry = new THREE.CylinderGeometry(node.r * 0.6, node.r * 0.6, node.r * 0.4, 6);
        }

        const material = new THREE.MeshStandardMaterial({
            color: TYPE_COLOR[node.type],
            emissive: TYPE_COLOR[node.type],
            emissiveIntensity: node.isSelected ? 1.2 : 0.6,
            transparent: true,
            opacity: 0.9,
            metalness: 0.8,
            roughness: 0.2
        });

        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);

        // Add a "Halo" ring for landmarks
        if (node.isSelected || node.isPath) {
            const ringGeom = new THREE.TorusGeometry(node.r * 1.1, 0.4, 8, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        }

        return group;
    });

    if (selectedNodeId && focusedNodeRef.current !== selectedNodeId) {
      const liveNodes = (fg.graphData()?.nodes ?? []) as GlobeNode[];
      const target = liveNodes.find((n) => n.id === selectedNodeId) ?? graphData.nodes.find((n) => n.id === selectedNodeId);
      if (target) {
        focusedNodeRef.current = selectedNodeId;
        fg.cameraPosition(
          { x: target.x, y: SPATIAL.cameraStart.y, z: target.z + SPATIAL.cameraFocusDistance },
          { x: target.x, y: target.y, z: target.z },
          980
        );
      }
    }
    if (!selectedNodeId) focusedNodeRef.current = null;
  }, [active, fgReadyToken, graphData, graphVersion, searchQuery, selectedNodeId]);

  // Idea 4: Market Pulse 3D Effect
  useEffect(() => {
    const fg = fgRef.current;
    if (!active || !fg || lastPulseTs === 0) return;

    const scene = fg.scene();
    const THREE = (window as any).THREE;
    if (!scene || !THREE) return;

    // Create a large expanding shell for the pulse
    const geom = new THREE.SphereGeometry(10, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        depthWrite: false
    });
    const shell = new THREE.Mesh(geom, mat);
    scene.add(shell);

    const duration = 2000;
    const startTime = performance.now();

    const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = elapsed / duration;
        if (progress < 1) {
            shell.scale.setScalar(1 + progress * 150);
            shell.material.opacity = 0.12 * (1 - progress);
            requestAnimationFrame(animate);
        } else {
            scene.remove(shell);
            geom.dispose();
            mat.dispose();
        }
    };
    requestAnimationFrame(animate);

  }, [active, lastPulseTs]);

  return (
    <div className="graph3DCanvas graph3DCanvas--spatial">
      <div ref={containerRef} className="graph3DViewport" />
      <div className="spatialHud spatialHud--compass" aria-hidden="true">
        <span className="spatialHudLabel">North</span>
        <span className="spatialCompassArrow" />
      </div>
      <div className="spatialHud spatialHud--legend" aria-hidden="true">
        <span>Core</span>
        <span>Network</span>
        <span>Opportunity Rim</span>
      </div>
      {graphData.pathSteps.length > 1 && (
        <div className="spatialRoadmap" aria-hidden="true">
          {graphData.pathSteps.slice(0, 8).map((step) => (
            <span key={step.id} className="spatialRoadmapStep">
              <b>{step.index + 1}</b>{step.label}
            </span>
          ))}
        </div>
      )}
      <div className="spatialMinimap" aria-hidden="true">
        <div className="spatialMinimapTitle">Spatial map</div>
        <svg viewBox="0 0 100 100" className="spatialMinimapSvg">
          <circle cx="50" cy="50" r="16" className="spatialMinimapRing" />
          <circle cx="50" cy="50" r="30" className="spatialMinimapRing" />
          <circle cx="50" cy="50" r="42" className="spatialMinimapRing spatialMinimapRing--outer" />
          {graphData.pathSteps.length > 1 && (
            <polyline
              points={graphData.pathSteps
                .map((step) => {
                  const dot = minimapView.find((n) => n.id === step.id);
                  return dot ? `${dot.px},${dot.py}` : "";
                })
                .filter(Boolean)
                .join(" ")}
              className="spatialMinimapPath"
            />
          )}
          {minimapView.map((n) => (
            <circle
              key={n.id}
              cx={n.px}
              cy={n.py}
              r={n.isSelected ? 2.2 : n.isPath ? 1.8 : 1.2}
              className={`spatialMinimapNode${n.isPath ? " spatialMinimapNode--path" : ""}${n.isSelected ? " spatialMinimapNode--selected" : ""}`}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
