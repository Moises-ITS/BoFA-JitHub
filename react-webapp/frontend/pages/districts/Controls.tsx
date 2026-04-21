import { forwardRef } from "react";

type Props = {
  rightOffset: number;
  onZoomIn(): void;
  onZoomOut(): void;
  onReset(): void;
  onRotateCW(): void;
  onRotateCCW(): void;
};

function CtrlButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-full transition-colors hover:[background:rgba(22,36,58,0.95)] hover:[color:rgba(220,240,255,0.9)]"
      style={{
        background: "rgba(14,22,38,0.9)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(185,215,255,0.14)",
        color: "rgba(185,215,255,0.6)",
        fontSize: 15,
      }}
    >
      {children}
    </button>
  );
}

export const Controls = forwardRef<SVGGElement, Props>(function Controls(
  { rightOffset, onZoomIn, onZoomOut, onReset, onRotateCW, onRotateCCW },
  rotArrowRef,
) {
  return (
    <div
      className="absolute top-5 z-40 flex flex-col gap-2"
      style={{
        right: rightOffset + 12,
        transition: "right 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <CtrlButton title="Zoom in" onClick={onZoomIn}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path d="M11 8v6M8 11h6M21 21l-4.35-4.35" />
        </svg>
      </CtrlButton>
      <CtrlButton title="Zoom out" onClick={onZoomOut}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path d="M8 11h6M21 21l-4.35-4.35" />
        </svg>
      </CtrlButton>
      <CtrlButton title="Reset view" onClick={onReset}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </CtrlButton>
      <div
        className="mx-1.5 h-px"
        style={{ background: "rgba(185,215,255,0.1)" }}
      />
      <CtrlButton title="Rotate counter-clockwise" onClick={onRotateCCW}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      </CtrlButton>
      <CtrlButton title="Rotate clockwise" onClick={onRotateCW}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      </CtrlButton>
      <div
        className="pointer-events-none flex h-[38px] w-[38px] items-center justify-center rounded-full"
        style={{
          background: "rgba(14,22,38,0.6)",
          border: "1px solid rgba(185,215,255,0.1)",
          color: "rgba(185,215,255,0.55)",
        }}
        title="Camera orientation"
      >
        <svg viewBox="-12 -12 24 24" className="h-[22px] w-[22px]">
          <g
            ref={rotArrowRef}
            style={{ transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <path d="M0 -7 L4 4 L0 2 L-4 4 Z" fill="currentColor" />
          </g>
          <circle cx="0" cy="0" r="10" fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} />
        </svg>
      </div>
    </div>
  );
});
