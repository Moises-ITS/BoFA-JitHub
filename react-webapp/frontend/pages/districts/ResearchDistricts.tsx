import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { motion, AnimatePresence } from "motion/react";
import * as THREE from "three";

type Opportunity = { id: string; title: string; description: string; tags: string[]; requirement: string };
type Building = { id: string; name: string; professor: string; position: [number, number, number]; size: [number, number, number]; opportunities: Opportunity[] };
type District = { id: string; name: string; shortStat: string; color: string; position: [number, number, number]; ringScale: number; buildings: Building[] };

const mkOpp = (id: string, title: string): Opportunity => ({ id, title, description: "Explore this research opportunity.", tags: ["Research"], requirement: "Interest and consistency." });

const DISTRICTS: District[] = [
  { id: "ai", name: "AI & Machine Learning", shortStat: "3 departments", color: "#3B82F6", position: [-8.08, 0, -2.63], ringScale: 2.55, buildings: [
    { id: "cs", name: "Computer Science", professor: "Department Hub", position: [-1.5, 0.95, -0.35], size: [1.05, 1.9, 1.05], opportunities: [mkOpp("cs-1", "Systems + AI Research Assistant")] },
    { id: "info", name: "Informatics", professor: "Department Hub", position: [0.15, 0.75, 0.75], size: [0.9, 1.45, 0.9], opportunities: [mkOpp("info-1", "Human-Centered Data Research")] },
    { id: "ds", name: "Data Science", professor: "Department Hub", position: [1.55, 1.2, -0.65], size: [1.0, 2.35, 1.0], opportunities: [mkOpp("ds-1", "Predictive Modeling Research")] },
  ]},
  { id: "science", name: "Physical & Life Sciences", shortStat: "5 departments", color: "#8B5CF6", position: [0, 0, -8.5], ringScale: 2.7, buildings: [
    { id: "physics", name: "Physics", professor: "Department Hub", position: [-1.75, 0.85, 0.45], size: [0.9, 1.7, 0.9], opportunities: [mkOpp("phys-1", "Applied Physics Research")] },
    { id: "math", name: "Mathematics", professor: "Department Hub", position: [-0.45, 1.1, -0.65], size: [1.0, 2.2, 1.0], opportunities: [mkOpp("math-1", "Mathematical Modeling Assistant")] },
    { id: "chem", name: "Chemistry", professor: "Department Hub", position: [0.95, 0.72, 0.95], size: [0.82, 1.4, 0.82], opportunities: [mkOpp("chem-1", "Environmental Chemistry Research")] },
    { id: "bio", name: "Biological Sciences", professor: "Department Hub", position: [2.15, 0.7, -0.15], size: [0.82, 1.35, 0.82], opportunities: [mkOpp("bio-1", "Molecular Systems Research")] },
    { id: "bio2", name: "Biomedical Engineering", professor: "Anchor", position: [0.45, 1.35, 1.85], size: [0.96, 2.55, 0.96], opportunities: [mkOpp("bio2-1", "Cross-Disciplinary Bioengineering")] },
  ]},
  { id: "engineering", name: "Engineering Systems", shortStat: "5 departments", color: "#EF4444", position: [8.08, 0, -2.63], ringScale: 2.75, buildings: [
    { id: "ece", name: "Electrical and Computer Engineering", professor: "Department Hub", position: [-1.75, 1.1, 0.25], size: [1.0, 2.1, 1.0], opportunities: [mkOpp("ece-1", "Embedded + Intelligent Systems")] },
    { id: "cme", name: "Chemical and Materials Engineering", professor: "Department Hub", position: [-0.15, 0.8, -0.9], size: [0.9, 1.55, 0.9], opportunities: [mkOpp("cme-1", "Advanced Materials Research")] },
    { id: "cee", name: "Civil and Environmental Engineering", professor: "Department Hub", position: [1.1, 0.7, 0.95], size: [0.85, 1.35, 0.85], opportunities: [mkOpp("cee-1", "Infrastructure + Sustainability")] },
    { id: "mie", name: "Mechanical and Industrial Engineering", professor: "Department Hub", position: [2.05, 1.25, -0.25], size: [1.05, 2.45, 1.05], opportunities: [mkOpp("mie-1", "Optimization + Manufacturing")] },
    { id: "bme", name: "Biomedical Engineering", professor: "Department Hub", position: [0.4, 1.35, 1.8], size: [0.95, 2.65, 0.95], opportunities: [mkOpp("bme-1", "Biomedical Devices + Health Tech")] },
  ]},
  { id: "design-humanities", name: "Design, Society & Culture", shortStat: "3 departments", color: "#14B8A6", position: [-4.99, 0, 6.88], ringScale: 2.45, buildings: [
    { id: "arch", name: "Architecture and Design", professor: "Department Hub", position: [-1.1, 0.85, -0.35], size: [0.95, 1.7, 0.95], opportunities: [mkOpp("arch-1", "Spatial Systems + Design Research")] },
    { id: "hss", name: "Humanities and Social Sciences", professor: "Department Hub", position: [0.45, 1.15, 0.65], size: [1.0, 2.25, 1.0], opportunities: [mkOpp("hss-1", "Society + Policy Research")] },
    { id: "math2", name: "Mathematics", professor: "Analytical Anchor", position: [1.75, 0.7, -0.1], size: [0.8, 1.35, 0.8], opportunities: [mkOpp("math2-1", "Quantitative Humanities")] },
  ]},
  { id: "management", name: "Management & Applied Technology", shortStat: "2 departments", color: "#F59E0B", position: [4.99, 0, 6.88], ringScale: 2.2, buildings: [
    { id: "mgmt", name: "Management", professor: "Department Hub", position: [-0.95, 0.85, 0.2], size: [0.92, 1.65, 0.92], opportunities: [mkOpp("mgmt-1", "Innovation + Decision Systems")] },
    { id: "maet", name: "Applied Engineering and Technology", professor: "Department Hub", position: [0.75, 1.2, -0.7], size: [1.0, 2.35, 1.0], opportunities: [mkOpp("maet-1", "Applied Technology Systems")] },
  ]},
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const shade = (hex: string, k: number) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;
const randSeed = (s: string) => { let h = 1779033703; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967295; }; };

