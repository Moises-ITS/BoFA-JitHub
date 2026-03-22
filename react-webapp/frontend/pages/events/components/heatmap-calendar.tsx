import { useEffect, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";

const API = import.meta.env.VITE_EVENTS_API_URL ?? "http://localhost:8000";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const times = ["8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm", "10pm"];
const timeHours = [8, 10, 12, 14, 16, 18, 20, 22];

interface SlotEvent {
  event_id: number;
  event_name: string;
  club_name: string;
  start_time: string | null;
  post_url: string | null;
}

function fmt12(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function getMondayOfWeek(d: Date): string {
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function HeatmapCalendar() {
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [weekIdx, setWeekIdx] = useState(0);
  const [grid, setGrid] = useState<Record<string, SlotEvent[]>>({});
  const [selected, setSelected] = useState<{ key: string; day: string; time: string } | null>(null);

  // Fetch available weeks (Mondays with events)
  useEffect(() => {
    fetch(`${API}/events/heatmap/weeks`)
      .then((r) => r.json())
      .then((weeks: string[]) => {
        if (weeks.length === 0) {
          // Fallback: show current week even if empty
          setAvailableWeeks([getMondayOfWeek(new Date())]);
        } else {
          setAvailableWeeks(weeks);
        }
        setWeekIdx(0);
      })
      .catch(() => {
        setAvailableWeeks([getMondayOfWeek(new Date())]);
      });
  }, []);

  // Fetch grid whenever selected week changes
  useEffect(() => {
    if (availableWeeks.length === 0) return;
    const monday = availableWeeks[weekIdx];
    fetch(`${API}/events/heatmap/week?week_start=${monday}`)
      .then((r) => r.json())
      .then(setGrid)
      .catch(() => setGrid({}));
    setSelected(null);
  }, [weekIdx, availableWeeks]);

  const getEvents = (day: string, hour: number): SlotEvent[] => grid[`${day}:${hour}`] ?? [];
  const getCellStyle = (count: number): CSSProperties => {
    if (count === 0) return { backgroundColor: "rgba(255,255,255,0.05)" };
    if (count === 1) return { backgroundColor: "rgba(215,25,32,0.30)" };
    if (count === 2) return { backgroundColor: "rgba(215,25,32,0.50)" };
    if (count === 3) return { backgroundColor: "rgba(215,25,32,0.70)" };
    if (count === 4) return { backgroundColor: "rgba(215,25,32,0.85)" };
    return { backgroundColor: "var(--brand-primary)" };
  };

  const selectedEvents = selected ? (grid[selected.key] ?? []) : [];
  const currentMonday = availableWeeks[weekIdx];
  const weekLabel = currentMonday
    ? (() => {
        const mon = parseISO(currentMonday);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return `${format(mon, "MMM d")} – ${format(sun, "MMM d")}`;
      })()
    : "";

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white text-sm">Event Heatmap</h3>
        {availableWeeks.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
              disabled={weekIdx === 0}
              style={{ opacity: weekIdx === 0 ? 0.25 : 1, cursor: weekIdx === 0 ? "not-allowed" : "pointer" }}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </button>
            <span className="text-xs min-w-[90px] text-center" style={{ color: "var(--text-muted)" }}>{weekLabel}</span>
            <button
              onClick={() => setWeekIdx((i) => Math.min(availableWeeks.length - 1, i + 1))}
              disabled={weekIdx === availableWeeks.length - 1}
              style={{ opacity: weekIdx === availableWeeks.length - 1 ? 0.25 : 1, cursor: weekIdx === availableWeeks.length - 1 ? "not-allowed" : "pointer" }}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        )}
        {availableWeeks.length <= 1 && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{weekLabel}</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 280 }}>
          {/* Header row */}
          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "3rem repeat(7, 1fr)" }}>
            <div />
            {days.map((day) => (
              <div key={day} className="text-xs text-center font-medium" style={{ color: "var(--text-muted)" }}>
                {day}
              </div>
            ))}
          </div>

          {/* Time rows */}
          {times.map((time, timeIdx) => (
            <div key={time} className="grid gap-1 mb-1" style={{ gridTemplateColumns: "3rem repeat(7, 1fr)" }}>
              <div className="text-xs text-right pr-2 flex items-center justify-end leading-none" style={{ color: "var(--text-muted)" }}>
                {time}
              </div>
              {days.map((day, dayIdx) => {
                const events = getEvents(day, timeHours[timeIdx]);
                const count = events.length;
                const key = `${day}:${timeHours[timeIdx]}`;
                const isSelected = selected?.key === key;
                return (
                  <motion.div
                    key={`${dayIdx}-${timeIdx}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: (dayIdx * times.length + timeIdx) * 0.006 }}
                    whileHover={{ scale: count > 0 ? 1.15 : 1.02 }}
                    onClick={() => {
                      if (count === 0) return;
                      setSelected(isSelected ? null : { key, day, time });
                    }}
                    title={count > 0 ? `${count} event${count !== 1 ? "s" : ""}` : undefined}
                    style={getCellStyle(count)}
                    className={`h-7 rounded transition-all ${
                      count > 0 ? "cursor-pointer" : "cursor-default"
                    } ${isSelected ? "ring-2 ring-white/60" : "border border-transparent hover:border-white/20"}`}
                  />
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((val) => (
                <div key={val} className="w-3 h-3 rounded" style={getCellStyle(val)} />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Events panel for selected slot */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-white">
                  {selected.day} @ {selected.time} — {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => setSelected(null)}
                  className="hover:text-white transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {selectedEvents.map((ev) => (
                  <div
                    key={ev.event_id}
                    className="flex items-start justify-between gap-2 bg-white/5 rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{ev.event_name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {ev.club_name}{ev.start_time ? ` · ${fmt12(ev.start_time)}` : ""}
                      </p>
                    </div>
                    {ev.post_url && (
                      <a
                        href={ev.post_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-white shrink-0 mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
