/**
 * Basemap raster tiles (CARTO, no labels – minimalist).
 *
 * CARTO now requires an API key for its raster basemaps: without one the CDN
 * still answers `200 OK`, but the PNG itself is stamped with a repeated
 * "API KEY REQUIRED" watermark. Because the request technically succeeds,
 * Leaflet never emits `tileerror` and the OSM fallback below is never used.
 *
 * A key is free (5M tile requests / month, attribution required):
 * https://carto.com/basemaps/apikey
 *
 * The key is NOT a secret – CARTO expects it as a `key` query parameter in the
 * tile URL – but it is per-customer, so it is injected at build time from the
 * `VITE_CARTO_API_KEY` environment variable (see .env.example) instead of being
 * committed. `appendCartoKey()` stays pure so this module can also be imported
 * by Node scripts and Netlify Functions.
 */

/** Raster tile templates (keyless) */
export const CARTO_TILE_TEMPLATES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
};

/**
 * Append a CARTO API key to a tile URL (template or resolved URL).
 * Returns the URL untouched when no key is provided.
 * @param {string} url - Tile URL, with or without an existing query string
 * @param {string} [apiKey] - CARTO basemap API key
 * @returns {string}
 */
export function appendCartoKey(url, apiKey = '') {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}key=${encodeURIComponent(key)}`;
}

export const MAP = {
  CENTER: [30, 10],
  ZOOM: 3,
  /** Europe – used as initial view for stadium mode (majority of targets) */
  EUROPE_CENTER: [52, 12],
  EUROPE_ZOOM: 4,
  MIN_ZOOM: 0,
  MAX_ZOOM: 19,
  // GeoJSON performance guards
  GEOJSON_WARN_MB: 6,
  GEOJSON_CACHE_MAX_DEVICE_MEMORY_GB: 2,
  GEOJSON_CACHE_MAX_HW_CONCURRENCY: 2,
  // CartoDB no-label tiles (minimalist). Resolve with appendCartoKey() and the
  // VITE_CARTO_API_KEY value before handing them to Leaflet.
  TILE_URL_DARK: CARTO_TILE_TEMPLATES.dark,
  TILE_URL_LIGHT: CARTO_TILE_TEMPLATES.light,
  // OSM fallback for browsers that block CartoDB (e.g. Brave shields)
  TILE_URL_FALLBACK: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  /** Required by the CARTO free tier: CARTO + OpenStreetMap must stay visible */
  ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, ' +
    '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
  TILE_FALLBACK_ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  /** Max consecutive tile errors before switching to fallback provider */
  TILE_ERROR_THRESHOLD: 5,
  /** Timeout (ms) to detect complete tile load failure */
  TILE_LOAD_TIMEOUT_MS: 8000,
  /** Where to get a free key — used in the missing-key developer warning */
  CARTO_API_KEY_URL: 'https://carto.com/basemaps/apikey',
};
