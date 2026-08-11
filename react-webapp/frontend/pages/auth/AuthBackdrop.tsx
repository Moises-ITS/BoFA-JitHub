/**
 * AuthBackdrop — the shared shell behind the landing page and every auth screen.
 *
 * Ported from the "Jithub Auth" design (claude.ai/design). The design expressed
 * the mosaic as 24 <image-slot> placeholders driven by a design-canvas runtime
 * (support.js / image-slot.js); neither ships here. The layout, scrims, drift
 * animations and tuning maths are reproduced faithfully — the slots become
 * <video> tiles fed from backgroundVideos.ts.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BACKGROUND_VIDEOS,
  INITIAL_VIDEO_BATCH,
  MAX_CONCURRENT_VIDEOS,
  POSTERS_GENERATED,
  RESPECT_REDUCED_MOTION,
  posterUrl,
  videoUrl,
} from "./backgroundVideos";
import "./AuthBackdrop.css";

/** The design's Background panel, with its defaults. */
interface BackdropTuning {
  /** Blur applied to the whole mosaic, px. Design default 5. */
  tileBlur?: number;
  /** 0.3–1. Drives both the mosaic brightness and the scrim opacities. Design default 0.55. */
  dimming?: number;
  /** Row drift. Design default true; forced off under prefers-reduced-motion. */
  motion?: boolean;
}

interface Props extends BackdropTuning {
  children: ReactNode;
  /** Hides the "MADE BY HIGHLANDERS" footer when a tall card would collide with it. */
  showFooter?: boolean;
}

const ROWS = 4;
const TILES_PER_ROW = 6;

// From the design's renderVals(): rows alternate direction with staggered
// durations so the mosaic never visibly loops as a single unit.
const ROW_ANIMATIONS = [
  "ab-drift-left 46s ease-in-out infinite alternate",
  "ab-drift-right 58s ease-in-out infinite alternate",
  "ab-drift-left 52s ease-in-out infinite alternate",
  "ab-drift-right 64s ease-in-out infinite alternate",
];

