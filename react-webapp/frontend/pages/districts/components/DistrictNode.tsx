import { useState } from "react"
import { motion } from "motion/react"
import type { District } from "../data/districts"

interface Props {
  district: District
  isSelected: boolean
  isDimmed: boolean
  onSelect: (district: District) => void
  onCta: (district: District) => void
  x: number
  y: number
  size: number
}

const STRUCTURE_STYLE_BY_DISTRICT: Record<string, string> = {
  "computer-science": "crystal",
  "data-science": "tower",
  "informatics": "holo",
  "electrical-computer-engineering": "industrial",
  "chemical-materials-engineering": "lab",
  "civil-environmental-engineering": "campus",
  "mechanical-industrial-engineering": "factory",
  "biomedical-engineering": "biodome",
  "physics": "observatory",
  "mathematical-sciences": "spire",
  "chemistry-environmental-science": "reactor",
  "biological-science": "greenhouse",
  "architecture-design": "atrium",
  "humanities-social-sciences": "library",
  "management": "highrise",
  "applied-engineering-technology": "workshop",
}

export default function DistrictNode({
  district,
  isSelected,
  isDimmed,
  onSelect,
  onCta,
  x,
  y,
  size,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const totalOpportunities = district.labs.reduce((total, lab) => total + lab.opportunities.length, 0)
  const structureStyle = STRUCTURE_STYLE_BY_DISTRICT[district.id] ?? "campus"

  return (
    <motion.button
      className={`rd-district${isSelected ? " is-selected" : ""}${isDimmed ? " is-dimmed" : ""}`}
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        ["--d-color-a" as string]: `${district.color}24`,
        ["--d-color-b" as string]: `${district.color}10`,
        ["--d-color-main" as string]: district.color,
        ["--d-border" as string]: `${district.color}4A`,
        ["--d-count-bg" as string]: `${district.color}12`,
        ["--d-glow" as string]: district.glowColor,
        ["--d-glow-full" as string]: district.glowColor,
      }}
      onClick={() => onSelect(district)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={{
        opacity: isDimmed ? 0.28 : 1,
        scale: isSelected ? 1.06 : 1,
        y: isSelected ? -6 : 0,
      }}
      whileHover={!isSelected ? { scale: 1.03, y: -4 } : {}}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      <div className="rd-district-pulse" />
      <motion.div
        className="rd-district-glow"
        animate={{ opacity: hovered || isSelected ? 1 : 0 }}
        transition={{ duration: 0.25 }}
      />

      <div className="rd-district-zone" style={{ width: size, height: size * 0.84 }}>
        <div className="rd-district-plaza" />
        <div className={`rd-district-structure rd-structure-${structureStyle}`} aria-hidden>
          <div className="rd-structure-core" />
          <div className="rd-structure-wing rd-structure-wing-a" />
          <div className="rd-structure-wing rd-structure-wing-b" />
          <div className="rd-structure-detail" />
        </div>
        <div className="rd-district-content">
          <span className="rd-district-icon">{district.icon}</span>
          <span className="rd-district-name">{district.name}</span>
          <span className="rd-district-count">
            {district.labs.length} labs | {totalOpportunities} roles
          </span>
          <div
            className="rd-district-cta"
            onClick={(event) => {
              event.stopPropagation()
              onCta(district)
            }}
          >
            {district.ctaLabel}
          </div>
        </div>

        <div className="rd-district-holo" aria-hidden>
          <div className="rd-district-holo-chip">
            <span>District</span>
            <strong>{district.icon}</strong>
          </div>
          <div className="rd-district-holo-chip">
            <span>Labs</span>
            <strong>{district.labs.length}</strong>
          </div>
          <div className="rd-district-holo-chip">
            <span>Open</span>
            <strong>{totalOpportunities}</strong>
          </div>
        </div>
      </div>
    </motion.button>
  )
}
