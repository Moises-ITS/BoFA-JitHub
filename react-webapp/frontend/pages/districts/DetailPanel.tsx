import { useMemo } from "react";
import {
  BLDGS,
  DISTRICTS,
  DIFFICULTY_COLORS,
  DIST_META,
  type Opportunity,
} from "./data";

type Props = {
  selectedId: string | null;
  onClose: () => void;
};

function getResolved(id: string | null) {
  if (!id) return null;
  const gb = BLDGS.find((b) => b.id === id);
  if (!gb) return null;
  const district = DISTRICTS.find((d) => d.id === gb.dist);
  const building = district?.buildings.find((b) => b.id === id);
  if (!district || !building) return null;
  return { gb, district, building, meta: DIST_META[gb.dist] };
}

function OpportunityCard({ opp, index }: { opp: Opportunity; index: number }) {
  const diffCol = DIFFICULTY_COLORS[opp.difficulty];
  return (
    <div
      className="relative mb-2 overflow-hidden rounded-sm px-4 py-3.5 transition-colors hover:[border-color:rgba(185,215,255,0.2)] hover:[background:rgba(185,215,255,0.03)]"
      style={{
        border: "1px solid rgba(185,215,255,0.09)",
        background: "rgba(185,215,255,0.016)",
        animation: `oppFadeIn 0.25s ease ${index * 50}ms both`,
      }}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ background: diffCol }}
      />
      <div className="flex items-start justify-between gap-2.5 pl-2">
        <div className="text-[12px] font-medium leading-[1.4] tracking-[0.01em]" style={{ color: "rgba(220,240,255,0.88)" }}>
          {opp.title}
        </div>
        <span
          className="flex-shrink-0 rounded-sm px-2 py-[3px] text-[8px] font-semibold uppercase tracking-[0.14em]"
          style={{
            color: diffCol,
            borderColor: diffCol + "45",
            background: diffCol + "14",
            border: `1px solid ${diffCol}45`,
          }}
        >
          {opp.difficulty}
        </span>
      </div>
      <p className="mt-2 pl-2 text-[11px] font-light leading-[1.65]" style={{ color: "rgba(185,215,255,0.4)" }}>
        {opp.description}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1 pl-2">
        {opp.skills.map((s) => (
          <span
            key={s}
            className="rounded-sm px-2 py-0.5 text-[9px] tracking-[0.06em]"
            style={{ background: "rgba(185,215,255,0.06)", color: "rgba(185,215,255,0.45)" }}
          >
            {s}
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between pl-2">
        <div className="flex gap-3 text-[10px]" style={{ color: "rgba(185,215,255,0.28)" }}>
          <span>⏱ {opp.commitment}</span>
          <span>
            👥 {opp.spots} spot{opp.spots !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-sm px-3.5 py-1.5 text-[9px] uppercase tracking-[0.18em] transition-all hover:[background:rgba(185,215,255,0.08)] hover:[color:rgba(220,240,255,0.9)] hover:[border-color:rgba(185,215,255,0.35)]"
          style={{
            border: "1px solid rgba(185,215,255,0.18)",
            color: "rgba(185,215,255,0.55)",
            background: "none",
          }}
        >
          Apply →
        </button>
      </div>
    </div>
  );
}

export function DetailPanel({ selectedId, onClose }: Props) {
  const resolved = useMemo(() => getResolved(selectedId), [selectedId]);
  const open = !!resolved;

  return (
    <>
      <style>{`@keyframes oppFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>
      <aside
        className="absolute right-0 top-0 bottom-0 flex w-[380px] flex-col overflow-hidden"
        style={{
          background: "#07090f",
          borderLeft: "1px solid rgba(185,215,255,0.10)",
          zIndex: 50,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.42s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {resolved && (
          <>
            <div className="flex-shrink-0" style={{ borderBottom: "1px solid rgba(185,215,255,0.07)" }}>
              <div
                className="flex items-center px-5 py-4"
                style={{ borderBottom: "1px solid rgba(185,215,255,0.06)" }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className="flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[9px] uppercase tracking-[0.2em] transition-colors hover:[color:rgba(210,235,255,0.75)]"
                  style={{ color: "rgba(185,215,255,0.38)" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    className="h-2.5 w-2.5"
                  >
                    <path d="M19 12H5M12 5l-7 7 7 7" />
                  </svg>
                  Back
                </button>
                <span
                  className="ml-auto text-[8px] uppercase tracking-[0.26em]"
                  style={{ color: resolved.meta.color + "aa" }}
                >
                  {resolved.meta.short}
                </span>
              </div>
              <div className="px-6 pt-5 pb-4">
                <div className="text-[18px] font-medium leading-[1.3] tracking-[0.02em]" style={{ color: "rgba(230,245,255,0.92)" }}>
                  {resolved.building.name}
                </div>
                <div className="mt-1.5 text-[11px] tracking-[0.04em]" style={{ color: "rgba(185,215,255,0.38)" }}>
                  Supervised by {resolved.building.pi}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {resolved.building.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-sm px-2.5 py-[3px] text-[9px] uppercase tracking-[0.12em]"
                      style={{
                        border: "1px solid rgba(185,215,255,0.14)",
                        color: "rgba(185,215,255,0.45)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-4 pb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div
                className="mb-3.5 text-[8px] uppercase tracking-[0.26em]"
                style={{ color: "rgba(185,215,255,0.25)" }}
              >
                {resolved.building.opportunities.length} Open Position
                {resolved.building.opportunities.length !== 1 ? "s" : ""}
              </div>
              {resolved.building.opportunities.map((opp, i) => (
                <OpportunityCard key={opp.id} opp={opp} index={i} />
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
