// Point The Map - API Service
// Wrapper Netlify Functions avec mode mock pour dev local

import { capitals, GAME } from "../config.js";
import { randomSelect, generateId } from "../utils.js";
import { logger } from "../utils/logger.js";
import {
  getRetryQueue,
  removeFromRetryQueue,
  addToRetryQueue,
  saveRetryQueue,
  recordSubmissionTime,
} from "./storage.js";

const API_BASE = "/.netlify/functions";

// Mode mock activé en dev local (Vite), désactivé en production
const USE_MOCK = import.meta.env.DEV && !import.meta.env.VITE_USE_API;

// ============================================
// MOCK (dev local uniquement)
// ============================================
const mockStart = () => {
  const selected = randomSelect(capitals, GAME.ROUNDS);
  return {
    token: generateId(),
    capitals: selected.map((c) => ({
      name: c.name,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
    })),
    startTime: Date.now(),
  };
};

const mockSubmit = (token, rounds, pseudo) => {
  const totalScore = rounds.reduce((sum, r) => sum + (r.score || 0), 0);
  return {
    score: Math.round(totalScore),
    rank: Math.floor(Math.random() * 50) + 1,
    isTopFifty: totalScore > 15000,
  };
};

const mockLeaderboard = () => {
  const names = ["MAX", "PRO", "ACE", "ZOE", "LEO", "KIM", "SAM", "JOE", "LUC", "EVA"];
  return Array.from({ length: 10 }, (_, i) => ({
    rank: i + 1,
    pseudo: names[i],
    score: 25000 - i * 1500 - Math.floor(Math.random() * 500),
    time: 25000 + i * 2000,
  }));
};

// ============================================
// API RÉELLE
// ============================================
const fetchApi = async (endpoint, options = {}) => {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json().catch(() => ({ error: "Invalid response" }));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
};

// Formatter les rounds pour le serveur
const formatRoundsForSubmit = (rounds) =>
  rounds.map((r) => ({
    capital: r.capital.name,
    click: r.click,
    distance: r.distance,
    score: r.score,
    status: r.status,
  }));

// ============================================
// EXPORTS
// ============================================
export const api = {
  start: async (gameType = "classic") => {
    if (USE_MOCK) {
      logger.log("[API] Mode mock activé");
      return mockStart();
    }
    return fetchApi("start", { 
      method: "POST",
      body: JSON.stringify({ gameType }),
    });
  },

  submit: async (token, rounds, pseudo, gameType = "classic") => {
    if (USE_MOCK) {
      return mockSubmit(token, rounds, pseudo);
    }
    return fetchApi("submit", {
      method: "POST",
      body: JSON.stringify({
        token,
        rounds: formatRoundsForSubmit(rounds),
        pseudo,
        gameType,
      }),
    });
  },

  getLeaderboard: async (type = "classic") => {
    if (USE_MOCK) {
      return [];
    }
    return fetchApi(`leaderboard?type=${type}`);
  },
};

// ============================================
// RETRY LOGIC (Offline resilience)
// ============================================
export const submitWithRetry = async (token, rounds, pseudo, gameType = "classic") => {
  try {
    const result = await api.submit(token, rounds, pseudo, gameType);
    // Succès → enlever du retry queue si y'était
    const queue = getRetryQueue();
    const index = queue.findIndex(
      (e) => e.token === token && e.pseudo === pseudo
    );
    if (index !== -1) {
      removeFromRetryQueue(index);
    }
    recordSubmissionTime();
    return result;
  } catch (error) {
    // Erreur réseau ou serveur 5xx → ajouter à queue
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("500") ||
      error.message.includes("502") ||
      error.message.includes("503")
    ) {
      addToRetryQueue(token, rounds, pseudo, gameType);
      throw new Error(
        "Score en attente de synchronisation (connexion perdue). Réessai automatique..."
      );
    }
    // Erreur client (validation) → pas de retry
    recordSubmissionTime();
    throw error;
  }
};

export const processRetryQueue = async () => {
  const queue = getRetryQueue();
  if (queue.length === 0) return { successful: 0, failed: 0 };

  let successful = 0;
  let failed = 0;
  const MAX_RETRIES = 3;
  const MAX_AGE_MS = 86400000; // 24h

  // Itération en sens inverse pour éviter les problèmes d'index lors de la suppression
  // Quand on supprime un élément avec removeFromRetryQueue(i), les indices suivants
  // ne sont pas affectés car on itère de la fin vers le début
  for (let i = queue.length - 1; i >= 0; i--) {
    const entry = queue[i];

    if (Date.now() - entry.addedAt > MAX_AGE_MS) {
      removeFromRetryQueue(i);
      continue;
    }

    if (entry.attempts >= MAX_RETRIES) {
      removeFromRetryQueue(i);
      failed++;
      continue;
    }

    try {
      await api.submit(entry.token, entry.rounds, entry.pseudo, entry.gameType || "classic");
      removeFromRetryQueue(i);
      successful++;
    } catch (error) {
      entry.attempts++;
      // Note: getRetryQueue() retourne une copie, modification locale puis sauvegarde
      const updatedQueue = getRetryQueue();
      updatedQueue[i] = entry;
      saveRetryQueue(updatedQueue);
      failed++;
    }
  }

  return { successful, failed };
};
