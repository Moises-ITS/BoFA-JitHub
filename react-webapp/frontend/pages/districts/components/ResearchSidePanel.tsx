// ─────────────────────────────────────────────────────────────────────────────
// components/ResearchSidePanel.tsx
// Right-side slide panel showing lab opportunities
// ─────────────────────────────────────────────────────────────────────────────
import { motion, AnimatePresence } from "motion/react"
import type { Lab, District } from "../data/districts"
import { DIFFICULTY_COLORS } from "../data/districts"

interface Props {
  lab: Lab | null
  district: District | null
  onClose: () => void
  onFullList?: () => void
}

const CLOCK_ICON = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
)
const USERS_ICON = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
)
const ARROW_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
)
const X_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
)

export default function ResearchSidePanel({ lab, district, onClose, onFullList }: Props) {
  return (
    <AnimatePresence>
      {lab && district && (
        <>
          {/* Scrim */}
          <motion.div
            className="rd-panel-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="rd-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              ["--p-color"    as string]: district.color,
              ["--p-border"   as string]: `${district.color}35`,
              ["--p-chip-bg"  as string]: `${district.color}15`,
              ["--p-btn-bg"   as string]: `${district.color}18`,
            }}
          >
            {/* Top accent bar */}
            <div className="rd-panel-accent" />

            {/* Header */}
            <div className="rd-panel-header">
              <div className="rd-panel-meta">
                <div>
                  <div className="rd-panel-lab-name">{lab.name}</div>
                  <div className="rd-panel-pi">
                    Supervised by <strong>{lab.pi}</strong>
                  </div>
                </div>
                <button className="rd-panel-close" onClick={onClose} aria-label="Close panel">
                  {X_ICON}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="rd-panel-district-chip"
                  style={{
                    ["--p-color"  as string]: district.color,
                    ["--p-border" as string]: `${district.color}35`,
                  }}
                >
                  {district.icon}&nbsp;{district.name}
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
                  {lab.opportunities.length} open position{lab.opportunities.length !== 1 ? "s" : ""}
                </span>
              </div>

              {onFullList && (
                <button className="rd-panel-link" onClick={onFullList}>
                  Go to full list
                </button>
              )}
            </div>

            {/* Section label */}
            <div className="rd-panel-section-title">Research Opportunities</div>

            {/* Opportunities list */}
            <div className="rd-panel-body">
              {lab.opportunities.map((opp, i) => {
                const diffColor = DIFFICULTY_COLORS[opp.difficulty as keyof typeof DIFFICULTY_COLORS]
                return (
                  <motion.div
                    key={opp.id}
                    className="rd-opp-card"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <div className="rd-opp-card-accent" />
                    <div className="rd-opp-card-body">
                      <div className="rd-opp-header">
                        <div className="rd-opp-title">{opp.title}</div>
                        <span
                          className="rd-opp-diff"
                          style={{
                            ["--diff-color"  as string]: diffColor,
                            ["--diff-border" as string]: `${diffColor}40`,
                            ["--diff-bg"     as string]: `${diffColor}15`,
                          }}
                        >
                          {opp.difficulty}
                        </span>
                      </div>

                      <p className="rd-opp-desc">{opp.description}</p>

                      <div className="rd-opp-tags">
                        {opp.skills.map(s => (
                          <span key={s} className="rd-opp-tag">{s}</span>
                        ))}
                      </div>

                      <div className="rd-opp-footer">
                        <div className="rd-opp-meta">
                          <span className="rd-opp-meta-item">
                            {CLOCK_ICON} {opp.commitment}
                          </span>
                          <span className="rd-opp-meta-item">
                            {USERS_ICON} {opp.spots} spot{opp.spots !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <button
                          className="rd-apply-btn"
                          onClick={e => e.stopPropagation()}
                        >
                          Apply {ARROW_ICON}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
