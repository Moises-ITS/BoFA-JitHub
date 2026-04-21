import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useIsoScene } from "./useIsoScene";
import { Sidebar } from "./Sidebar";
import { DetailPanel } from "./DetailPanel";
import { Controls } from "./Controls";
import { BLDGS, DEFAULT_TWEAKS, type Tweaks } from "./data";

const SIDEBAR_W = 280;
const DETAIL_W = 380;

export default function ResearchDistricts() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotArrowRef = useRef<SVGGElement | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const paramId = searchParams.get("b");
  const validParamId = useMemo(
    () => (paramId && BLDGS.some((b) => b.id === paramId) ? paramId : null),
    [paramId],
  );

  const [selectedId, setSelectedIdState] = useState<string | null>(validParamId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tweaks] = useState<Tweaks>(DEFAULT_TWEAKS);

  const setSelectedId = useCallback(
    (next: string | null) => {
      setSelectedIdState(next);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next) p.set("b", next);
          else p.delete("b");
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (validParamId && validParamId !== selectedId) {
      setSelectedIdState(validParamId);
    }
  }, [validParamId, selectedId]);

  const detailOpen = !!selectedId;
  const rightChromeWidth = detailOpen ? DETAIL_W : SIDEBAR_W;

  const controls = useIsoScene({
    canvasRef,
    rotIndicatorRef: rotArrowRef,
    rightChromeWidth,
    tweaks,
    selectedId,
    hoveredExternalId: hoveredId,
    onSelect: setSelectedId,
    onHoverChange: setHoveredId,
  });

  return (
    <div
      className="relative w-full overflow-hidden rounded-[4px]"
      style={{
        height: "calc(100vh - 112px)",
        background: "#07090f",
        border: "1px solid rgba(185,215,255,0.08)",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      <Controls
        ref={rotArrowRef}
        rightOffset={rightChromeWidth}
        onZoomIn={controls.zoomIn}
        onZoomOut={controls.zoomOut}
        onReset={controls.reset}
        onRotateCW={controls.rotateCW}
        onRotateCCW={controls.rotateCCW}
      />

      <div
        className="pointer-events-none absolute bottom-6 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap text-[13px] font-light tracking-[0.05em]"
        style={{
          color: "rgba(185,215,255,0.38)",
          opacity: selectedId ? 0 : 1,
          transition: "opacity 0.5s",
        }}
      >
        Click to select · Drag to pan ·{" "}
        <b style={{ color: "rgba(230,245,255,0.65)" }}>Ctrl+drag</b> to rotate ·{" "}
        <b style={{ color: "rgba(230,245,255,0.65)" }}>R</b> to step
      </div>

      <Sidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onHoverChange={setHoveredId}
      />

      <DetailPanel selectedId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
