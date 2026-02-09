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
  // CartoDB no-label tiles (minimalist)
  TILE_URL_DARK: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
  TILE_URL_LIGHT: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
  // OSM fallback for browsers that block CartoDB (e.g. Brave shields)
  TILE_URL_FALLBACK: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_FALLBACK_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  /** Max consecutive tile errors before switching to fallback provider */
  TILE_ERROR_THRESHOLD: 5,
  /** Timeout (ms) to detect complete tile load failure */
  TILE_LOAD_TIMEOUT_MS: 8000,
  ATTRIBUTION: '',
};