function CameraRig({ focusedDistrict, controlsRef }: { focusedDistrict: District | null; controlsRef: React.RefObject<any> }) {
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const currentOffset = useMemo(() => new THREE.Vector3(), []);
  const spherical = useMemo(() => new THREE.Spherical(), []);

  useFrame((state) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const [tx, ty, tz] = focusedDistrict ? [focusedDistrict.position[0], 0.6, focusedDistrict.position[2]] : [0, 0, 0];
    const desiredRadius = focusedDistrict ? 8.4 : 16.2;

    desiredTarget.set(tx, ty, tz);
    controls.target.lerp(desiredTarget, 0.08);

    currentOffset.copy(state.camera.position).sub(controls.target);
    if (currentOffset.lengthSq() < 0.0001) currentOffset.set(0, 7.2, desiredRadius);
    spherical.setFromVector3(currentOffset);

    spherical.radius = lerp(spherical.radius, desiredRadius, 0.08);
    spherical.phi = 1.08; // lock vertical angle so orbit stays horizontal-only

    currentOffset.setFromSpherical(spherical);
    state.camera.position.copy(controls.target).add(currentOffset);
    controls.update();
  });

  return null;
}

function FlowBeam({
  start,
  end,
  color,
  speed,
  phase,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  speed: number;
  phase: number;
}) {
  const beamRef = useRef<THREE.Group>(null);
  const startVec = useMemo(() => new THREE.Vector3(start[0], start[1], start[2]), [start]);
  const endVec = useMemo(() => new THREE.Vector3(end[0], end[1], end[2]), [end]);
  const direction = useMemo(() => endVec.clone().sub(startVec), [startVec, endVec]);
  const length = useMemo(() => direction.length(), [direction]);
  const directionNorm = useMemo(() => direction.clone().normalize(), [direction]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), directionNorm),
    [directionNorm]
  );
  const beamLength = 0.46;

  useFrame((state) => {
    if (!beamRef.current) return;
    const t = (state.clock.elapsedTime * speed + phase) % 1;
    const travel = Math.max(length - beamLength, 0.01);
    const dist = t * travel + beamLength * 0.5;
    const pos = startVec.clone().addScaledVector(directionNorm, dist);
    beamRef.current.position.copy(pos);
    beamRef.current.quaternion.copy(quaternion);
  });

  return (
    <group ref={beamRef}>
      <mesh>
        <cylinderGeometry args={[0.022, 0.022, beamLength, 12]} />
        <meshBasicMaterial color={color} transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.032, 0.032, beamLength * 1.02, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  );
}

