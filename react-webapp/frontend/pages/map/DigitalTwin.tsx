import { useState, useCallback } from "react"
import MapContainer from "./components/MapContainer"
import BuildingSidebar from "./components/BuildingSidebar"
import { useBuildings } from "./hooks/useBuildings"
import type { Building } from "./types"

export default function DigitalTwin() {
  const { buildings, loading, error } = useBuildings()
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)

  const handleSelectBuilding = useCallback((building: Building | null) => {
    setSelectedBuilding(building)
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setSelectedBuilding(null)
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f1117] text-red-400">
        <div className="text-center">
          <p className="text-lg font-semibold">Failed to load campus data</p>
          <p className="text-sm text-white/50 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f1117]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#D32F2F] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white/50 mt-4 text-sm">Loading NJIT Digital Twin...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0f1117]">
      {/* Title overlay */}
      <div className="absolute top-4 left-4 z-40 pointer-events-none">
        <h1 className="text-xl font-bold text-white drop-shadow-lg">
          NJIT <span className="text-[#FF5252]">Digital Twin</span>
        </h1>
        <p className="text-xs text-white/50 mt-1">
          Click a building marker to explore
        </p>
      </div>

      {/* Building count badge */}
      <div className="absolute top-4 right-4 z-40 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
        <span className="text-xs text-white/70">
          <span className="text-[#FF5252] font-bold">{buildings.length}</span> buildings mapped
        </span>
      </div>

      {/* 3D Map */}
      <MapContainer
        buildings={buildings}
        selectedBuilding={selectedBuilding}
        onSelectBuilding={handleSelectBuilding}
      />

      {/* Sidebar overlay */}
      <BuildingSidebar
        building={selectedBuilding}
        onClose={handleCloseSidebar}
      />
    </div>
  )
}
