import { motion } from "motion/react"
import type { District } from "../data/districts"

interface DistrictCardProps {
  readonly district: District
  readonly isSelected: boolean
  readonly onSelect: (district: District) => void
}

export default function DistrictCard({ district, isSelected, onSelect }: DistrictCardProps) {
  return (
    <motion.button
      onClick={() => onSelect(district)}
      className="absolute cursor-pointer outline-none group"
      style={{
        left: `calc(50% + ${district.position.x}%)`,
        top: `calc(50% + ${district.position.y}%)`,
        width: district.size.w,
        height: district.size.h,
        transform: `translate(-50%, -50%) rotate(${district.rotation}deg)`,
      }}
      whileHover={{
        y: -10,
        scale: 1.08,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      }}
      whileTap={{ scale: 0.97 }}
      animate={isSelected ? { scale: 1.1, y: -12 } : { scale: 1, y: 0 }}
    >
      {/* Glow layer */}
      <div
        className="absolute inset-0 rounded-[20px_32px_24px_36px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{ background: district.glowColor }}
      />

      {/* Main card body */}
      <div
        className="relative h-full rounded-[20px_32px_24px_36px] border overflow-hidden transition-shadow duration-300 group-hover:shadow-2xl"
        style={{
          background: `radial-gradient(ellipse at 30% 25%, ${district.color}20, ${district.color}08 60%, transparent)`,
          borderColor: `${district.color}30`,
          boxShadow: `0 0 30px ${district.color}10, 0 8px 32px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Accent line at top */}
        <div
          className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${district.color}80, transparent)` }}
        />

        {/* Inner content */}
        <div className="relative flex flex-col items-center justify-center h-full px-4 py-6 text-center gap-2">
          {/* Icon */}
          <span className="text-4xl drop-shadow-lg select-none">{district.icon}</span>

          {/* Name */}
          <h3 className="text-sm font-bold text-white/90 leading-tight tracking-wide">
            {district.name}
          </h3>

          {/* Opportunity count */}
          <span
            className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full border"
            style={{
              color: district.color,
              borderColor: `${district.color}40`,
              background: `${district.color}15`,
            }}
          >
            {district.opportunities.length} projects
          </span>
        </div>

        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(${district.color}40 1px, transparent 1px), linear-gradient(90deg, ${district.color}40 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Bottom glow bar */}
        <div
          className="absolute bottom-0 left-[15%] right-[15%] h-[1px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `linear-gradient(90deg, transparent, ${district.color}, transparent)` }}
        />
      </div>
    </motion.button>
  )
}