function DistrictNetwork() {
  const links = useMemo(() => {
    const order = ["science", "engineering", "management", "design-humanities", "ai"] as const;
    const idToColor = new Map<string, string>(DISTRICTS.map((d) => [d.id, d.color]));
    const idToPosition = new Map<string, [number, number, number]>(DISTRICTS.map((d) => [d.id, d.position]));
    const center = new THREE.Vector3(0, 0.62, 0);
    const hubRadius = 0.54;

    return order.map((fromId) => {
      const pa = idToPosition.get(fromId) ?? [0, 0, 0];
      const startPoint = new THREE.Vector3(pa[0], 0.24, pa[2]);
      const toCenter = center.clone().sub(startPoint).normalize();
      const endPoint = center.clone().sub(toCenter.multiplyScalar(hubRadius));
      const start: [number, number, number] = [startPoint.x, startPoint.y, startPoint.z];
      const end: [number, number, number] = [endPoint.x, endPoint.y, endPoint.z];
      const direction = endPoint.clone().sub(startPoint);
      const length = direction.length();
      const mid = startPoint.clone().addScaledVector(direction, 0.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      return {
        fromId,
        color: idToColor.get(fromId) ?? "#ffffff",
        start,
        end,
        length,
        mid: [mid.x, mid.y, mid.z] as [number, number, number],
        quat: [q.x, q.y, q.z, q.w] as [number, number, number, number],
      };
    });
  }, []);

  const [activeFlows, setActiveFlows] = useState<Array<{ id: string; linkIndex: number; speed: number; phase: number }>>([]);

  useEffect(() => {
    const generateFlows = () => {
      const count = 1 + Math.floor(Math.random() * 5);
      const indices = links.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, count);
      setActiveFlows(
        indices.map((linkIndex, idx) => ({
          id: `${Date.now()}-${linkIndex}-${idx}`,
          linkIndex,
          speed: 0.1 + Math.random() * 0.02,
          phase: 0,
        }))
      );
    };

    generateFlows();
    // Keep each random batch long enough so packets complete full routes before replacement.
    const interval = window.setInterval(generateFlows, 12000);
    return () => window.clearInterval(interval);
  }, [links]);

  return (
    <group>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.54, 24, 24]} />
        <meshStandardMaterial color="#e8eef8" roughness={0.18} metalness={0.42} emissive="#ffffff" emissiveIntensity={0.22} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.33, 20, 20]} />
        <meshStandardMaterial color="#b7c8de" roughness={0.22} metalness={0.36} emissive="#dce8f8" emissiveIntensity={0.18} />
      </mesh>

      {links.map((link, idx) => (
        <group key={`network-${idx}`}>
          <mesh position={link.mid} quaternion={link.quat}>
            <cylinderGeometry args={[0.018, 0.018, link.length, 10]} />
            <meshStandardMaterial color="#cfd7e2" emissive="#e7edf6" emissiveIntensity={0.1} roughness={0.3} metalness={0.32} transparent opacity={0.76} />
          </mesh>
        </group>
      ))}
      {activeFlows.map((flow) => {
        const link = links[flow.linkIndex];
        if (!link) return null;
        return (
          <FlowBeam
            key={flow.id}
            start={link.start}
            end={link.end}
            color={link.color}
            speed={flow.speed}
            phase={flow.phase}
          />
        );
      })}
    </group>
  );
}

