import { useGLTF } from "@react-three/drei"
import { useRef, useEffect } from "react"
import * as THREE from "three"

export default function CampusModel() {
  const { scene } = useGLTF("/models/cadmapper-newark-new-jersey-us.glb")
  const groupRef = useRef<THREE.Group>(null)

  // Center the model at origin on load
  useEffect(() => {
    if (!groupRef.current) return
    const box = new THREE.Box3().setFromObject(groupRef.current)
    const center = box.getCenter(new THREE.Vector3())
    groupRef.current.position.set(-center.x, -box.min.y, -center.z)
  }, [scene])

  return (
    <group ref={groupRef}>
      <primitive object={scene} castShadow receiveShadow />
    </group>
  )
}

// Preload the model so it starts fetching before the component mounts
useGLTF.preload("/models/cadmapper-newark-new-jersey-us.glb")