/**
 * Matches the media query in AuthBackdrop.css. Read in JS as well as CSS
 * because CSS can stop the row drift but cannot stop video playback — that
 * needs the autoPlay attribute, which only JS can withhold.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export default function AuthBackdrop({
  children,
  showFooter = true,
  tileBlur = 5,
  dimming = 0.55,
  motion = true,
}: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Two consequences of the preference, deliberately decoupled.
  //
  // Row drift ALWAYS stops — that is the large-scale movement the setting is
  // really about. Whether the clips keep playing is a product decision parked
  // on RESPECT_REDUCED_MOTION (currently false: they always play).
  //
  // What this must never do again is skip mounting the videos altogether. That
  // was the original behaviour and it left anyone with the OS setting on — on
  // Windows just Settings → Accessibility → Visual effects → Animation effects
  // — looking at 24 empty rectangles with nothing to explain why.
  const animateRows = motion && !prefersReducedMotion;
  const playVideos = !(prefersReducedMotion && RESPECT_REDUCED_MOTION);

  // Verbatim from the design's renderVals().
  const bgFilter = `blur(${tileBlur}px) brightness(${1.05 - dimming * 0.45}) saturate(1.25)`;
  const dimCenter = (0.3 + dimming * 0.3).toFixed(2);
  const dimMid = (0.08 + dimming * 0.2).toFixed(2);

  /**
   * Which tile shows which clip. Videos repeat across the 24 tiles when fewer
   * are supplied, and only the first MAX_CONCURRENT_VIDEOS tiles get a <video>
   * at all — past that browsers refuse to allocate decoders and the surplus
   * tiles freeze on their first frame, which looks broken. The rest keep the
   * design's translucent placeholder, which is indistinguishable under the blur.
   */
  const tileSources = useMemo(() => {
    const total = ROWS * TILES_PER_ROW;
    if (BACKGROUND_VIDEOS.length === 0) {
      return new Array<{ video: string; poster: string } | null>(total).fill(null);
    }
    return Array.from({ length: total }, (_, index) => {
      if (index >= MAX_CONCURRENT_VIDEOS) return null;
      const fileName = BACKGROUND_VIDEOS[index % BACKGROUND_VIDEOS.length];
      return { video: videoUrl(fileName), poster: posterUrl(fileName) };
    });
  }, []);

  /**
   * Staggered activation.
   *
   * Only the first INITIAL_VIDEO_BATCH tiles mount a <video> initially; each
   * one that becomes playable admits one more. Mounting all 24 at once put 24
   * downloads in contention for the same connection, so every tile arrived
   * late rather than the first row arriving quickly — and 24 decoders spinning
   * up in the same frame is its own stall.
   *
   * onError counts too. A clip that 404s or fails to decode never fires
   * canPlay, and without counting it the whole chain would stall behind one
   * bad file.
   */
  const [readyCount, setReadyCount] = useState(0);
  const admitted = useRef<Set<number>>(new Set());
  const activeCount = Math.min(
    ROWS * TILES_PER_ROW,
    INITIAL_VIDEO_BATCH + readyCount,
  );
  // Idempotent per tile: canPlay fires again on every loop iteration, and an
  // unguarded setState there would re-render the whole 24-tile tree on a timer
  // forever.
  const admitNext = (index: number) => {
    if (admitted.current.has(index)) return;
    admitted.current.add(index);
    setReadyCount((n) => n + 1);
  };

  return (
    <div className="auth-backdrop">
      {/* Handed down as a custom property so each TILE applies the filter —
          see the comment on .auth-backdrop__tile for why it cannot live here. */}
      <div
        className="auth-backdrop__mosaic"
        style={{ "--ab-tile-filter": bgFilter } as React.CSSProperties}
        aria-hidden="true"
      >
        {Array.from({ length: ROWS }, (_, row) => (
          <div
            key={row}
            className="auth-backdrop__row"
            style={{ animation: animateRows ? ROW_ANIMATIONS[row] : "none" }}
          >
            {Array.from({ length: TILES_PER_ROW }, (_, column) => {
              const index = row * TILES_PER_ROW + column;
              const tile = tileSources[index];
              const showVideo = tile !== null && index < activeCount;
              return (
                <div
                  key={column}
                  className="auth-backdrop__tile"
                  // The poster paints the tile immediately — before a single
                  // byte of video has arrived, and it stays put underneath
                  // while the clip loads. This is what stops tiles rendering as
                  // empty rectangles on a slow connection.
                  style={
                    tile && POSTERS_GENERATED
                      ? { backgroundImage: `url(${tile.poster})` }
                      : undefined
                  }
                >
                  {showVideo && (
                    <video
                      className="auth-backdrop__video"
                      src={tile.video}
                      // Shown until the first frame decodes, so there is no
                      // flash of empty tile between mount and playback.
                      poster={POSTERS_GENERATED ? tile.poster : undefined}
                      // muted + playsInline are required for autoplay to
                      // survive at all: browsers block sound-on autoplay
                      // outright, and iOS Safari fullscreens a video without
                      // playsInline. Under reduced motion autoPlay/loop drop
                      // away and the element paints its first frame instead —
                      // preload="auto" is what makes that frame appear, since
                      // "metadata" alone can leave the tile black.
                      autoPlay={playVideos}
                      loop={playVideos}
                      muted
                      playsInline
                      preload="auto"
                      tabIndex={-1}
                      onCanPlay={() => admitNext(index)}
                      onError={() => admitNext(index)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div
        className="auth-backdrop__scrim"
        style={{
          background: `radial-gradient(ellipse 62% 75% at 50% 50%, rgba(11,11,14,${dimCenter}) 0%, rgba(11,11,14,${dimMid}) 55%, rgba(11,11,14,0.55) 100%)`,
        }}
      />
      <div
        className="auth-backdrop__scrim"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,11,14,0.75) 0%, rgba(11,11,14,0) 22%, rgba(11,11,14,0) 78%, rgba(11,11,14,0.85) 100%)",
        }}
      />

      <div className="auth-backdrop__topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* The design's abstract rotated-square mark, replaced with the real
              NJIT logo. alt="" because the wordmark beside it already names the
              product — announcing "NJIT logo" here would just make a screen
              reader read the brand twice. */}
          <img className="auth-backdrop__mark" src="/njit-logo-transparent.png" alt="" />
          <span className="auth-backdrop__wordmark">Jithub</span>
          <span className="auth-backdrop__eyebrow">njit campus network</span>
        </div>
      </div>

      <div className="auth-backdrop__content">{children}</div>

      {showFooter && (
        <div className="auth-backdrop__footer">
          MADE BY HIGHLANDERS, FOR HIGHLANDERS · NEWARK, NJ
        </div>
      )}
    </div>
  );
}
