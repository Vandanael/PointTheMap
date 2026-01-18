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

export const recordClick = (round, clickCoords) => {
  const endTime = Date.now();
  const elapsed = endTime - round.startTime;

  if (elapsed > GAME.TIMER_MS) {
    return {
      ...round,
      endTime,
      click: clickCoords,
      distance: null,
      score: 0,
      status: "timeout",
    };
  }

  const capitalCoords = [round.capital.lat, round.capital.lng];
  const distance = haversine(clickCoords, capitalCoords);
  const score = calculateScore(distance);

  return {
    ...round,
    endTime,
    click: { lat: clickCoords[0], lng: clickCoords[1] },
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
  return Math.max(0, GAME.TIMER_MS - elapsed);
};
