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
  ATTRIBUTION: '',
};