function DistrictNode({ district, active, dimmed, onSelect }: { district: District; active: boolean; dimmed: boolean; onSelect: (d: District) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={district.position}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} scale={[district.ringScale * 0.8, 1, district.ringScale * 0.8]}>
        <ringGeometry args={[0.88, 1, 6]} />
        <meshStandardMaterial color="#0b1220" roughness={0.9} metalness={0.1} emissive={district.color} emissiveIntensity={0.03} side={THREE.DoubleSide} transparent opacity={dimmed ? 0.2 : 0.45} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} scale={[district.ringScale, district.ringScale, 1]}>
        <ringGeometry args={[0.95, 1.08, 64]} />
        <meshBasicMaterial color={district.color} transparent opacity={active || hovered ? 0.26 : 0.14} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onClick={() => onSelect(district)}>
        <circleGeometry args={[district.ringScale * 0.9, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
      <Html position={[0, 1.55, -district.ringScale * 0.52]} center distanceFactor={11} zIndexRange={[2, 0]} style={{ pointerEvents: "none" }}>
        <div className={`rounded-2xl border px-4 py-2 backdrop-blur-md transition-all duration-300 ${dimmed ? "opacity-35" : "opacity-100"} ${hovered || active ? "scale-105" : "scale-100"}`} style={{ borderColor: district.color, background: "rgba(5,10,24,0.72)", minWidth: 180 }}>
          <div className="text-[13px] font-semibold text-white">{district.name}</div><div className="mt-1 text-[11px] text-slate-300">{district.shortStat}</div>
        </div>
      </Html>
    </group>
  );
}

function MiniCity({ district }: { district: District }) {
  const palette = useMemo(() => ({ ground: shade(district.color, 0.16), dark: shade(district.color, 0.3), mid: shade(district.color, 0.42), light: shade(district.color, 0.6), accent: shade(district.color, 0.86) }), [district.color]);
  const blocks = useMemo(() => {
    const r = randSeed(district.id);
    const count = district.id === "engineering" ? 16 : district.id === "science" ? 15 : 12;
    return Array.from({ length: count }).map((_, i) => {
      const a = (i / count) * Math.PI * 2 + r() * 0.25;
      const rad = 0.35 + r() * district.ringScale * 0.52;
      const h0 = 0.22 + r() * 0.72;
      let h = h0 * (district.id === "ai" ? 1.2 : district.id === "design-humanities" ? 0.85 : 1.0);
      let w = 0.18 + r() * 0.25; let d = 0.18 + r() * 0.25;
      let kind: "box" | "cylinder" | "cone" = "box";
      if (district.id === "science" && r() > 0.55) kind = "cylinder";
      if (district.id === "ai" && r() > 0.62) { kind = "cone"; h *= 1.25; w *= 0.72; d *= 0.72; }
      if (district.id === "engineering" && r() > 0.52) { w *= 1.3; d *= 1.2; h *= 0.9; }
      const toneRoll = r();
      const tone: "dark" | "mid" | "light" = toneRoll > 0.74 ? "light" : toneRoll > 0.38 ? "mid" : "dark";
      return { p: [Math.cos(a) * rad, h / 2 + 0.08, Math.sin(a) * rad] as [number, number, number], s: [w, h, d] as [number, number, number], kind, tone };
    });
  }, [district]);
  return (
    <group position={district.position}>
      <mesh position={[0, -0.025, 0]}>
        <cylinderGeometry args={[district.ringScale * 0.78, district.ringScale * 0.78, 0.05, 36]} />
        <meshStandardMaterial color={palette.dark} roughness={0.84} metalness={0.2} emissive={palette.mid} emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}><ringGeometry args={[district.ringScale * 0.32, district.ringScale * 0.72, 6]} /><meshStandardMaterial color={palette.ground} roughness={0.82} metalness={0.15} emissive={palette.dark} emissiveIntensity={0.03} side={THREE.DoubleSide} /></mesh>
      {blocks.map((b, i) => {
        const blockColor = b.tone === "light" ? palette.light : b.tone === "mid" ? palette.mid : palette.dark;
        const emissiveColor = b.tone === "light" ? palette.accent : palette.mid;
        return b.kind === "box" ? (
          <mesh key={i} position={b.p}><boxGeometry args={b.s} /><meshStandardMaterial color={blockColor} roughness={0.45} metalness={0.5} emissive={emissiveColor} emissiveIntensity={0.11} /></mesh>
        ) : b.kind === "cylinder" ? (
          <mesh key={i} position={b.p}><cylinderGeometry args={[b.s[0] / 2, b.s[0] / 2, b.s[1], 16]} /><meshStandardMaterial color={blockColor} roughness={0.44} metalness={0.56} emissive={emissiveColor} emissiveIntensity={0.12} /></mesh>
        ) : (
          <mesh key={i} position={b.p}><coneGeometry args={[b.s[0] / 2, b.s[1], 12]} /><meshStandardMaterial color={blockColor} roughness={0.38} metalness={0.6} emissive={palette.accent} emissiveIntensity={0.16} /></mesh>
        );
      })}
      {district.id === "ai" && <group><mesh position={[-0.82, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.05, 1.35]} /><meshBasicMaterial color={palette.accent} transparent opacity={0.22} /></mesh><mesh position={[0.82, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.05, 1.35]} /><meshBasicMaterial color={palette.accent} transparent opacity={0.22} /></mesh></group>}
      {district.id === "science" && <mesh position={[0.55, 0.23, -0.35]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.2, 0.018, 10, 28]} /><meshStandardMaterial color={palette.light} roughness={0.36} metalness={0.58} emissive={palette.accent} emissiveIntensity={0.08} /></mesh>}
      {district.id === "engineering" && <group><mesh position={[0, 0.15, 0.84]}><boxGeometry args={[1.15, 0.07, 0.11]} /><meshStandardMaterial color={palette.mid} roughness={0.45} metalness={0.45} emissive={palette.accent} emissiveIntensity={0.05} /></mesh><mesh position={[-0.4, 0.1, 0.84]} rotation={[0, 0, Math.PI / 7]}><boxGeometry args={[0.08, 0.46, 0.08]} /><meshStandardMaterial color={palette.dark} /></mesh><mesh position={[0.4, 0.1, 0.84]} rotation={[0, 0, -Math.PI / 7]}><boxGeometry args={[0.08, 0.46, 0.08]} /><meshStandardMaterial color={palette.dark} /></mesh></group>}
      {district.id === "design-humanities" && <mesh position={[0.22, 0.6, -0.2]} rotation={[0, 0, -0.34]}><boxGeometry args={[0.4, 0.08, 0.2]} /><meshStandardMaterial color={palette.light} /></mesh>}
      {district.id === "management" && <mesh position={[0, 0.33, 0]}><boxGeometry args={[0.34, 0.5, 0.34]} /><meshStandardMaterial color={palette.light} roughness={0.4} metalness={0.5} emissive={palette.accent} emissiveIntensity={0.05} /></mesh>}
    </group>
  );
}

