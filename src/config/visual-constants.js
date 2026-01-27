/**
 * Visual Constants - All hardcoded visual values centralized
 *
 * Extracted from Map.js, UI.js, main.js
 * Sprint 3 - UI & Components Cleanup
 */

// Map Markers
export const MARKERS = {
  PLAYER: {
    iconSize: [16, 16],
    iconAnchor: [10, 10],
  },
  CAPITAL: {
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  },
};

// Map Lines (polylines)
export const LINES = {
  OUTLINE: {
    color: '#000000',
    weight: 6,
    dashArray: '10, 14',
    opacity: 1,
    lineCap: 'butt',
    smoothFactor: 1, // Réduit le lissage pour un rendu plus net avec Canvas
  },
  MAIN: {
    weight: 4,
    dashArray: '10, 14',
    opacity: 1,
    lineCap: 'butt',
    smoothFactor: 1, // Réduit le lissage pour un rendu plus net avec Canvas
  },
};

// Distance thresholds and colors
export const DISTANCE_COLORS = {
  EXCELLENT: { threshold: 100, color: '#22c55e' },    // < 100km → green
  GOOD: { threshold: 500, color: '#facc15' },         // < 500km → yellow
  DEFAULT: { color: '#94a3b8' },                      // >= 500km → gray
};

// Distance-based zoom levels
export const DISTANCE_ZOOM = {
  VERY_CLOSE: { threshold: 50, zoom: 10 },      // < 50km
  CLOSE: { threshold: 200, zoom: 8 },           // < 200km
  MEDIUM: { threshold: 500, zoom: 6 },          // < 500km
  FAR: { threshold: 1000, zoom: 5 },            // < 1000km
  VERY_FAR: { zoom: 4 },                        // >= 1000km
};

// Map animations
export const MAP_ANIMATIONS = {
  SHOW_RESULT: {
    duration: 1.5,
    easeLinearity: 0.25,
    animate: true,
  },
  RESET_VIEW: {
    duration: 0.5,
    easeLinearity: 0.25,
  },
};

// FitBounds padding options
export const FITBOUNDS_OPTIONS = {
  DEFAULT_PADDING: [80, 80],      // Padding horizontal et vertical en pixels
  MOBILE_PADDING: [40, 40],       // Padding réduit pour mobile (futur)
  MAX_ZOOM: 10,                    // Zoom maximum pour éviter trop zoomer sur des points proches
  MIN_ZOOM: 2,                     // Zoom minimum pour éviter de trop dézoomer
};

// UI timings
export const UI_TIMING = {
  QUESTION_AUTO_CLOSE: 1000,        // Auto-close question modal after 1s
  ERROR_DISPLAY: 4000,              // Error message display duration
  LOADER_FINAL_DELAY: 300,          // Delay before hiding loader at 100%
  ROUND_RESULT_DELAY: 0,            // Delay before showing round result (currently 0 in setTimeout)
};

// Helper functions using constants
export const getLineColor = (distanceKm) => {
  if (distanceKm < DISTANCE_COLORS.EXCELLENT.threshold) return DISTANCE_COLORS.EXCELLENT.color;
  if (distanceKm < DISTANCE_COLORS.GOOD.threshold) return DISTANCE_COLORS.GOOD.color;
  return DISTANCE_COLORS.DEFAULT.color;
};

export const getZoomLevel = (distanceKm) => {
  if (distanceKm < DISTANCE_ZOOM.VERY_CLOSE.threshold) return DISTANCE_ZOOM.VERY_CLOSE.zoom;
  if (distanceKm < DISTANCE_ZOOM.CLOSE.threshold) return DISTANCE_ZOOM.CLOSE.zoom;
  if (distanceKm < DISTANCE_ZOOM.MEDIUM.threshold) return DISTANCE_ZOOM.MEDIUM.zoom;
  if (distanceKm < DISTANCE_ZOOM.FAR.threshold) return DISTANCE_ZOOM.FAR.zoom;
  return DISTANCE_ZOOM.VERY_FAR.zoom;
};
