/**
 * Basemap tile URL resolution.
 *
 * Keeps the build-time CARTO API key (`VITE_CARTO_API_KEY`) out of the shared
 * `lib/config` module: `lib/` is also imported by Node scripts and Netlify
 * Functions, where `import.meta.env` does not exist.
 *
 * Without a key CARTO still answers 200 but watermarks every tile with
 * "API KEY REQUIRED", so `HAS_CARTO_API_KEY` is exposed to warn developers.
 * Get a free key (5M tiles/month) at MAP.CARTO_API_KEY_URL.
 */

import { MAP, appendCartoKey } from '@lib/config/index.js';

const CARTO_API_KEY = (import.meta.env.VITE_CARTO_API_KEY ?? '').trim();

/** True when a CARTO basemap API key was provided at build time. */
export const HAS_CARTO_API_KEY = CARTO_API_KEY !== '';

/**
 * Resolve the CARTO raster tile URL for a theme, including the API key.
 * @param {string} theme - 'dark' | 'light'
 * @returns {string} Tile URL template for Leaflet
 */
export function getCartoTileUrl(theme) {
  const template = theme === 'light' ? MAP.TILE_URL_LIGHT : MAP.TILE_URL_DARK;
  return appendCartoKey(template, CARTO_API_KEY);
}
