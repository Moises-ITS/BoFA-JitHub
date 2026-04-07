import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { useRef, useMemo, useEffect, Suspense, useState } from 'react';
import * as THREE from 'three';
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
    () => ll(cluster.lat, cluster.lng, GLOBE_R + 0.028),
    [cluster.lat, cluster.lng],
  );

  const targetDotPos = useMemo(
    () =>
      cluster.opps.map((opp) => ll(opp.lat, opp.lng, GLOBE_R + 0.03)),
    [cluster.opps],
  );

  const clusterSize  = Math.min(0.034 + n * 0.011, 0.10);
  const clusterColor = dominantColor(cluster.opps);

  const exp        = useRef(0);
  const clusterRef = useRef<THREE.Mesh>(null!);
  const clusterHaloRef = useRef<THREE.Mesh>(null!);
  const dotRefs    = useRef<(THREE.Mesh | null)[]>([]);
  const dotHaloRefs = useRef<(THREE.Mesh | null)[]>([]);
  const centerVector = useMemo(
    () => new THREE.Vector3(...center).normalize(),
    [center],
  );
  const targetVectors = useMemo(
    () => targetDotPos.map((position) => new THREE.Vector3(...position).normalize()),
    [targetDotPos],
  );

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
      const current = centerVector.clone().slerp(targetVectors[i], e).multiplyScalar(GLOBE_R + 0.03);
      const px = current.x;
      const py = current.y;
      const pz = current.z;
      ref.position.set(px, py, pz);
      const dp = 1 + Math.sin(t * 2.5 + phase + i * 0.6) * 0.18;
      const baseDotScale = [0.78, 0.5, 0.28][zoomLevel] ?? 0.78;
      const sc = Math.max(0.12, 0.2 + e * 0.68) * baseDotScale * dp * (cluster.opps[i].id === activeId ? 1.32 : 1);
      const frontness = THREE.MathUtils.clamp((pz + GLOBE_R + 0.18) / (GLOBE_R * 2.3), 0.18, 1);
      ref.scale.setScalar(Math.max(0.001, sc));
      (ref.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, e * 0.95 * frontness);

      const haloRef = dotHaloRefs.current[i];
      if (!haloRef) return;
      haloRef.position.copy(ref.position);
      haloRef.scale.setScalar(Math.max(0.001, sc * 1.9));
      (haloRef.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0.04, e * (cluster.opps[i].id === activeId ? 0.45 : 0.24) * frontness);
    });
  });

  return (
    <>
      {/* Main cluster bubble */}
      <mesh ref={clusterRef} position={center}>
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

      {/* Individual dots — start at center, animate to ring */}
      {cluster.opps.map((opp, i) => (
        <group key={opp.id}>
          <mesh
            ref={(el) => { dotHaloRefs.current[i] = el; }}
            position={center}
          >
            <sphereGeometry args={[0.044, 12, 12]} />
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
          >
            <sphereGeometry args={[0.024, 16, 16]} />
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
  return (
    <>
      {/* Layer 1 — safer single-texture earth base */}
      <mesh>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial
          color={new THREE.Color('#173a63')}
          emissive={new THREE.Color('#10233c')}
          emissiveIntensity={0.75}
          roughness={0.92}
          metalness={0.04}
        />
      </mesh>

      {/* Layer 2 — night lights */}
      <mesh rotation={[0, 0.35, 0]}>
        <sphereGeometry args={[GLOBE_R * 1.003, 48, 48]} />
        <meshBasicMaterial
          color="#56b3ff"
          transparent
          opacity={0.06}
          wireframe
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

      {/* Layer 4 — fresnel-like outer aura */}
      <mesh>
        <sphereGeometry args={[GLOBE_R * 1.085, 40, 40]} />
        <meshBasicMaterial
          color="#8edcff"
          transparent
          opacity={0.07}
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
  const targetX    = useRef(0);
  const targetCamZ = useRef(CAM_DEFAULT);
  const targetCamX = useRef(0);
  const targetCamY = useRef(0);

  const clusters  = useMemo(() => buildClusters(opportunities), [opportunities]);
  const activeOpp = useMemo(
    () => opportunities.find((o) => o.id === activeId) ?? null,
    [opportunities, activeId],
  );

  useEffect(() => {
    if (activeOpp) {
      spinning.current = false;
      /* Rotate so the selected longitude faces the camera and latitude is centered. */
      targetY.current   = THREE.MathUtils.degToRad(-activeOpp.lng - 90);
      targetX.current   = THREE.MathUtils.degToRad(activeOpp.lat);
      targetCamZ.current = CAM_LEVELS[zoomLevel];
      targetCamX.current = 0;
      targetCamY.current = 0;
    } else {
      spinning.current   = true;
      targetX.current    = 0;
      targetCamZ.current = CAM_DEFAULT;
      targetCamX.current = 0;
      targetCamY.current = 0;
    }
  }, [activeOpp, zoomLevel]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (spinning.current) {
      groupRef.current.rotation.y += delta * 0.08;
      groupRef.current.rotation.x += (0 - groupRef.current.rotation.x) * Math.min(1, delta * 1.6);
    } else {
      /* Normalise to shortest arc before lerping */
      let cur = groupRef.current.rotation.y;
      while (cur - targetY.current >  Math.PI) cur -= 2 * Math.PI;
      while (cur - targetY.current < -Math.PI) cur += 2 * Math.PI;
      groupRef.current.rotation.y =
        cur + (targetY.current - cur) * Math.min(1, delta * 1.35);
      groupRef.current.rotation.x +=
        (targetX.current - groupRef.current.rotation.x) * Math.min(1, delta * 1.35);
    }

    /* Smooth camera zoom */
    state.camera.position.z +=
      (targetCamZ.current - state.camera.position.z) * Math.min(1, delta * 1.35);
    state.camera.position.x +=
      (targetCamX.current - state.camera.position.x) * Math.min(1, delta * 1.35);
    state.camera.position.y +=
      (targetCamY.current - state.camera.position.y) * Math.min(1, delta * 1.35);
    state.camera.lookAt(0, 0, 0);
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

      {activeOpp && (
        <group position={ll(activeOpp.lat, activeOpp.lng, GLOBE_R + 0.035)}>
          <mesh>
            <ringGeometry args={[0.045, 0.072, 32]} />
            <meshBasicMaterial
              color={TYPE_COLOR[activeOpp.type]}
              transparent
              opacity={0.82}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.028, 18, 18]} />
            <meshBasicMaterial
              color={TYPE_COLOR[activeOpp.type]}
              transparent
              opacity={0.95}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      )}
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
    </div>
  );
}
