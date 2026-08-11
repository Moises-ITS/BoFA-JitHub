/**
 * optimize-videos.mjs — compress the auth-backdrop clips and generate posters.
 *
 * WHY: every visitor downloads these before they can sign in, and they render
 * behind a 5px blur at ~80% brightness. Source bitrate is almost entirely
 * wasted — 1080p footage and 480p footage are indistinguishable once blurred,
 * but one of them is 20× the download.
 *
 *   node scripts/optimize-videos.mjs            # dry run — reports, writes nothing
 *   node scripts/optimize-videos.mjs --apply    # compress + generate posters
 *
 * --apply moves every original into .backups/video-originals/ (outside public/,
 * so originals are never deployed) BEFORE writing the compressed file. Nothing
 * is destroyed; re-running is safe.
 *
 * Requires ffmpeg on PATH:
 *   winget install Gyan.FFmpeg     (Windows)
 *   brew install ffmpeg            (macOS)
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIDEO_DIR = path.resolve(__dirname, "..", "public", "videos");
const POSTER_DIR = path.join(VIDEO_DIR, "posters");
const BACKUP_DIR = path.resolve(__dirname, "..", "..", "..", ".backups", "video-originals");

const APPLY = process.argv.includes("--apply");

// --only=video10.mp4,video20.mp4 — reprocess specific clips (e.g. ones that
// failed because a file was locked) without touching the rest.
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const ONLY = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean))
  : null;

// Height in px. 480 is generous behind a 5px blur; the tiles render ~250px tall
// on a 1080p screen, so even this is oversampled.
const HEIGHT = 480;
// Constant Rate Factor. Higher = smaller + softer. 32 is aggressive for
// foreground video and invisible for a blurred background.
const CRF = 32;

const mb = (bytes) => (bytes / 1048576).toFixed(1);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Move `from` onto `to`, surviving a locked destination.
 *
 * Windows refuses to rename or delete a file while any process holds it open,
 * and a looping <video> in a browser tab holds its clip open indefinitely — so
 * the clips currently on screen are precisely the ones that fail. Retrying
 * alone does not help: the lock is permanent, not transient.
 *
 * The fallback works because those holders opened the file with read SHARING.
 * That forbids rename/delete but still permits writes, so overwriting the
 * contents in place succeeds where swapping the directory entry cannot.
 */
async function replaceFile(from, to, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      const locked = err.code === "EPERM" || err.code === "EBUSY";
      if (!locked) throw err;
      if (attempt >= attempts) {
        fs.writeFileSync(to, fs.readFileSync(from));
        fs.unlinkSync(from);
        return;
      }
      await sleep(attempt * 300);
    }
  }
}

async function ffmpegAvailable() {
  try {
    await run("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!fs.existsSync(VIDEO_DIR)) {
    console.error(`No video directory at ${VIDEO_DIR}`);
    process.exitCode = 1;
    return;
  }

  const files = fs
    .readdirSync(VIDEO_DIR)
    .filter((name) => name.toLowerCase().endsWith(".mp4"))
    .filter((name) => !ONLY || ONLY.has(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    console.log("No .mp4 files found.");
    return;
  }

  const before = files.reduce(
    (sum, name) => sum + fs.statSync(path.join(VIDEO_DIR, name)).size,
    0,
  );

  console.log(`Source     : ${VIDEO_DIR}`);
  console.log(`Clips      : ${files.length}`);
  console.log(`Total now  : ${mb(before)} MB`);
  console.log(`Target     : ${HEIGHT}p, CRF ${CRF}, no audio, faststart`);
  console.log(`Mode       : ${APPLY ? "APPLY" : "dry run"}\n`);

  if (!(await ffmpegAvailable())) {
    console.error(
      "ffmpeg is not on PATH. Install it, then re-run:\n" +
        "  winget install Gyan.FFmpeg   (Windows)\n" +
        "  brew install ffmpeg          (macOS)",
    );
    process.exitCode = 1;
    return;
  }

  if (!APPLY) {
    for (const name of files) {
      const size = fs.statSync(path.join(VIDEO_DIR, name)).size;
      console.log(`  ${name.padEnd(18)} ${mb(size).padStart(6)} MB  →  would compress + poster`);
    }
    console.log("\nDry run complete. Re-run with --apply to write.");
    return;
  }

  fs.mkdirSync(POSTER_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  let after = 0;
  let failed = 0;

  for (const name of files) {
    const src = path.join(VIDEO_DIR, name);
    const backup = path.join(BACKUP_DIR, name);
    const tmp = path.join(VIDEO_DIR, `.tmp-${name}`);
    const poster = path.join(POSTER_DIR, name.replace(/\.[^.]+$/, "") + ".webp");
    const originalSize = fs.statSync(src).size;

    try {
      // Preserve the original FIRST. If ffmpeg dies halfway, the source is
      // already safe and the temp file is the only casualty.
      if (!fs.existsSync(backup)) fs.copyFileSync(src, backup);

      // ALWAYS encode from the pristine backup, never from whatever is
      // currently in public/. Encoding from the live file made this script
      // destructive to re-run: a second pass would re-encode already-compressed
      // output, stacking generation loss each time. Sourcing from the backup
      // makes every run produce byte-identical output no matter how often it
      // runs — which is what lets a partial failure be retried safely.
      const encodeFrom = fs.existsSync(backup) ? backup : src;

      await run("ffmpeg", [
        "-y", "-i", encodeFrom,
        "-an",                              // strip audio — tiles are muted
        "-vf", `scale=-2:${HEIGHT}`,        // -2 keeps the aspect ratio even
        "-c:v", "libx264",
        "-crf", String(CRF),
        "-preset", "slow",
        "-g", "48",                         // frequent keyframes → fast first frame
        "-movflags", "+faststart",          // index up front → play before fully downloaded
        "-loglevel", "error",
        tmp,
      ]);

      await run("ffmpeg", [
        "-y", "-i", encodeFrom,
        "-vf", `scale=-2:360,thumbnail`,    // thumbnail picks a representative frame
        "-frames:v", "1",
        "-q:v", "80",
        "-loglevel", "error",
        poster,
      ]);

      await replaceFile(tmp, src);
      const newSize = fs.statSync(src).size;
      after += newSize;
      const saved = Math.round((1 - newSize / originalSize) * 100);
      console.log(
        `  ${name.padEnd(18)} ${mb(originalSize).padStart(6)} → ${mb(newSize).padStart(6)} MB  (-${saved}%)`,
      );
    } catch (err) {
      failed += 1;
      after += originalSize;
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      console.error(`  ${name.padEnd(18)} FAILED: ${err.message.split("\n")[0]}`);
    }
  }

  console.log(`\nTotal: ${mb(before)} MB → ${mb(after)} MB`);
  console.log(`Originals preserved in ${BACKUP_DIR}`);
  console.log(`Posters written to     ${POSTER_DIR}`);
  if (failed) console.log(`${failed} clip(s) failed and were left untouched.`);
  console.log(
    "\nNext: set POSTERS_GENERATED = true in pages/auth/backgroundVideos.ts\n" +
      "so the tiles paint their poster immediately instead of waiting on video.",
  );
}

main().catch((err) => {
  console.error("optimize-videos failed:", err);
  process.exitCode = 1;
});
