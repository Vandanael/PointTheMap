import { GAME } from "../config.js";
import { api } from "../services/api.js";
import { createRound, recordClick, timeoutRound } from "./Round.js";

export const GameStatus = {
  IDLE: "idle",
  LOADING: "loading",
  PLAYING: "playing",
  ROUND_RESULT: "round_result",
  GAME_OVER: "game_over",
};

export const createGameState = () => ({
  status: GameStatus.IDLE,
  token: null,
  capitals: [],
  rounds: [],
  currentRoundIndex: 0,
  currentRound: null,
  totalScore: 0,
  pseudo: null,
  result: null,
  error: null,
  sessionBestScore: 0,
  gameType: "classic", // "classic" ou "daily"
});

export const startGame = async (state, gameType = "classic") => {
  try {
    const session = await api.start(gameType);
    if (!session?.capitals || session.capitals.length === 0) {
      return {
        ...state,
        status: GameStatus.IDLE,
        error: "Aucune capitale disponible",
      };
    }
    return {
      ...createGameState(),
      status: GameStatus.PLAYING,
      token: session.token,
      capitals: session.capitals,
      currentRound: createRound(session.capitals[0], 0),
      gameType,
    };
  } catch (error) {
    return {
      ...state,
      status: GameStatus.IDLE,
      error: error.message,
    };
  }
};

export const playRound = (state, clickCoords) => {
  if (state.status !== GameStatus.PLAYING || !state.currentRound) {
    return state;
  }

  const completedRound = recordClick(state.currentRound, clickCoords);
  return {
    ...state,
    status: GameStatus.ROUND_RESULT,
    rounds: [...state.rounds, completedRound],
    currentRound: completedRound,
    totalScore: state.totalScore + completedRound.score,
  };
};

export const handleTimeout = (state) => {
  if (state.status !== GameStatus.PLAYING || !state.currentRound) {
    return state;
  }

  const timedOutRound = timeoutRound(state.currentRound);
  return {
    ...state,
    status: GameStatus.ROUND_RESULT,
    rounds: [...state.rounds, timedOutRound],
    currentRound: timedOutRound,
  };
};

export const nextRound = (state) => {
  const nextIndex = state.currentRoundIndex + 1;

  if (nextIndex >= GAME.ROUNDS) {
    return {
      ...state,
      status: GameStatus.GAME_OVER,
      currentRound: null,
    };
  }

  return {
    ...state,
    status: GameStatus.PLAYING,
    currentRoundIndex: nextIndex,
    currentRound: createRound(state.capitals[nextIndex], nextIndex),
  };
};

export const resetGame = () => createGameState();

export const getCurrentCapital = (state) => state.currentRound?.capital || null;

export const isLastRound = (state) =>
  state.currentRoundIndex >= GAME.ROUNDS - 1;

export const getProgress = (state) => ({
  current: state.currentRoundIndex + 1,
  total: GAME.ROUNDS,
});

export const checkIfNewSessionBest = (state, score) =>
  score > state.sessionBestScore;

export const updateSessionBestScore = (state, score) =>
  score > state.sessionBestScore
    ? { ...state, sessionBestScore: score }
    : state;
