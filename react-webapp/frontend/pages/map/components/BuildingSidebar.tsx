import { X, Building2, Layers, Users } from "lucide-react"
import type { Building } from "../types"

interface BuildingSidebarProps {
  readonly building: Building | null
  readonly onClose: () => void
}

export default function BuildingSidebar({ building, onClose }: BuildingSidebarProps) {
  return (
    <div
      className={`
        fixed top-0 right-0 h-full w-[400px] z-50
        transition-transform duration-500 ease-out
        ${building ? "translate-x-0" : "translate-x-full"}
      `}
    >
      {/* Glassmorphism panel */}
      <div className="h-full flex flex-col bg-black/60 backdrop-blur-xl border-l border-white/10">
        {/* Header — NJIT Red accent bar */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#D32F2F] to-[#FF5252]" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>

          {building && (
            <>
              <span className="inline-block px-3 py-1 mb-3 text-xs font-bold tracking-wider uppercase rounded-full bg-[#D32F2F]/20 text-[#FF5252] border border-[#D32F2F]/30">
                {building.abbreviation}
              </span>
              <h2 className="text-2xl font-bold text-white leading-tight">
                {building.name}
              </h2>
            </>
          )}
        </div>

        {/* Content */}
        {building && (
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
            {/* Description */}
            <p className="text-white/70 text-sm leading-relaxed">
              {building.description}
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Building2 className="w-4 h-4" />}
                label="Floors"
                value={String(building.floors)}
              />
              <StatCard
                icon={<Layers className="w-4 h-4" />}
                label="Departments"
                value={String(building.departments.length)}
              />
            </div>

            {/* Departments list */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90 mb-3">
                <Users className="w-4 h-4 text-[#FF5252]" />
                Departments & Programs
              </h3>
              <div className="space-y-2">
                {building.departments.map((dept) => (
                  <div
                    key={dept}
                    className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/5 text-white/80 text-sm hover:bg-white/10 transition-colors"
                  >
                    {dept}
                  </div>
                ))}
              </div>
            </div>

            {/* Coordinates */}
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-white/40 font-mono">
                {building.latitude.toFixed(4)}°N, {Math.abs(building.longitude).toFixed(4)}°W
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  readonly icon: React.ReactNode
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
      <div className="flex items-center gap-2 text-[#FF5252] mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider text-white/50">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}
