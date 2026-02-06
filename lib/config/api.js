/**
 * API and server-side configuration
 * Used by Netlify functions for validation and rate limiting
 */
export const API = {
  // Session configuration
  SESSION_EXPIRY_MS: 10 * 60 * 1000, // 10 minutes

  // Rate limiting
  RATE_LIMIT_PER_HOUR: 50, // Maximum requests per hour per IP

  // Game validation
  MIN_GAME_DURATION_MS: 5000, // Minimum plausible game duration (5 seconds)
  MIN_PLAUSIBLE_DURATION_MS: 15000, // Minimum realistic duration (15 seconds)
  MAX_GAME_DURATION_MS: 10 * 60 * 1000, // Maximum game duration (10 minutes)
  MIN_ROUND_TIME_MS: 100, // Minimum plausible time per round (human reaction time)

  // Leaderboard
  LEADERBOARD_TOP_LIMIT: 50, // Number of top scores to return
  LEADERBOARD_QUERY_LIMIT: 100, // Fetch limit before deduplication

  // Geographic validation
  MAX_DISTANCE_KM: 20015, // Half of Earth's circumference (max valid distance)

  // Database timeouts
  DB_QUERY_TIMEOUT_MS: 8000, // Database query timeout
};
