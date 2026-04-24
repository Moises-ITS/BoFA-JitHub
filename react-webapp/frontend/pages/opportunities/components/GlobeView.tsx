import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, useTexture, Html } from '@react-three/drei';
import { useRef, useMemo, useEffect, Suspense, useState } from 'react';
import * as THREE from 'three';
import type { BufferGeometry, LineBasicMaterial } from 'three';
import type { Opportunity } from '../types/opportunities';

const GLOBE_R     = 2.0;
const CAM_DEFAULT = 7.5;                   // idle — globe fills ~60% of canvas
const CAM_LEVELS  = [4.6, 3.6, 2.85];     // continent → country → city/state
const ZOOM_LABELS = ['Continent', 'Country', 'City / State'] as const;

const TYPE_COLOR: Record<string, string> = {
  scholarship: '#22c55e',
  internship:  '#3b82f6',
  networking:  '#a78bfa',
};

/**
 * Geographic lat/lng → local 3D position matching THREE.SphereGeometry UV mapping.
 * lng=0   → +X,  lng=-90 → +Z (facing camera),  north pole → +Y
 */
function ll(lat: number, lng: number, r = GLOBE_R): [number, number, number] {
  const phi   = (lng + 180) * (Math.PI / 180);
  const theta = (90  - lat) * (Math.PI / 180);
  return [
    -r * Math.cos(phi) * Math.sin(theta),
     r * Math.cos(theta),
     r * Math.sin(phi) * Math.sin(theta),
  ];
}

/* ── Clustering ─────────────────────────────────────────────────────────── */
interface Cluster {
  lat: number;
  lng: number;
  opps: Opportunity[];
}

function buildClusters(opps: Opportunity[], threshold = 7): Cluster[] {
  const clusters: Cluster[] = [];
  for (const opp of opps) {
    let added = false;
    for (const c of clusters) {
      if (Math.hypot(opp.lat - c.lat, opp.lng - c.lng) < threshold) {
        c.opps.push(opp);
        c.lat = c.opps.reduce((s, o) => s + o.lat, 0) / c.opps.length;
        c.lng = c.opps.reduce((s, o) => s + o.lng, 0) / c.opps.length;
        added = true;
        break;
      }
    }
    if (!added) clusters.push({ lat: opp.lat, lng: opp.lng, opps: [opp] });
  }
  return clusters;
}

