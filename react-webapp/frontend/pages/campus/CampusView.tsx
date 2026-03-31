import { Canvas } from "@react-three/fiber"
import { OrbitControls, ContactShadows, Environment, Html } from "@react-three/drei"
import { Suspense, useState, useCallback } from "react"
import CampusModel from "./components/CampusModel"
import HotspotMarker from "./components/HotspotMarker"
import BuildingPopup from "./components/BuildingPopup"
import { HOTSPOTS } from "./data/hotspots"
import type { Hotspot } from "./data/hotspots"

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#D32F2F] border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 text-sm">Loading NJIT Campus...</p>
      </div>
    </Html>
  )
}

export default function CampusView() {
  const [selectedBuilding, setSelectedBuilding] = useState<Hotspot | null>(null)

  const handleSelect = useCallback((hotspot: Hotspot) => {
    setSelectedBuilding((prev) => prev?.id === hotspot.id ? null : hotspot)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedBuilding(null)
  }, [])

  return (
    <div className="relative w-full h-screen bg-[#0f1117]">
      {/* Title overlay */}
      <div className="absolute top-4 left-4 z-40 pointer-events-none">
        <h1 className="text-xl font-bold text-white drop-shadow-lg">
          NJIT <span className="text-[#FF5252]">Campus</span>
        </h1>
        <p className="text-xs text-white/40 mt-1">
          Click a building marker to explore
        </p>
      </div>

      {/* Building count */}
      <div className="absolute top-4 right-4 z-40 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
        <span className="text-xs text-white/70">
          <span className="text-[#FF5252] font-bold">{HOTSPOTS.length}</span> buildings
        </span>
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [25, 20, 25], fov: 45 }}
        onPointerMissed={() => setSelectedBuilding(null)}
      >
        <color attach="background" args={["#0f1117"]} />

        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[15, 25, 15]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={80}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <directionalLight position={[-10, 10, -10]} intensity={0.3} />

        {/* Environment map for realistic reflections */}
        <Environment preset="city" />

        <Suspense fallback={<LoadingFallback />}>
          {/* Campus GLB model */}
          <CampusModel />

          {/* Building hotspot markers */}
          {HOTSPOTS.map((hotspot) => (
            <HotspotMarker
              key={hotspot.id}
              hotspot={hotspot}
              isSelected={selectedBuilding?.id === hotspot.id}
              onSelect={handleSelect}
            />
          ))}
        </Suspense>

        {/* Shadow plane under the floating model */}
        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.6}
          scale={60}
          blur={2.5}
          far={20}
          color="#000000"
        />

        {/* Camera controls — restricted to prevent looking under the map */}
        <OrbitControls
          makeDefault
          enablePan={false}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 8}
          minDistance={10}
          maxDistance={50}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>

      {/* Building popup overlay */}
      <BuildingPopup building={selectedBuilding} onClose={handleClose} />
    </div>
  )
}