function BuildingNode({ district, building, selected, dimmed, onSelect }: { district: District; building: Building; selected: boolean; dimmed: boolean; onSelect: (b: Building) => void }) {
  const [hovered, setHovered] = useState(false); const g = useRef<THREE.Group>(null);
  useFrame((state) => { if (!g.current) return; g.current.position.y = lerp(g.current.position.y, hovered || selected ? 0.12 : 0, 0.12); g.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5 + building.position[0]) * 0.03; });
  return <group ref={g} position={[district.position[0] + building.position[0], building.position[1], district.position[2] + building.position[2]]} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onClick={() => onSelect(building)}>
    <RoundedBox args={building.size} radius={0.08} smoothness={4}><meshStandardMaterial color="#0f172a" roughness={0.28} metalness={0.85} emissive={district.color} emissiveIntensity={selected ? 1.4 : hovered ? 0.95 : 0.35} transparent opacity={dimmed ? 0.22 : 1} /></RoundedBox>
    {(hovered || selected) && <Html position={[0, building.size[1] / 2 + 0.35, 0]} center distanceFactor={12} zIndexRange={[2, 0]} style={{ pointerEvents: "none" }}><div className="rounded-xl border border-white/15 bg-slate-950/85 px-3 py-2 text-center"><div className="text-xs font-semibold text-white">{building.name}</div><div className="mt-1 text-[11px] text-slate-300">{building.professor}</div></div></Html>}
  </group>;
}

