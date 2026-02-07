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

// Single source for dashed polylines (in-game line + result line after fitBounds)
const LINE_STYLE = {
  OUTLINE: {
    color: '#000000',
    weight: 6,
    dashArray: '4, 6',
    opacity: 1,
    lineCap: 'butt',
    smoothFactor: 1,
  },
  MAIN: {
    weight: 4,
    dashArray: '4, 6',
    opacity: 1,
    lineCap: 'butt',
    smoothFactor: 1,
  },
};

export const LINES = LINE_STYLE;
export const RESULT_LINES = LINE_STYLE;

import { SCORING_THRESHOLDS } from '@lib/config';

// Distance thresholds and colors (using shared constants)
const DISTANCE_COLORS = {
  EXCELLENT: { threshold: SCORING_THRESHOLDS.VISUAL_EXCELLENT, color: '#22c55e' }, // < 100km → green
  GOOD: { threshold: SCORING_THRESHOLDS.VISUAL_GOOD, color: '#facc15' }, // < 500km → yellow
  DEFAULT: { color: '#94a3b8' }, // >= 500km → gray
};

// Map animations
export const MAP_ANIMATIONS = {
  SHOW_RESULT: {
    duration: 1.5,
    easeLinearity: 0.15,
    animate: true,
  },
  RESET_VIEW: {
    duration: 0.5,
    easeLinearity: 0.25,
  },
  /** Result line draw animation (after fitBounds). Distance label is shown from start and grows with the line. */
  RESULT_LINE: {
    durationMs: 1000,
    steps: 75,
  },
};

export const MAP_VIEW = {
  SAVE_VIEW_DEBOUNCE_MS: 300,
  RESULT_FIT_PADDING: [60, 60],
  RESULT_FIT_MAX_ZOOM: 14,
};

// UI timings
export const UI_TIMING = {
  QUESTION_AUTO_CLOSE: 2400, // Auto-close question modal after 2.4s
  ERROR_DISPLAY: 4000, // Error message display duration
  CHALLENGE_CARD_FADE: 200, // Challenge card fade transition duration
  INPUT_ERROR_SHAKE: 500, // Duration to keep shake animation class
  TOAST_SLIDE_OUT: 300, // Toast slide-out animation duration
  DEBOUNCE_SUBMIT: 1000, // Debounce delay for submit button
  ROUND_TRANSITION_MS: 150, // Delay between round result and next question
};

/**
 * Get line color based on distance
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Color hex code
 */
export const getLineColor = (distanceKm) => {
  if (distanceKm < DISTANCE_COLORS.EXCELLENT.threshold) return DISTANCE_COLORS.EXCELLENT.color;
  if (distanceKm < DISTANCE_COLORS.GOOD.threshold) return DISTANCE_COLORS.GOOD.color;
  return DISTANCE_COLORS.DEFAULT.color;
};
