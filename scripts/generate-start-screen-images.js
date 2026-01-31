/**
 * Generate static start-screen images from Carto tiles (Auray view), dark + light theme.
 * Outputs: start-screen-{mobile|tablet|desktop|2k}-{dark|light}.png
 * Run: node scripts/generate-start-screen-images.js (or npm run generate:start-screen)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Match MAP config: Auray, France – start screen
const AURAY_CENTER = [47.6706, -2.9833]; // [lat, lng]
const AURAY_ZOOM = 14;
const TILE_SIZE = 256;

// Dark and light Carto tile URLs (match config.js)
const THEMES = {
  dark: {
    url: 'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
    bg: { r: 2, g: 6, b: 23 },
  },
  light: {
    url: 'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
    bg: { r: 245, g: 243, b: 240 },
  },
};

// Viewport sizes (1x; use as background-size: cover or object-fit: cover)
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  '2k': { width: 2560, height: 1440 },
};

/**
 * Convert lat/lng to fractional tile coordinates (Web Mercator).
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} zoom - Zoom level
 * @returns {{ x: number, y: number }}
 */
function latLngToTile(lat, lng, zoom) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/**
 * Fetch a tile image as buffer.
 * @param {string} tileUrl - Template with {z},{x},{y}
 * @param {number} z - Zoom
 * @param {number} x - Tile X
 * @param {number} y - Tile Y
 * @returns {Promise<Buffer>}
 */
async function fetchTile(tileUrl, z, x, y) {
  const url = tileUrl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tile ${z}/${x}/${y}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

/**
 * Generate one start-screen image for the given viewport and theme.
 * @param {string} name - "mobile" | "tablet" | "desktop" | "2k"
 * @param {{ width: number, height: number }} viewport
 * @param {string} outDir
 * @param {{ url: string, bg: { r: number, g: number, b: number } }} theme
 * @param {string} themeName - "dark" | "light"
 */
async function generateImage(name, viewport, outDir, theme, themeName) {
  const { width: w, height: h } = viewport;
  const { x: cx, y: cy } = latLngToTile(AURAY_CENTER[0], AURAY_CENTER[1], AURAY_ZOOM);

  const xMin = Math.floor(cx - w / (2 * TILE_SIZE));
  const xMax = Math.ceil(cx + w / (2 * TILE_SIZE)) - 1;
  const yMin = Math.floor(cy - h / (2 * TILE_SIZE));
  const yMax = Math.ceil(cy + h / (2 * TILE_SIZE)) - 1;

  const cols = xMax - xMin + 1;
  const rows = yMax - yMin + 1;
  const compositeWidth = cols * TILE_SIZE;
  const compositeHeight = rows * TILE_SIZE;

  const tileBuffers = [];
  for (let ty = yMin; ty <= yMax; ty++) {
    for (let tx = xMin; tx <= xMax; tx++) {
      tileBuffers.push(fetchTile(theme.url, AURAY_ZOOM, tx, ty));
    }
  }
  const tiles = await Promise.all(tileBuffers);

  const compositeInput = [];
  let i = 0;
  for (let ty = yMin; ty <= yMax; ty++) {
    for (let tx = xMin; tx <= xMax; tx++) {
      compositeInput.push({
        input: tiles[i],
        left: (tx - xMin) * TILE_SIZE,
        top: (ty - yMin) * TILE_SIZE,
      });
      i++;
    }
  }

  const compositePxCenterX = (cx - xMin) * TILE_SIZE;
  const compositePxCenterY = (cy - yMin) * TILE_SIZE;
  const left = Math.round(compositePxCenterX - w / 2);
  const top = Math.round(compositePxCenterY - h / 2);

  const composite = await sharp({
    create: {
      width: compositeWidth,
      height: compositeHeight,
      channels: 3,
      background: theme.bg,
    },
  })
    .composite(compositeInput)
    .extract({
      left: Math.max(0, left),
      top: Math.max(0, top),
      width: Math.min(w, compositeWidth - Math.max(0, left)),
      height: Math.min(h, compositeHeight - Math.max(0, top)),
    })
    .png()
    .toBuffer();

  // If we clipped (rare), pad or resize to exact viewport
  let final = composite;
  const meta = await sharp(composite).metadata();
  if (meta.width !== w || meta.height !== h) {
    final = await sharp(composite)
      .resize(w, h, { fit: 'cover' })
      .png()
      .toBuffer();
  }

  const outPath = join(outDir, `start-screen-${name}-${themeName}.png`);
  writeFileSync(outPath, final);
  console.log(`Wrote ${outPath} (${w}x${h}, ${themeName})`);
}

async function main() {
  const outDir = join(__dirname, '..', 'public');
  mkdirSync(outDir, { recursive: true });

  console.log('Fetching Carto tiles and generating start-screen images (dark + light)...');
  for (const [themeName, theme] of Object.entries(THEMES)) {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      await generateImage(name, viewport, outDir, theme, themeName);
    }
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
