import { GAME } from "../config.js";
import { haversine } from "../utils.js";

export const createRound = (capital, roundNumber) => ({
  capital,
  roundNumber,
  startTime: Date.now(),
  endTime: null,
  click: null,
  distance: null,
  score: null,
  status: "playing",
});

// Normalize longitude to -180 to 180 range
const normalizeLng = (lng) => {
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
};

// Normalize latitude to -90 to 90 range (clamp)
const normalizeLat = (lat) => {
  return Math.max(-90, Math.min(90, lat));
};

export const recordClick = (round, clickCoords) => {
  const endTime = Date.now();
  const elapsed = endTime - round.startTime;
  const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;

  // Normalize coordinates to valid ranges
  const normalizedLat = normalizeLat(clickCoords[0]);
  const normalizedLng = normalizeLng(clickCoords[1]);
  const normalizedCoords = [normalizedLat, normalizedLng];

  if (elapsed > totalTimeAllowed) {
    return {
      ...round,
      endTime,
      click: { lat: normalizedLat, lng: normalizedLng },
      distance: null,
      score: 0,
      status: "timeout",
    };
  }

  const capitalCoords = [round.capital.lat, round.capital.lng];
  const distance = haversine(normalizedCoords, capitalCoords);
  const score = calculateScore(distance);

  return {
    ...round,
    endTime,
    click: { lat: normalizedLat, lng: normalizedLng },
    distance: Math.round(distance),
    score: Math.round(score),
    status: "completed",
  };
};

export const timeoutRound = (round) => ({
  ...round,
  endTime: Date.now(),
  click: null,
  distance: null,
  score: 0,
  status: "timeout",
});

export const calculateScore = (distanceKm) => {
  if (distanceKm < 1) {
    return GAME.MAX_SCORE_PER_ROUND;
  }

  if (distanceKm < 100) {
    return Math.round(5000 * Math.exp(-distanceKm / 280));
  }
  
  if (distanceKm < 500) {
    const scoreAt100 = 5000 * Math.exp(-100 / 280);
    const scoreAt500 = 1000;
    const progress = (distanceKm - 100) / 400;
    return Math.round(scoreAt100 + (scoreAt500 - scoreAt100) * progress);
  }
  
  const excess = distanceKm - 500;
  return Math.max(0, Math.round(1000 * Math.exp(-excess / 800)));
};

export const getRemainingTime = (round) => {
  const elapsed = Date.now() - round.startTime;
  const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
  return Math.max(0, totalTimeAllowed - elapsed);
};
