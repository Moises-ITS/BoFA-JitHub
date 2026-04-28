import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber"
import { OrbitControls, useGLTF, Grid, Html } from "@react-three/drei"
import { Suspense, useState, useEffect, useRef } from "react"
import * as THREE from "three"

/**
 * GLB Inspector — drop your campus.glb into /public/models/ then visit /inspect.
 *
 * How to use:
 * 1. Place campus.glb in react-webapp/frontend/public/models/cadmapper-newark-new-jersey-us.glb
 * 2. Run the dev server and visit http://localhost:5175/inspect
 * 3. Click anywhere on the model — the x/y/z coordinates print on-screen
 *    AND in the browser console as a JSON object you can copy.
 * 4. Screenshot the page or copy the console output and share it with Claude.
 */

interface ClickPoint {
  id: number
  position: [number, number, number]
}

function InspectedModel({ onPointClick }: { readonly onPointClick: (p: [number, number, number]) => void }) {
  const { scene } = useGLTF("/models/cadmapper-newark-new-jersey-us.glb")
  const groupRef = useRef<THREE.Group>(null)
  const [info, setInfo] = useState<string>("")

  useEffect(() => {
    if (!groupRef.current) return
    const box = new THREE.Box3().setFromObject(groupRef.current)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const summary = [
      `Bounding Box Size: x=${size.x.toFixed(2)}, y=${size.y.toFixed(2)}, z=${size.z.toFixed(2)}`,
      `Center: x=${center.x.toFixed(2)}, y=${center.y.toFixed(2)}, z=${center.z.toFixed(2)}`,
      `Min: x=${box.min.x.toFixed(2)}, y=${box.min.y.toFixed(2)}, z=${box.min.z.toFixed(2)}`,
      `Max: x=${box.max.x.toFixed(2)}, y=${box.max.y.toFixed(2)}, z=${box.max.z.toFixed(2)}`,
    ].join("\n")
    setInfo(summary)
    console.log("=== GLB Model Info ===")
    console.log(summary)
    console.log("Children:", scene.children.map(c => `${c.name} (${c.type})`))
  }, [scene])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const point: [number, number, number] = [
      parseFloat(e.point.x.toFixed(3)),
      parseFloat(e.point.y.toFixed(3)),
      parseFloat(e.point.z.toFixed(3)),
    ]
    console.log("Clicked point:", JSON.stringify({ x: point[0], y: point[1], z: point[2] }))
    onPointClick(point)
  }

  return (
    <>
      <group ref={groupRef}>
        <primitive object={scene} onClick={handleClick} />
      </group>
      {info && (
        <Html position={[0, 5, 0]} center>
          <pre className="bg-black/80 text-green-400 text-xs p-3 rounded-lg whitespace-pre font-mono pointer-events-none">
            {info}
          </pre>
        </Html>
      )}
    </>
  )
}

function ClickMarkers({ points }: { readonly points: readonly ClickPoint[] }) {
  return (
    <>
      {points.map((p) => (
        <group key={p.id} position={p.position}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#FF5252" emissive="#FF5252" emissiveIntensity={0.5} />
          </mesh>
          <Html center distanceFactor={20}>
            <div className="bg-black/90 text-white text-[10px] px-2 py-1 rounded font-mono whitespace-nowrap pointer-events-none">
              #{p.id} [{p.position.join(", ")}]
            </div>
          </Html>
        </group>
      ))}
    </>
  )
}

function SceneInfo() {
  const { camera } = useThree()

  useEffect(() => {
    const interval = setInterval(() => {
      const pos = camera.position
      console.log(`Camera: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}, z=${pos.z.toFixed(2)}`)
    }, 5000)
    return () => clearInterval(interval)
  }, [camera])

  return null
}

export default function GlbInspector() {
  const [points, setPoints] = useState<readonly ClickPoint[]>([])

  const handlePointClick = (position: [number, number, number]) => {
    const newPoint: ClickPoint = { id: points.length + 1, position }
    setPoints((prev) => [...prev, newPoint])
  }

  const copyAllPoints = () => {
    const data = points.map((p) => ({
      id: p.id,
      x: p.position[0],
      y: p.position[1],
      z: p.position[2],
      label: `Building ${p.id}`,
    }))
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }

  return (
    <div className="relative w-full h-screen bg-[#0f1117]">
      {/* Instructions panel */}
      <div className="absolute top-4 left-4 z-50 bg-black/80 backdrop-blur-sm border border-white/10 rounded-xl p-4 max-w-xs">
        <h2 className="text-white font-bold text-sm mb-2">GLB Inspector</h2>
        <ul className="text-white/60 text-xs space-y-1">
          <li>Click on the model to place coordinate markers</li>
          <li>Coordinates log to the console (F12)</li>
          <li>Camera position logs every 5 seconds</li>
          <li>Screenshot this page or copy points to share</li>
        </ul>
        {points.length > 0 && (
          <button
            onClick={copyAllPoints}
            className="mt-3 w-full px-3 py-1.5 bg-[#D32F2F] hover:bg-[#FF5252] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Copy {points.length} point(s) to clipboard
          </button>
        )}
      </div>

      {/* Points list */}
      {points.length > 0 && (
        <div className="absolute bottom-4 left-4 z-50 bg-black/80 backdrop-blur-sm border border-white/10 rounded-xl p-3 max-w-xs max-h-48 overflow-y-auto">
          <h3 className="text-white/80 text-xs font-semibold mb-2">Clicked Points</h3>
          {points.map((p) => (
            <div key={p.id} className="text-green-400 text-[10px] font-mono">
              #{p.id}: [{p.position.join(", ")}]
            </div>
          ))}
        </div>
      )}

      <Canvas camera={{ position: [30, 30, 30], fov: 50 }} shadows>
        <color attach="background" args={["#0f1117"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <Suspense fallback={
          <Html center>
            <div className="text-white text-sm">Loading GLB model...</div>
          </Html>
        }>
          <InspectedModel onPointClick={handlePointClick} />
          <ClickMarkers points={points} />
        </Suspense>
        <Grid
          args={[100, 100]}
          position={[0, -0.01, 0]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#333"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#555"
          fadeDistance={50}
          infiniteGrid
        />
        <OrbitControls makeDefault />
        <SceneInfo />
      </Canvas>
    </div>
  )
}
