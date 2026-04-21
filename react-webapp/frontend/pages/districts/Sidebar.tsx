import { useMemo } from "react";
import {
  BLDGS,
  DISTRICTS,
  DIFFICULTY_COLORS,
  DIST_META,
  TOP_POSITION_IDS,
  type Building,
  type DistrictId,
  type Opportunity,
} from "./data";

type ResolvedTop = {
  bldgId: string;
  distId: DistrictId;
  opp: Opportunity;
  match: number;
  why: string;
};

type OppHit = { title: string };

type DistrictGroup = {
  id: DistrictId;
  items: { bldg: Building; oppHits: OppHit[] }[];
};

type Props = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHoverChange: (id: string | null) => void;
};

function resolveTopPositions(): ResolvedTop[] {
  const out: ResolvedTop[] = [];
  for (const tp of TOP_POSITION_IDS) {
    const gb = BLDGS.find((b) => b.id === tp.bldg);
    if (!gb) continue;
    const district = DISTRICTS.find((d) => d.id === gb.dist);
    const building = district?.buildings.find((b) => b.id === tp.bldg);
    const opp = building?.opportunities.find((o) => o.id === tp.opp);
    if (!opp) continue;
    out.push({ bldgId: tp.bldg, distId: gb.dist, opp, match: tp.match, why: tp.why });
  }
  return out;
}