function Scene({ focusedDistrict, setFocusedDistrict, selectedBuilding, setSelectedBuilding }: { focusedDistrict: District | null; setFocusedDistrict: (d: District | null) => void; selectedBuilding: Building | null; setSelectedBuilding: (b: Building | null) => void }) {
  const controlsRef = useRef<any>(null);

  return <>
    <color attach="background" args={["#030712"]} /><fog attach="fog" args={["#030712", 16, 30]} />
    <ambientLight intensity={0.9} /><directionalLight position={[10, 12, 6]} intensity={1.2} color="#93c5fd" /><pointLight position={[-8, 6, -4]} intensity={2.1} color="#60a5fa" /><pointLight position={[8, 5, 8]} intensity={1.6} color="#ef4444" />
    <CameraRig focusedDistrict={focusedDistrict} controlsRef={controlsRef} />
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}><circleGeometry args={[22, 64]} /><meshStandardMaterial color="#050816" roughness={1} metalness={0} /></mesh>
    <DistrictNetwork />
    {DISTRICTS.map((d) => <React.Fragment key={d.id}><MiniCity district={d} /><DistrictNode district={d} active={focusedDistrict?.id === d.id} dimmed={!!focusedDistrict && focusedDistrict.id !== d.id} onSelect={(x) => { setFocusedDistrict(x); setSelectedBuilding(null); }} /></React.Fragment>)}
    {focusedDistrict?.buildings.map((b) => <BuildingNode key={b.id} district={focusedDistrict} building={b} selected={selectedBuilding?.id === b.id} dimmed={!!selectedBuilding && selectedBuilding.id !== b.id} onSelect={setSelectedBuilding} />)}
    <OrbitControls ref={controlsRef} enablePan={false} enableRotate enableZoom={false} enableDamping dampingFactor={0.08} rotateSpeed={0.65} minPolarAngle={1.08} maxPolarAngle={1.08} />
    {focusedDistrict && (
      <Html position={[focusedDistrict.position[0], 3.8, focusedDistrict.position[2]]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
        <div className="rounded-xl border border-white/15 bg-slate-950/75 px-3 py-1.5 text-sm font-semibold text-slate-100 backdrop-blur-md">
          {focusedDistrict.name}
        </div>
      </Html>
    )}
  </>;
}

export default function ResearchDistrictsScene() {
  const [focusedDistrict, setFocusedDistrict] = useState<District | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const reset = () => {
    setFocusedDistrict(null);
    setSelectedBuilding(null);
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") reset();
    };

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <div className="relative flex h-[calc(100vh-112px)] w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#030712] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(239,68,68,0.10),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(139,92,246,0.10),transparent_30%)]" />

      <div className="relative isolate z-[200] flex shrink-0 items-start justify-between gap-6 border-b border-white/10 bg-[#030712]/92 p-6 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl rounded-3xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl"
        >
          <div className="text-[11px] uppercase tracking-[0.28em] text-sky-300">JitHub Research Explorer</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Research Districts</h1>
        </motion.div>

        <div className="relative z-[130] flex items-center gap-3">
          {focusedDistrict && (
            <motion.button
              type="button"
              onClick={reset}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-100 backdrop-blur-md"
            >
              Back to Research Districts
            </motion.button>
          )}

          <a
            href="/home"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="relative z-[999] rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-100 backdrop-blur-md transition-transform hover:scale-[1.04]"
            style={{ pointerEvents: "auto" }}
          >
            Go to JitHub Home
          </a>
        </div>
      </div>

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden">
        <Canvas
          camera={{ position: [0, 10, 16], fov: 48 }}
          dpr={[1, 1.75]}
          onPointerMissed={() => (selectedBuilding ? setSelectedBuilding(null) : focusedDistrict ? setFocusedDistrict(null) : null)}
        >
          <Suspense fallback={null}>
            <Scene
              focusedDistrict={focusedDistrict}
              setFocusedDistrict={setFocusedDistrict}
              selectedBuilding={selectedBuilding}
              setSelectedBuilding={setSelectedBuilding}
            />
          </Suspense>
        </Canvas>
      </div>

      <AnimatePresence>
        {focusedDistrict && selectedBuilding && (
          <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            className="absolute right-0 top-0 z-30 h-full w-full max-w-md border-l border-white/10 bg-slate-950/88 p-6"
          >
            <h2 className="text-xl font-semibold text-white">{selectedBuilding.name}</h2>
            <div className="mt-2 text-sm text-slate-300">{selectedBuilding.professor}</div>
            <button
              onClick={() => setSelectedBuilding(null)}
              className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
            >
              Close
            </button>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
