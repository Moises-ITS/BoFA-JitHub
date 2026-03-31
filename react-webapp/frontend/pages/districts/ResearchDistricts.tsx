import { useState, useCallback } from "react"
import { motion } from "motion/react"
import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import DistrictCard from "./components/DistrictCard"
import DistrictDetailView from "./components/DistrictDetailView"
import { DISTRICTS } from "./data/districts"
import type { District } from "./data/districts"

export default function ResearchDistricts() {
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null)
  const navigate = useNavigate()

  const handleSelect = useCallback((district: District) => {
    setSelectedDistrict(district)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedDistrict(null)
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0b10]">
      {/* Ambient background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,_rgba(99,102,241,0.08)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,_rgba(236,72,153,0.05)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,_rgba(16,185,129,0.05)_0%,_transparent_50%)]" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-6 pt-5 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button
            onClick={() => navigate("/home")}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors backdrop-blur-sm"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Research <span className="text-[#8B5CF6]">Districts</span>
            </h1>
            <p className="text-[11px] text-white/35 mt-0.5">
              Explore neighborhoods of knowledge
            </p>
          </div>
        </div>

        <div className="pointer-events-auto px-3.5 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
          <span className="text-xs text-white/60">
            <span className="text-[#8B5CF6] font-bold">{DISTRICTS.length}</span> districts
          </span>
        </div>
      </div>

      {/* 2.5D Perspective Canvas */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "1200px", perspectiveOrigin: "50% 42%" }}
      >
        <motion.div
          className="relative"
          style={{
            width: "90vw",
            height: "80vh",
            transformStyle: "preserve-3d",
          }}
          initial={{ rotateX: 20, opacity: 0 }}
          animate={{ rotateX: 14, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          {/* Connection lines between districts (SVG) */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
              </linearGradient>
            </defs>
            {/* AI → Physics */}
            <line x1="22" y1="28" x2="54" y2="18" stroke="url(#line-grad)" strokeWidth="0.15" />
            {/* AI → Engineering */}
            <line x1="22" y1="28" x2="18" y2="68" stroke="url(#line-grad)" strokeWidth="0.15" />
            {/* Bio → Finance */}
            <line x1="76" y1="32" x2="78" y2="64" stroke="url(#line-grad)" strokeWidth="0.15" />
            {/* Physics → Bio */}
            <line x1="54" y1="18" x2="76" y2="32" stroke="url(#line-grad)" strokeWidth="0.15" />
            {/* Engineering → Materials */}
            <line x1="18" y1="68" x2="46" y2="82" stroke="url(#line-grad)" strokeWidth="0.15" />
            {/* Materials → Finance */}
            <line x1="46" y1="82" x2="78" y2="64" stroke="url(#line-grad)" strokeWidth="0.15" />
          </svg>

          {/* District cards */}
          {DISTRICTS.map((district) => (
            <DistrictCard
              key={district.id}
              district={district}
              isSelected={selectedDistrict?.id === district.id}
              onSelect={handleSelect}
            />
          ))}
        </motion.div>
      </div>

      {/* Detail overlay */}
      <DistrictDetailView district={selectedDistrict} onClose={handleClose} />
    </div>
  )
}