function dominantColor(opps: Opportunity[]): string {
  const counts: Record<string, number> = {};
  opps.forEach((o) => { counts[o.type] = (counts[o.type] ?? 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  return TYPE_COLOR[top] ?? '#ffffff';
}


/* ── Cluster dot group: large bubble → expands into individual colored dots ─ */
function ClusterGroup({
  cluster,
  activeId,
  zoomLevel,
  phase,
}: {
  cluster: Cluster;
  activeId: string | null;
  zoomLevel: number;
  phase: number;
}) {
  const n        = cluster.opps.length;
  const isActive = cluster.opps.some((o) => o.id === activeId);

  const center = useMemo(
    () => ll(cluster.lat, cluster.lng, GLOBE_R + 0.065),
    [cluster.lat, cluster.lng],
  );

  const targetDotPos = useMemo(
    () =>
      cluster.opps.map((opp) => ll(opp.lat, opp.lng, GLOBE_R + 0.07)),
    [cluster.opps],
  );

  const clusterSize  = Math.min(0.034 + n * 0.011, 0.10);
  const clusterColor = dominantColor(cluster.opps);

  const exp        = useRef(0);
  const clusterRef = useRef<THREE.Mesh>(null!);
  const clusterHaloRef = useRef<THREE.Mesh>(null!);
  const dotRefs    = useRef<(THREE.Mesh | null)[]>([]);
  const dotHaloRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lineRefs   = useRef<(THREE.Line<BufferGeometry, LineBasicMaterial> | null)[]>([]);
  const pulseRef   = useRef<THREE.Mesh>(null!);
  const pulsePhase = useRef(0);

  const [hoveredCluster, setHoveredCluster] = useState(false);
  const [hoveredOppId,   setHoveredOppId]   = useState<string | null>(null);

  const tooltipOpp  = hoveredOppId ? (cluster.opps.find((o) => o.id === hoveredOppId) ?? null) : null;
  const showTooltip = hoveredCluster || hoveredOppId !== null;
  const tooltipPos  = useMemo<[number, number, number]>(() => (
    tooltipOpp
      ? ll(tooltipOpp.lat, tooltipOpp.lng, GLOBE_R + 0.55)
      : ll(cluster.lat, cluster.lng, GLOBE_R + 0.55)
  ), [tooltipOpp, cluster.lat, cluster.lng]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    cluster.opps.forEach((o) => { counts[o.type] = (counts[o.type] ?? 0) + 1; });
    return counts;
  }, [cluster.opps]);

  const activeOppColor = isActive
    ? TYPE_COLOR[cluster.opps.find((o) => o.id === activeId)?.type ?? cluster.opps[0].type]
    : '#ffffff';

  useFrame((state, delta) => {
    const t         = state.clock.elapsedTime;
    const targetExp = isActive && n > 1
      ? [0.12, 0.68, 1][zoomLevel] ?? 0
      : 0;
    exp.current    += (targetExp - exp.current) * Math.min(1, delta * 4);
    const e         = exp.current;
    const pulse     = 1 + Math.sin(t * 2.5 + phase) * 0.18;
    const zoomShrink = isActive ? [0.92, 0.54, 0.22][zoomLevel] ?? 0.92 : 1;

    /* Cluster bubble shrinks as dots expand */
    if (clusterRef.current) {
      const s = (1 - e * 0.94) * pulse * (isActive ? 1.35 * zoomShrink : 1);
      clusterRef.current.scale.setScalar(Math.max(0.001, s));
      (clusterRef.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - e * 1.7) * (isActive ? 0.8 : 1));
    }
    if (clusterHaloRef.current) {
      const haloScale = (1 - e * 0.9) * (1.35 + (isActive ? 0.18 : 0)) * pulse * zoomShrink;
      clusterHaloRef.current.scale.setScalar(Math.max(0.001, haloScale));
      (clusterHaloRef.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - e * 1.35) * 0.22);
    }

    /* Individual dots expand outward from center to ring positions */
    dotRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const [sx, sy, sz] = center;
      const [ex, ey, ez] = targetDotPos[i];
      const px = sx + (ex - sx) * e;
      const py = sy + (ey - sy) * e;
      const pz = sz + (ez - sz) * e;
      ref.position.set(px, py, pz);
      const dp = 1 + Math.sin(t * 2.5 + phase + i * 0.6) * 0.18;
      const baseDotScale = [0.82, 0.58, 0.4][zoomLevel] ?? 0.82;
      const sc = Math.max(0.16, 0.28 + e * 0.82) * baseDotScale * dp * (cluster.opps[i].id === activeId ? 1.45 : 1);
      ref.scale.setScalar(Math.max(0.001, sc));
      (ref.material as THREE.MeshBasicMaterial).opacity = Math.max(0.2, e * 0.95);

      const haloRef = dotHaloRefs.current[i];
      if (!haloRef) return;
      haloRef.position.copy(ref.position);
      haloRef.scale.setScalar(Math.max(0.001, sc * 1.9));
      (haloRef.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0.08, e * (cluster.opps[i].id === activeId ? 0.45 : 0.24));

      const lineRef = lineRefs.current[i];
      if (lineRef) {
        const positions = lineRef.geometry.attributes.position.array as Float32Array;
        positions[0] = sx;
        positions[1] = sy;
        positions[2] = sz;
        positions[3] = px;
        positions[4] = py;
        positions[5] = pz;
        lineRef.geometry.attributes.position.needsUpdate = true;
        (lineRef.material as THREE.LineBasicMaterial).opacity = Math.max(
          0,
          e * ([0.08, 0.2, 0.34][zoomLevel] ?? 0.08),
        );
      }
    });

    /* Pulsing ring on active pin */
    if (pulseRef.current) {
      if (isActive) {
        pulsePhase.current = (pulsePhase.current + delta * 1.1) % 1;
        const activeIdx = cluster.opps.findIndex((o) => o.id === activeId);
        const dotRef = activeIdx >= 0 ? dotRefs.current[activeIdx] : null;
        if (dotRef && exp.current > 0.15) {
          pulseRef.current.position.copy(dotRef.position);
        } else {
          pulseRef.current.position.set(center[0], center[1], center[2]);
        }
        pulseRef.current.scale.setScalar(1 + pulsePhase.current * 3.2);
        (pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, 0.55 * (1 - pulsePhase.current));
      } else {
        pulsePhase.current = 0;
        (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  });

  return (
    <>
      {/* Main cluster bubble */}
      <mesh
        ref={clusterRef}
        position={center}
        onPointerOver={(e) => { e.stopPropagation(); setHoveredCluster(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHoveredCluster(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[clusterSize, 8, 8]} />
        <meshBasicMaterial color={clusterColor} transparent opacity={1} />
      </mesh>
      <mesh ref={clusterHaloRef} position={center}>
        <sphereGeometry args={[clusterSize * 1.7, 14, 14]} />
        <meshBasicMaterial
          color={clusterColor}
          transparent
          opacity={0.24}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Pulsing ring — expands outward from active pin */}
      <mesh ref={pulseRef} position={center}>
        <sphereGeometry args={[0.062, 16, 16]} />
        <meshBasicMaterial
          color={activeOppColor}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Hover tooltip */}
      {showTooltip && (
        <Html position={tooltipPos} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'rgba(6,9,26,0.93)',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 9,
            padding: '8px 12px',
            color: '#e2e8f0',
            fontSize: '12px',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            maxWidth: 230,
          }}>
            {tooltipOpp ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tooltipOpp.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: TYPE_COLOR[tooltipOpp.type], fontWeight: 600, fontSize: '11px', textTransform: 'capitalize' }}>
                    {tooltipOpp.type}
                  </span>
                  <span style={{ color: '#8a97b0', fontSize: '11px' }}>·</span>
                  <span style={{ color: '#8a97b0', fontSize: '11px' }}>{tooltipOpp.org}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{n} opportunities</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Object.entries(typeCounts).map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLOR[type], display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: '#8a97b0', fontSize: '11px', textTransform: 'capitalize' }}>{count} {type}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Html>
      )}

      {/* Individual dots — start at center, animate to ring */}
      {cluster.opps.map((opp, i) => (
        <group key={opp.id}>
          <line
            ref={(el) => { lineRefs.current[i] = el; }}
            position={[0, 0, 0]}
          >
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([...center, ...center]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={TYPE_COLOR[opp.type]}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </line>
          <mesh
            ref={(el) => { dotHaloRefs.current[i] = el; }}
            position={center}
          >
            <sphereGeometry args={[0.062, 12, 12]} />
            <meshBasicMaterial
              color={TYPE_COLOR[opp.type]}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={(el) => { dotRefs.current[i] = el; }}
            position={center}
            onPointerOver={(e) => { e.stopPropagation(); setHoveredOppId(opp.id); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHoveredOppId(null); document.body.style.cursor = 'auto'; }}
          >
            <sphereGeometry args={[0.036, 16, 16]} />
            <meshBasicMaterial
              color={TYPE_COLOR[opp.type]}
              transparent
              opacity={0}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

/* ── Earth sphere + atmosphere (uses useTexture → must be inside Suspense) ── */
function EarthMesh() {
  const night = useTexture('https://unpkg.com/three-globe/example/img/earth-night.jpg');

  return (
    <>
      {/* Layer 1 — base: standard material so ambient light lifts landmasses
          slightly, while high emissiveIntensity makes city lights blaze.   */}
      <mesh>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial
          map={night}
          emissiveMap={night}
          emissive={new THREE.Color('#ffffff')}
          emissiveIntensity={2.9}
          roughness={0.82}
          metalness={0}
          color={new THREE.Color('#dbeafe')}
        />
      </mesh>

      {/* Layer 2 — bloom halo: additive blending causes bright city-light
          pixels to bleed outward, faking a glow without post-processing.   */}
      <mesh>
        <sphereGeometry args={[GLOBE_R * 1.01, 64, 64]} />
        <meshBasicMaterial
          map={night}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* Layer 3 — cool atmospheric glow */}
      <mesh>
        <sphereGeometry args={[GLOBE_R * 1.03, 32, 32]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Layer 4 — soft cyan aura for a brighter silhouette */}
      <mesh>
        <sphereGeometry args={[GLOBE_R * 1.09, 32, 32]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/* ── Globe group: handles Y-rotation + camera zoom/pan based on active opp ── */
function GlobeGroup({
  opportunities,
  activeId,
  zoomLevel,
}: {
  opportunities: Opportunity[];
  activeId: string | null;
  zoomLevel: number;
}) {
  const groupRef   = useRef<THREE.Group>(null!);
  const spinning   = useRef(true);
  const targetY    = useRef(0);
  const targetCamZ = useRef(CAM_DEFAULT);
  const targetCamY = useRef(0);

  const clusters  = useMemo(
    () => buildClusters(opportunities.filter((o) => o.lat !== 0 || o.lng !== 0)),
    [opportunities],
  );
  const activeOpp = useMemo(
    () => opportunities.find((o) => o.id === activeId) ?? null,
    [opportunities, activeId],
  );

  useEffect(() => {
    if (activeOpp) {
      spinning.current = false;
      /* Rotate so activeOpp.lng faces the camera (+Z side) */
      targetY.current   = -(90 + activeOpp.lng) * (Math.PI / 180);
      targetCamZ.current = CAM_LEVELS[zoomLevel];
      /* Shift camera vertically so the selected latitude is centred */
      targetCamY.current = GLOBE_R * Math.sin(activeOpp.lat * (Math.PI / 180));
    } else {
      spinning.current   = true;
      targetCamZ.current = CAM_DEFAULT;
      targetCamY.current = 0;
    }
  }, [activeOpp, zoomLevel]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (spinning.current) {
      groupRef.current.rotation.y += delta * 0.08;
    } else {
      /* Normalise to shortest arc before lerping */
      let cur = groupRef.current.rotation.y;
      while (cur - targetY.current >  Math.PI) cur -= 2 * Math.PI;
      while (cur - targetY.current < -Math.PI) cur += 2 * Math.PI;
      groupRef.current.rotation.y =
        cur + (targetY.current - cur) * Math.min(1, delta * 1.8);
    }

    /* Smooth camera zoom + vertical pan */
    state.camera.position.z +=
      (targetCamZ.current - state.camera.position.z) * Math.min(1, delta * 1.8);
    state.camera.position.y +=
      (targetCamY.current - state.camera.position.y) * Math.min(1, delta * 1.8);
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <EarthMesh />
      </Suspense>

      {clusters.map((c, i) => (
        <ClusterGroup
          key={`${c.lat.toFixed(1)},${c.lng.toFixed(1)}`}
          cluster={c}
          activeId={activeId}
          zoomLevel={zoomLevel}
          phase={i * 0.73}
        />
      ))}
    </group>
  );
}

/* ── Public export ───────────────────────────────────────────────────────── */
export default function GlobeView({
  opportunities,
  activeId,
}: {
  opportunities: Opportunity[];
  activeId: string | null;
}) {
  const [zoomLevel, setZoomLevel] = useState(0);

  /* Reset to continent view whenever a new opportunity is selected */
  useEffect(() => {
    setZoomLevel(0);
  }, [activeId]);

  return (
    <div className="globe-canvas-wrap" style={{ position: 'relative' }}>
      <Canvas
        gl={{ alpha: true }}
        camera={{ position: [0, 0, CAM_DEFAULT], fov: 50 }}
      >
        <Stars
          radius={100}
          depth={60}
          count={8000}
          factor={4.6}
          saturation={0.18}
          fade
          speed={0.65}
        />
        <ambientLight intensity={0.22} />
        <hemisphereLight
          args={['#8edcff', '#050816', 0.5]}
        />
        <directionalLight
          position={[5, 2.5, 6]}
          intensity={1.15}
          color="#dbeafe"
        />
        <pointLight
          position={[-6, -3, 4]}
          intensity={0.7}
          color="#7c3aed"
        />

        <GlobeGroup
          opportunities={opportunities}
          activeId={activeId}
          zoomLevel={zoomLevel}
        />
      </Canvas>

      {/* Zoom level selector — only visible when an opportunity is active */}
      {activeId && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            background: 'rgba(6,9,26,0.72)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 999,
            padding: '5px 8px',
            backdropFilter: 'blur(8px)',
          }}
        >
          {ZOOM_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => setZoomLevel(i)}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                border: 'none',
                background: zoomLevel === i
                  ? 'rgba(59,130,246,0.55)'
                  : 'transparent',
                color: zoomLevel === i ? '#fff' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: zoomLevel === i ? 700 : 400,
                letterSpacing: '0.03em',
                transition: 'all 0.18s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="opportunities-globe-legend">
        <div className="opportunities-globe-legend-title">Globe Guide</div>
        <div className="opportunities-globe-legend-item">
          <span className="opportunities-globe-legend-dot internship" />
          Internship
        </div>
        <div className="opportunities-globe-legend-item">
          <span className="opportunities-globe-legend-dot scholarship" />
          Scholarship
        </div>
        <div className="opportunities-globe-legend-item">
          <span className="opportunities-globe-legend-dot networking" />
          Networking
        </div>
      </div>
    </div>
  );
}
