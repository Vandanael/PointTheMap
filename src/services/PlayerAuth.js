/**
 * PlayerAuth - Service for managing anonymous player tokens
 *
 * This service handles:
 * - Generating and storing player tokens (JWT)
 * - Checking token expiration
 * - Auto-refreshing expired tokens
 * - Providing the token for API requests
 */

import { logger } from '../utils/logger.js';

const TOKEN_KEY = 'player_token';
const PLAYER_ID_KEY = 'player_id';
const TOKEN_ENDPOINT = '/.netlify/functions/generate-player-token';

class PlayerAuth {
  constructor() {
    this.token = null;
    this.playerId = null;
    this.initPromise = null;
  }

  /**
   * Initialize the player auth system
   * Called automatically on first getToken() call
   */
  async init() {
    // Prevent multiple concurrent initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInit();
    await this.initPromise;
    this.initPromise = null;
  }

  async _doInit() {
    // Try to load token from localStorage
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedPlayerId = localStorage.getItem(PLAYER_ID_KEY);

    if (storedToken && storedPlayerId && !this.isTokenExpired(storedToken)) {
      this.token = storedToken;
      this.playerId = storedPlayerId;
      logger.debug('[PlayerAuth] Loaded existing token for player:', storedPlayerId.substring(0, 8) + '...');
      return;
    }

    // Token is missing or expired, generate a new one
    logger.debug('[PlayerAuth] No valid token found, generating new one...');
    await this.generateNewToken();
  }

  /**
   * Generate a new player token from the server
   */
  async generateNewToken() {
    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to generate token: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.token;
      this.playerId = data.player_id;

      // Store in localStorage
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(PLAYER_ID_KEY, data.player_id);

      logger.debug('[PlayerAuth] New token generated for player:', data.player_id.substring(0, 8) + '...');
      return data;
    } catch (error) {
      logger.error('[PlayerAuth] Error generating token:', error);
      throw error;
    }
  }

  /**
   * Check if a token is expired
   * @param {string} token - JWT token
   * @returns {boolean}
   */
  isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();

      // Consider expired if less than 1 day remaining
      const oneDayMs = 24 * 60 * 60 * 1000;
      return (expiresAt - now) < oneDayMs;
    } catch (error) {
      logger.error('[PlayerAuth] Error parsing token:', error);
      return true; // Consider invalid tokens as expired
    }
  }

  /**
   * Get the current player token
   * Auto-initializes if needed
   * @returns {Promise<string>}
   */
  async getToken() {
    if (!this.token) {
      await this.init();
    }

    // Double-check expiration
    if (this.isTokenExpired(this.token)) {
      logger.debug('[PlayerAuth] Token expired, generating new one...');
      await this.generateNewToken();
    }

    return this.token;
  }

  /**
   * Get the current player ID
   * @returns {Promise<string>}
   */
  async getPlayerId() {
    if (!this.playerId) {
      await this.init();
    }
    return this.playerId;
  }

  /**
   * Get the Authorization header value
   * @returns {Promise<string>}
   */
  async getAuthHeader() {
    const token = await this.getToken();
    return `Bearer ${token}`;
  }

  /**
   * Clear the stored token (for testing or logout)
   */
  clearToken() {
    this.token = null;
    this.playerId = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PLAYER_ID_KEY);
    logger.debug('[PlayerAuth] Token cleared');
  }

  /**
   * Get player stats from localStorage (if available)
   */
  getStats() {
    return {
      playerId: this.playerId,
      hasToken: !!this.token,
      isExpired: this.token ? this.isTokenExpired(this.token) : true,
    };
  }
}

// Export singleton instance
export const playerAuth = new PlayerAuth();

// For testing/debugging
if (typeof window !== 'undefined') {
  window.playerAuth = playerAuth;
}
