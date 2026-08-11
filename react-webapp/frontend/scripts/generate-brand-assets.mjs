/**
 * Regenerates the raster brand assets in public/ from jithub-logo.svg:
 *   favicon-32.png, favicon-512.png, apple-touch-icon.png (180),
 *   og-image.png (1200x630 screenshot of the live landing page).
 *
 * Run from react-webapp/frontend:  node scripts/generate-brand-assets.mjs
 * Re-run whenever public/jithub-logo.svg changes, or to refresh the social
 * preview after a landing-page redesign (then re-scrape on LinkedIn's Post
 * Inspector — social sites cache og:image aggressively).
 */
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const pub = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const svg = readFileSync(resolve(pub, "jithub-logo.svg"), "utf8");

const browser = await chromium.launch();

for (const size of [32, 180, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`
  );
  const name = size === 180 ? "apple-touch-icon.png" : `favicon-${size}.png`;
  await page.screenshot({ path: resolve(pub, name), omitBackground: true });
  console.log("wrote", name);
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
try {
  await page.goto("https://jit-hub.com/", { waitUntil: "networkidle", timeout: 45000 });
} catch {
  console.log("networkidle timed out, proceeding with what loaded");
}
await page.waitForTimeout(3500); // let the backdrop video reach a real frame
await page.screenshot({ path: resolve(pub, "og-image.png") });
console.log("wrote og-image.png");

await browser.close();
