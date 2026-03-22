import { motion } from "motion/react";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const times = ["8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm"];

// Mock data for event density by day/time
const heatmapData = [
  [0, 1, 2, 3, 1, 0, 0], // Mon
  [1, 2, 4, 3, 2, 1, 0], // Tue
  [0, 3, 5, 6, 4, 2, 1], // Wed
  [2, 2, 3, 4, 5, 3, 1], // Thu
  [1, 1, 2, 2, 3, 4, 2], // Fri
  [0, 0, 1, 1, 2, 3, 1], // Sat
  [0, 0, 0, 1, 1, 2, 0], // Sun
];

export function HeatmapCalendar() {
  const getColor = (value: number) => {
    if (value === 0) return "rgba(255,255,255,0.05)";
    if (value === 1) return "rgba(215,25,32,0.18)";
    if (value === 2) return "rgba(215,25,32,0.34)";
    if (value === 3) return "rgba(215,25,32,0.52)";
    if (value === 4) return "rgba(215,25,32,0.72)";
    return "var(--brand-primary)";
  };

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <h3 className="font-semibold text-white mb-4">Event Heatmap This Week</h3>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid grid-cols-8 gap-2">
            <div></div>
            {days.map((day) => (
              <div key={day} className="text-xs text-center font-medium" style={{ color: "var(--text-muted)" }}>
                {day}
              </div>
            ))}
            {times.map((time, timeIdx) => (
              <div key={time} className="contents">
                <div className="text-xs text-right pr-2 flex items-center justify-end" style={{ color: "var(--text-muted)" }}>
                  {time}
                </div>
                {heatmapData.map((dayData, dayIdx) => (
                  <motion.div
                    key={`${dayIdx}-${timeIdx}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: (dayIdx * times.length + timeIdx) * 0.01 }}
                    whileHover={{ scale: 1.1, zIndex: 10 }}
                    className="h-8 rounded cursor-pointer border border-transparent hover:border-white/30 transition-all relative group"
                    style={{ backgroundColor: getColor(dayData[timeIdx]) }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-20" style={{ backgroundColor: "var(--bg-canvas)", border: "1px solid var(--border-strong)" }}>
                      {days[dayIdx]} {time}: {dayData[timeIdx]} events
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((val) => (
                <div key={val} className="w-4 h-4 rounded" style={{ backgroundColor: getColor(val) }} />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
