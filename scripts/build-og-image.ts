/**
 * Build-time generator for /public/og-image.png (1200×630).
 *
 * Renders an SVG composition (cosmic gradient + Andernator wordmark + tagline +
 * faded character-grid backdrop) and rasterizes it via `sharp`. Run manually
 * after design changes; no need to invoke on every build.
 *
 * Usage:
 *   pnpm tsx scripts/build-og-image.ts
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT = join(process.cwd(), "public", "og-image.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="g1" cx="20%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="80%" cy="80%" r="60%">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g3" cx="65%" cy="25%" r="50%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="text-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#c4b5fd"/>
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="#a78bfa" fill-opacity="0.12"/>
    </pattern>
  </defs>

  <!-- Base canvas: deep cosmic indigo -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0b0420"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g1)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g2)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g3)"/>

  <!-- Subtle vignette -->
  <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
    <stop offset="60%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
  </radialGradient>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>

  <!-- Wordmark -->
  <g font-family="'Space Grotesk', system-ui, -apple-system, sans-serif" text-anchor="middle">
    <text x="${WIDTH / 2}" y="290" font-size="128" font-weight="700" fill="url(#text-grad)" letter-spacing="-3">
      Andernator
    </text>
    <text x="${WIDTH / 2}" y="370" font-size="38" font-weight="500" fill="#e0e7ff" fill-opacity="0.85" letter-spacing="0.5">
      The AI guesses your character.
    </text>
    <text x="${WIDTH / 2}" y="425" font-size="28" font-weight="400" fill="#c7d2fe" fill-opacity="0.7" letter-spacing="0.3">
      Yes / No questions. Live Bayesian reasoning. Visible thinking.
    </text>
  </g>

  <!-- Bottom badge strip -->
  <g font-family="'Space Grotesk', system-ui, sans-serif" text-anchor="middle" fill="#a5b4fc" fill-opacity="0.75">
    <text x="${WIDTH / 2}" y="555" font-size="22" font-weight="500" letter-spacing="2.5">
      ANDERNATOR.COM
    </text>
  </g>
</svg>`;

async function main(): Promise<void> {
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(OUTPUT, png);
   
  console.log(`✓ wrote ${OUTPUT} (${png.length.toLocaleString()} bytes, ${WIDTH}×${HEIGHT})`);
}

main().catch((err) => {
   
  console.error(err);
  process.exit(1);
});