function matchBuilding(b: Building, q: string): { match: boolean; oppHits: OppHit[] } {
  if (!q) return { match: true, oppHits: [] };
  const name = b.name.toLowerCase();
  const pi = (b.pi || "").toLowerCase();
  const tags = (b.tags || []).join(" ").toLowerCase();
  const bldgHit = name.includes(q) || pi.includes(q) || tags.includes(q);
  const oppHits: OppHit[] = [];
  for (const o of b.opportunities) {
    const hit =
      o.title.toLowerCase().includes(q) ||
      o.skills.some((s) => s.toLowerCase().includes(q)) ||
      o.description.toLowerCase().includes(q) ||
      o.difficulty.toLowerCase().includes(q);
    if (hit) oppHits.push({ title: o.title });
  }
  return { match: bldgHit || oppHits.length > 0, oppHits };
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm px-[1px]" style={{ background: "rgba(255,200,120,0.22)", color: "rgba(255,230,190,0.98)" }}>
        {text.slice(i, i + query.length)}
      </mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function Sidebar({ searchQuery, onSearchChange, selectedId, onSelect, onHoverChange }: Props) {
  const q = searchQuery.trim().toLowerCase();
  const topPositions = useMemo(resolveTopPositions, []);

  const groups: DistrictGroup[] = useMemo(() => {
    return DISTRICTS.map((d) => {
      const items = d.buildings
        .map((b) => ({ bldg: b, ...matchBuilding(b, q) }))
        .filter((x) => x.match)
        .map((x) => ({ bldg: x.bldg, oppHits: x.oppHits }));
      return { id: d.id, items };
    }).filter((g) => g.items.length > 0);
  }, [q]);

  const anyMatch = groups.length > 0;

  return (
    <aside
      className="pointer-events-auto absolute right-0 top-0 bottom-0 flex w-[280px] flex-col overflow-hidden"
      style={{ background: "#07090f", borderLeft: "1px solid rgba(185,215,255,0.07)", zIndex: 30 }}
    >
      <div
        className="flex-shrink-0 px-[22px] pt-6 pb-[14px]"
        style={{ borderBottom: "1px solid rgba(185,215,255,0.06)" }}
      >
        <div className="text-[9px] uppercase tracking-[0.24em]" style={{ color: "rgba(185,215,255,0.28)" }}>
          JitHub Research
        </div>
        <div className="mt-1.5 text-[15px] font-medium tracking-[0.04em]" style={{ color: "rgba(210,235,255,0.82)" }}>
          Research Districts
        </div>

        <div
          className="mt-4 flex items-center rounded-[3px] px-2.5 transition-colors focus-within:[background:rgba(185,215,255,0.05)] focus-within:[border-color:rgba(185,215,255,0.35)]"
          style={{ border: "1px solid rgba(185,215,255,0.12)", background: "rgba(185,215,255,0.03)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(185,215,255,0.4)" }}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="SEARCH LABS, SKILLS, POSITIONS…"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent px-2 py-[9px] text-[12px] tracking-[0.04em] outline-none placeholder:tracking-[0.08em]"
            style={{ color: "rgba(230,245,255,0.92)" }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="px-0.5 py-1 text-sm leading-none transition-colors hover:[color:rgba(220,240,255,0.9)]"
              style={{ color: "rgba(185,215,255,0.4)" }}
              title="Clear"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!q && (
          <>
            <div className="flex items-center gap-2 px-[22px] pt-[18px] pb-2.5 text-[8px] uppercase tracking-[0.28em]" style={{ color: "rgba(255,200,120,0.7)" }}>
              <span className="h-1 w-1 rounded-full" style={{ background: "currentColor" }} />
              Top positions for you
            </div>
            <div className="px-[22px] pb-1 text-[10px] font-light tracking-[0.02em]" style={{ color: "rgba(185,215,255,0.32)" }}>
              Curated from your profile and saved interests
            </div>
            {topPositions.map((tp, i) => {
              const dm = DIST_META[tp.distId];
              const diffCol = DIFFICULTY_COLORS[tp.opp.difficulty];
              return (
                <button
                  key={tp.opp.id}
                  type="button"
                  onClick={() => onSelect(tp.bldgId)}
                  onMouseEnter={() => onHoverChange(tp.bldgId)}
                  onMouseLeave={() => onHoverChange(null)}
                  className="block w-full cursor-pointer px-[22px] py-2.5 text-left transition-colors hover:[background:rgba(255,200,120,0.04)]"
                  style={{ borderTop: i === 0 ? "none" : "1px solid rgba(185,215,255,0.04)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[12px] font-medium leading-[1.35] tracking-[0.01em]" style={{ color: "rgba(230,245,255,0.9)" }}>
                      {tp.opp.title}
                    </div>
                    <div className="flex-shrink-0 text-[9px] font-semibold tracking-[0.08em]" style={{ color: "rgba(255,200,120,0.85)" }}>
                      {tp.match}% MATCH
                    </div>
                  </div>
                  <div
                    className="mt-1.5 flex items-center gap-2 text-[9px] uppercase tracking-[0.12em]"
                    style={{ color: "rgba(185,215,255,0.38)" }}
                  >
                    <span style={{ color: dm.color }}>{dm.short}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: diffCol }} />
                      {tp.opp.difficulty}
                    </span>
                    <span>·</span>
                    <span>{tp.opp.commitment}</span>
                  </div>
                  <div className="mt-1.5 text-[10px] font-light italic tracking-[0.02em]" style={{ color: "rgba(185,215,255,0.48)" }}>
                    {tp.why}
                  </div>
                </button>
              );
            })}
          </>
        )}

        {groups.map((g) => {
          const dm = DIST_META[g.id];
          return (
            <div key={g.id}>
              <div
                className="px-7 pt-5 pb-1.5 text-[8px] uppercase tracking-[0.28em]"
                style={{ color: dm.color + "88" }}
              >
                {dm.short}
              </div>
              {g.items.map(({ bldg, oppHits }) => {
                const isActive = selectedId === bldg.id;
                return (
                  <button
                    key={bldg.id}
                    type="button"
                    onClick={() => onSelect(bldg.id)}
                    onMouseEnter={() => onHoverChange(bldg.id)}
                    onMouseLeave={() => onHoverChange(null)}
                    className={`relative block w-full cursor-pointer px-7 py-[11px] text-left text-[11px] font-normal uppercase tracking-[0.16em] transition-colors ${
                      isActive ? "sb-item-active" : "hover:[background:rgba(185,215,255,0.03)]"
                    }`}
                    style={{
                      color: isActive ? "rgba(230,245,255,0.92)" : "rgba(185,215,255,0.38)",
                      background: isActive ? "rgba(185,215,255,0.06)" : undefined,
                    }}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-0.5"
                        style={{ background: "rgba(185,215,255,0.55)" }}
                      />
                    )}
                    <span>
                      <Highlight text={bldg.name} query={q} />
                    </span>
                    {q && oppHits.length > 0 && (
                      <span
                        className="mt-1 block text-[9px] font-light tracking-[0.03em] normal-case"
                        style={{ color: "rgba(185,215,255,0.3)" }}
                      >
                        → <Highlight text={oppHits[0].title} query={q} />
                        {oppHits.length > 1 && ` +${oppHits.length - 1} more`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}

        {q && !anyMatch && (
          <div className="px-[22px] py-6 text-center text-[11px] font-light tracking-[0.04em]" style={{ color: "rgba(185,215,255,0.38)" }}>
            No matches for{" "}
            <strong style={{ color: "rgba(230,245,255,0.85)" }}>“{searchQuery}”</strong>
          </div>
        )}
      </div>
    </aside>
  );
}
