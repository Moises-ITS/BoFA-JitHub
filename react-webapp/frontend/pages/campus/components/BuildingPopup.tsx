import { X, Building2, Users } from "lucide-react"
import type { Hotspot } from "../data/hotspots"

interface BuildingPopupProps {
  readonly building: Hotspot | null
  readonly onClose: () => void
}

export default function BuildingPopup({ building, onClose }: BuildingPopupProps) {
  if (!building) return null

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
        {/* Red accent bar */}
        <div className="h-1 bg-gradient-to-r from-[#D32F2F] to-[#FF5252]" />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="inline-block px-2.5 py-0.5 mb-2 text-[10px] font-bold tracking-widest uppercase rounded-full bg-[#D32F2F]/20 text-[#FF5252] border border-[#D32F2F]/30">
                {building.abbreviation}
              </span>
              <h3 className="text-lg font-bold text-white leading-tight">
                {building.name}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="Close popup"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Description */}
          <p className="text-white/60 text-sm leading-relaxed mb-4">
            {building.description}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-white/50 text-xs">
              <Building2 className="w-3.5 h-3.5 text-[#FF5252]" />
              <span>{building.departments.length} departments</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/50 text-xs">
              <Users className="w-3.5 h-3.5 text-[#FF5252]" />
              <span>NJIT Campus</span>
            </div>
          </div>

          {/* Department tags */}
          <div className="flex flex-wrap gap-1.5">
            {building.departments.map((dept) => (
              <span
                key={dept}
                className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-white/70 text-xs"
              >
                {dept}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
