import { Html } from "@react-three/drei"
import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { Hotspot } from "../data/hotspots"

interface HotspotMarkerProps {
  readonly hotspot: Hotspot
  readonly isSelected: boolean
  readonly onSelect: (hotspot: Hotspot) => void
}

export default function HotspotMarker({ hotspot, isSelected, onSelect }: HotspotMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  // Gentle floating animation
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const base = hotspot.position[1]
    meshRef.current.position.y = base + Math.sin(clock.elapsedTime * 2 + hotspot.position[0]) * 0.15
  })

  const scale = isSelected ? 1.4 : hovered ? 1.2 : 1

  return (
    <group position={[hotspot.position[0], 0, hotspot.position[2]]}>
      {/* Clickable marker sphere */}
      <mesh
        ref={meshRef}
        position={[0, hotspot.position[1], 0]}
        scale={scale}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(hotspot)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = "default"
        }}
      >
        <sphereGeometry args={[0.4, 24, 24]} />
        <meshStandardMaterial
          color={isSelected ? "#FF5252" : "#D32F2F"}
          emissive={isSelected ? "#FF5252" : hovered ? "#D32F2F" : "#000"}
          emissiveIntensity={isSelected ? 0.8 : hovered ? 0.4 : 0}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {/* Pulsing ring under the marker */}
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.8, 32]} />
          <meshBasicMaterial color="#FF5252" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Abbreviation label */}
      <Html
        position={[0, hotspot.position[1] + 1.2, 0]}
        center
        distanceFactor={15}
        occlude={false}
      >
        <div
          className={`
            px-2 py-0.5 rounded text-[10px] font-bold tracking-wider whitespace-nowrap
            pointer-events-none select-none transition-all duration-200
            ${isSelected
              ? "bg-[#D32F2F] text-white shadow-lg shadow-red-500/30"
              : "bg-black/70 text-white/80 backdrop-blur-sm"
            }
          `}
        >
          {hotspot.abbreviation}
        </div>
      </Html>
    </group>
  )
}
