/**
 * backgroundVideos.ts — the campus clips behind the landing and auth screens.
 *
 * ── HOW TO ADD A VIDEO ───────────────────────────────────────────────────────
 * 1. Drop the .mp4 into  react-webapp/frontend/public/videos/
 * 2. Add its filename to BACKGROUND_VIDEOS below.
 * That's it. The mosaic tiles itself from whatever is in this list.
 *
 * Files live in public/ rather than being imported, so Vite copies them
 * verbatim instead of pulling multi-megabyte binaries through the bundle
 * graph. The trade-off is that this list can't be auto-globbed — public/ is
 * outside Vite's module graph — hence the explicit array. It also means you
 * control the order, and a typo shows up as one dead tile rather than a
 * build failure.
 *
 * ── WHAT MAKES A GOOD CLIP ───────────────────────────────────────────────────
 * These sit behind a 5px blur at ~80% brightness and loop forever, muted.
 * - Short (5–15s). They loop; long clips just cost bandwidth.
 * - Quiet motion. Slow pans and ambient crowds read well; hard cuts and
 *   fast camera moves fight the auth card for attention.
 * - Compress hard. 720p is plenty behind a blur. Aim for a few hundred KB
 *   each — every visitor downloads all of them before they can sign in.
 * - H.264 (avc1) + AAC in an .mp4. Safari refuses more exotic codecs, and a
 *   video that will not decode leaves a visibly empty tile.
 *
 * An empty list is fine and fully supported: the mosaic falls back to the
 * design's translucent placeholder tiles, so the screen still looks finished
 * before any footage exists.
 */

/** Filenames inside public/videos/. Extend this list as clips are added. */
export const BACKGROUND_VIDEOS: readonly string[] = [
  "video1.mp4",
  "video2.mp4",
  "video3.mp4",
  "video4.mp4",
  "video5.mp4",
  "video6.mp4",
  "video7.mp4",
  "video8.mp4",
  "video9.mp4",
  "video10.mp4",
  "video11.mp4",
  "video12.mp4",
  "video13.mp4",
  "video14.mp4",
  "video15.mp4",
  "video16.mp4",
  "video17.mp4",
  "video18.mp4",
  "video19.mp4",
  "video20.mp4",

];

/** Public URL for a clip. Kept in one place so the folder can move once. */
export function videoUrl(fileName: string): string {
  return `/videos/${fileName}`;
}

/** Public URL for a clip's poster still. `video3.mp4` → `/videos/posters/video3.webp`. */
export function posterUrl(fileName: string): string {
  return `/videos/posters/${fileName.replace(/\.[^.]+$/, "")}.webp`;
}

/**
 * Whether poster stills exist in public/videos/posters/.
 *
 * Posters are what make the mosaic appear INSTANTLY: a ~15KB still paints on
 * first render, and the video takes over once it can play. Without them a tile
 * is an empty rectangle until enough of a multi-megabyte clip has arrived.
 *
 * Gated behind a flag because a missing poster is a 404 per tile — harmless,
 * but 24 red lines in the network tab invites a bug hunt for a non-bug.
 *
 * Generate them and flip this to true:
 *   node scripts/optimize-videos.mjs --apply
 */
export const POSTERS_GENERATED = false;

/**
 * How many clips start loading immediately; the rest mount as those become
 * playable (see AuthBackdrop's staggered activation).
 *
 * Mounting all 24 at once means 24 simultaneous downloads competing for the
 * same pipe — every tile arrives late instead of the first row arriving fast.
 * One row's worth up front fills the visible band quickly, and the remainder
 * trickle in behind it.
 */
export const INITIAL_VIDEO_BATCH = 6;

/**
 * How many of the 24 tiles get a <video>. Tiles beyond this keep the design's
 * translucent placeholder.
 *
 * Set to 24 so the whole mosaic is live — at 10 the bottom half of the grid sat
 * visibly empty, which reads as broken rather than as a design choice.
 *
 * The cost is real and worth knowing: 24 tiles means 24 hardware decoders
 * running at once. Desktop Chrome handles that; mobile Safari has historically
 * capped much lower and will simply refuse the overflow, leaving those tiles
 * frozen on their first frame. If the mosaic looks half-dead on a phone, or a
 * laptop fan spins up on the sign-in page, this is the number to lower — 12
 * still fills the top half of every screen.
 *
 * Distinct FILES are what costs bandwidth, not tiles: 24 tiles drawing from 20
 * clips is 20 downloads, because the browser caches by URL.
 */
export const MAX_CONCURRENT_VIDEOS = 24;

/**
 * Whether `prefers-reduced-motion: reduce` suppresses playback.
 *
 * true  — clips mount and paint their first frame but never play.
 * false — clips always autoplay. CURRENT SETTING.
 *
 * The row drift stops under the preference either way; this governs only the
 * video itself.
 *
 * Set to false deliberately. On Windows the preference comes from
 * Settings → Accessibility → Visual effects → Animation effects, which many
 * people switch off for performance without meaning "never play video" — and
 * with it on, the whole background rendered as a static grid, which reads as a
 * bug rather than as a considered accessible fallback.
 *
 * Know what this trades away: someone who set that preference for vestibular
 * reasons now gets 24 moving tiles behind the sign-in card, with no way to stop
 * them. If that matters later, the better fix is not flipping this back but
 * adding a visible pause control — which lets the mosaic play by default AND
 * gives that user an out.
 */
export const RESPECT_REDUCED_MOTION = false;
