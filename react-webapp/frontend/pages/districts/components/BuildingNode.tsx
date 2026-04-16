import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { District, Lab } from "../data/districts"

interface Props {
  lab: Lab
  district: District
  isDimmed: boolean
  isSelected: boolean
  onSelect: (lab: Lab) => void
  x: number
  y: number
  index: number
}

function getWindows(floor: number, seed: number) {
  const rows = floor + 1
  const cols = 4
  return Array.from({ length: rows * cols }, (_, index) => ((index * 11 + seed * 5) % 9) > 2)
}

export default function BuildingNode({
  lab,
  district,
  isDimmed,
  isSelected,
  onSelect,
  x,
  y,
  index,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const width = 54 + lab.floor * 6
  const height = 58 + lab.floor * 14
  const windows = getWindows(lab.floor, index)
  const hardest =
    lab.opportunities.find((item) => item.difficulty === "Advanced")?.difficulty ??
    lab.opportunities.find((item) => item.difficulty === "Intermediate")?.difficulty ??
    "Beginner"

  return (
    <motion.button
      className="rd-building"
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        ["--b-color-main" as string]: district.color,
        ["--b-color-top" as string]: "#F8F6F2",
        ["--b-color-mid" as string]: "#E8E1D8",
        ["--b-color-bot" as string]: district.color,
        ["--b-border" as string]: "rgba(114, 92, 74, 0.22)",
        ["--b-spire" as string]: district.color,
        ["--b-glow" as string]: district.glowColor,
        ["--b-window-lit" as string]: `rgba(${district.accentRgb}, 0.30)`,
      }}
      onClick={() => onSelect(lab)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{
        opacity: isDimmed ? 0.22 : 1,
        y: 0,
        scale: isSelected ? 1.08 : hovered ? 1.03 : 1,
      }}
      exit={{ opacity: 0, y: 12, scale: 0.9 }}
      transition={{
        opacity: { duration: 0.25, delay: index * 0.04 },
        y: { duration: 0.35, delay: index * 0.04 },
        scale: { type: "spring", stiffness: 280, damping: 24 },
      }}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            className="rd-building-tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
          >
            {lab.name}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rd-building-platform">
        <div className="rd-building-platform-top" />
        <div className="rd-building-platform-glow" />
      </div>

      <div className="rd-building-tower" style={{ height: height + 28 }}>
        <div className="rd-building-body rd-building-body-main" style={{ width, height }}>
          <div
            className="rd-building-windows"
            style={{
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: `repeat(${lab.floor + 1}, 8px)`,
            }}
          >
            {windows.map((lit, windowIndex) => (
              <div
                key={windowIndex}
                className={`rd-building-window${lit ? " lit" : ""}`}
              />
            ))}
          </div>
          <div className="rd-building-roof" />
        </div>
        <div className="rd-building-wing" />
      </div>

      <div
        className="rd-building-label"
        style={{
          color: isSelected || hovered ? "#7A4A34" : undefined,
          borderColor: isSelected ? `${district.color}40` : undefined,
        }}
      >
        {lab.name.length > 26 ? `${lab.name.slice(0, 24)}...` : lab.name}
      </div>

      <div className="rd-building-badge">
        <span className="rd-building-pill">{hardest}</span>
        <span className="rd-building-pill muted">{lab.opportunities.length} roles</span>
      </div>
    </motion.button>
  )
}
