import { motion, AnimatePresence } from "motion/react"
import { X, ArrowRight } from "lucide-react"
import type { District } from "../data/districts"
import { DIFFICULTY_COLORS } from "../data/districts"

interface DistrictDetailViewProps {
  readonly district: District | null
  readonly onClose: () => void
}

export default function DistrictDetailView({ district, onClose }: DistrictDetailViewProps) {
  return (
    <AnimatePresence>
      {district && (
        <>
          {/* Scrim */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="mx-auto max-w-4xl rounded-t-3xl bg-[#13151c]/95 backdrop-blur-xl border border-white/10 border-b-0 overflow-hidden">
              {/* Accent bar */}
              <div
                className="h-1 w-full"
                style={{ background: `linear-gradient(90deg, ${district.color}, ${district.color}60)` }}
              />

              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between px-8 pt-3 pb-4">
                <div className="flex items-center gap-4">
                  <span className="text-5xl select-none">{district.icon}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{district.name}</h2>
                    <p className="text-sm text-white/50 mt-1 max-w-lg leading-relaxed">
                      {district.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0"
                  aria-label="Close detail view"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {/* Opportunities */}
              <div className="px-8 pb-8 overflow-y-auto max-h-[55vh]">
                <h3
                  className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: district.color }}
                >
                  Research Opportunities ({district.opportunities.length})
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {district.opportunities.map((opp, index) => (
                    <motion.div
                      key={opp.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.07, duration: 0.35 }}
                      className="group/card relative rounded-2xl border bg-white/[0.03] hover:bg-white/[0.06] transition-colors overflow-hidden"
                      style={{ borderColor: `${district.color}15` }}
                    >
                      {/* Card accent */}
                      <div
                        className="absolute top-0 left-0 w-1 h-full rounded-r"
                        style={{ background: district.color }}
                      />

                      <div className="p-5 pl-6">
                        {/* Difficulty badge */}
                        <span
                          className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-3 border"
                          style={{
                            color: DIFFICULTY_COLORS[opp.difficulty],
                            borderColor: `${DIFFICULTY_COLORS[opp.difficulty]}40`,
                            background: `${DIFFICULTY_COLORS[opp.difficulty]}15`,
                          }}
                        >
                          {opp.difficulty}
                        </span>

                        <h4 className="text-sm font-semibold text-white/90 mb-2 leading-snug">
                          {opp.title}
                        </h4>

                        <p className="text-xs text-white/45 leading-relaxed mb-4">
                          {opp.description}
                        </p>

                        <button
                          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-200 hover:gap-2.5"
                          style={{
                            color: district.color,
                            background: `${district.color}15`,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Apply
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
