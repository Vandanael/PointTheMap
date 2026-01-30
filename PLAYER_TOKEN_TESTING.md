# Player Token System - Testing Guide

This document explains how to test the anonymous player token system.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     PLAYER TOKEN FLOW                       │
└─────────────────────────────────────────────────────────────┘

1. App Start
   ↓
   POST /.netlify/functions/generate-player-token
   → Generates UUID + JWT (1 year expiry)
   → Returns { token, player_id }
   → Client stores in localStorage

2. Start Game
   ↓
   POST /.netlify/functions/start (Header: Authorization: Bearer <token>)
   → Validates JWT
   → Updates player.last_seen
   → Stores player_id in session
   → Returns { token, capitals, startTime, csrfToken }

3. Submit Score
   ↓
   POST /.netlify/functions/submit (Header: Authorization: Bearer <token>)
   → Validates JWT via session
   → Recalculates score (anti-cheat)
   → Links score to player_id
   → Updates player.total_games, player.total_score
```

## Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run migrations:**
   ```bash
   # Connect to your Neon database and run:
   psql $NETLIFY_DATABASE_URL -f netlify/database/migrations/002_add_player_tokens.sql
   ```

3. **Set JWT_SECRET environment variable:**

   In Netlify Dashboard:
   - Go to **Site settings → Environment variables**
   - Add variable: `JWT_SECRET` = `<your-secret-key>`

   Generate a secure key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   For local dev, add to `.env`:
   ```bash
   JWT_SECRET=your-dev-secret-here
   ```

## Testing Locally

### 1. Start the dev server
```bash
npm run dev
# or
netlify dev
```

### 2. Test in browser console

Open the browser console (F12) and run:

```javascript
// Test 1: Generate player token
const response1 = await fetch('/.netlify/functions/generate-player-token', {
  method: 'POST'
});
const { token, player_id } = await response1.json();
console.log('Player ID:', player_id);
console.log('Token:', token);

// Test 2: Start game with token
const response2 = await fetch('/.netlify/functions/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ gameType: 'classic' })
});
const session = await response2.json();
console.log('Session:', session);

// Test 3: Submit score with token
const response3 = await fetch('/.netlify/functions/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-CSRF-Token': session.csrfToken
  },
  body: JSON.stringify({
    token: session.token,
    pseudo: 'TEST',
    gameType: 'classic',
    rounds: session.capitals.map((cap, i) => ({
      capital: cap.name,
      click: { lat: cap.lat, lng: cap.lng },
      status: 'completed',
      score: 5000,
      timeElapsed: 3000
    }))
  })
});
const result = await response3.json();
console.log('Result:', result);
```

### 3. Check PlayerAuth service

```javascript
// Get player stats
window.playerAuth.getStats();

// Get current token
await window.playerAuth.getToken();

// Clear token (to test regeneration)
window.playerAuth.clearToken();

// Token will be regenerated on next getToken()
await window.playerAuth.getToken();
```

## Testing with cURL

### 1. Generate player token
```bash
curl -X POST http://localhost:8888/.netlify/functions/generate-player-token \
  -H "Content-Type: application/json" \
  | jq .

# Expected output:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "player_id": "550e8400-e29b-41d4-a716-446655440000",
#   "expires_in": "1y"
# }
```

Save the token and player_id:
```bash
export PLAYER_TOKEN="<your-token-here>"
export PLAYER_ID="<your-player-id-here>"
```

### 2. Start game with token
```bash
curl -X POST http://localhost:8888/.netlify/functions/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -d '{"gameType":"classic"}' \
  | jq .

# Expected output:
# {
#   "token": "uuid-session-token",
#   "capitals": [...5 cities...],
#   "startTime": 1706550000000,
#   "csrfToken": "uuid-csrf-token"
# }
```

Save the session token and CSRF token:
```bash
export SESSION_TOKEN="<session-token>"
export CSRF_TOKEN="<csrf-token>"
```

### 3. Submit score
```bash
curl -X POST http://localhost:8888/.netlify/functions/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "token": "'$SESSION_TOKEN'",
    "pseudo": "TEST",
    "gameType": "classic",
    "rounds": [
      {
        "capital": "Paris",
        "click": {"lat": 48.8566, "lng": 2.3522},
        "status": "completed",
        "score": 5000,
        "timeElapsed": 3000
      }
      // ... 4 more rounds ...
    ]
  }' \
  | jq .

# Expected output:
# {
#   "score": 25000,
#   "rank": 1,
#   "isTopFifty": true,
#   "rounds": [...]
# }
```

## Verify in Database

Connect to your Neon database and check the data:

```sql
-- Check players table
SELECT * FROM players ORDER BY created_at DESC LIMIT 5;

-- Check scores linked to players
SELECT
  s.pseudo,
  s.score,
  s.player_id,
  p.total_games,
  p.total_score
FROM scores s
LEFT JOIN players p ON s.player_id = p.player_id
ORDER BY s.timestamp DESC
LIMIT 10;

-- Check sessions linked to players
SELECT token, player_id, game_type, used, expires_at
FROM sessions
ORDER BY created_at DESC
LIMIT 5;
```

## Testing Token Expiration

To test token expiration (without waiting 1 year):

1. **Manually expire a token:**
   ```javascript
   // In browser console
   localStorage.setItem('player_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJfaWQiOiJ0ZXN0IiwiY3JlYXRlZF9hdCI6MTAwMDAwMDAwMCwiZXhwIjoxMDAwMDAwMDAwfQ.invalid');

   // Try to get token - should generate new one
   await window.playerAuth.getToken();
   ```

2. **Check auto-refresh logic:**
   ```javascript
   // Token should be auto-refreshed if < 1 day remaining
   const stats = window.playerAuth.getStats();
   console.log(stats);
   ```

## Testing Anonymous Behavior

1. **New player:**
   ```bash
   # Clear localStorage
   # Open DevTools → Application → Local Storage → Clear All

   # Start a new game - should auto-generate token
   ```

2. **Returning player:**
   ```bash
   # Keep localStorage intact
   # Refresh page - should reuse existing token
   ```

3. **Multiple devices:**
   ```bash
   # Each device gets its own token
   # Scores are linked to different player_ids
   ```

## Troubleshooting

### Error: "Invalid token"
- Check JWT_SECRET is set correctly
- Verify token hasn't been manually modified
- Check token expiration

### Error: "Missing or invalid token"
- Ensure Authorization header is present: `Authorization: Bearer <token>`
- Verify token format is correct (JWT with 3 parts)

### Error: "Database schema error: missing column"
- Run migration: `002_add_player_tokens.sql`
- Check `players` table exists
- Check `scores.player_id` column exists

### Token not persisting
- Check localStorage is enabled
- Verify no browser extensions are blocking localStorage
- Check console for errors

## Production Deployment

1. **Set JWT_SECRET in Netlify:**
   - Go to Netlify Dashboard
   - Site settings → Environment variables
   - Add `JWT_SECRET` with a strong random value

2. **Run migrations on Neon:**
   ```bash
   psql $NETLIFY_DATABASE_URL -f netlify/database/migrations/002_add_player_tokens.sql
   ```

3. **Deploy:**
   ```bash
   git push origin main
   # Netlify auto-deploys
   ```

4. **Verify production:**
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/generate-player-token \
     -H "Content-Type: application/json" | jq .
   ```

## Security Notes

- JWT tokens are signed with `JWT_SECRET` - keep this secret safe
- Tokens expire after 1 year - users will auto-regenerate
- Player IDs are UUIDs - not guessable
- Scores are still validated server-side (anti-cheat)
- CSRF protection remains active
- Rate limiting still applies

## Next Steps

Possible enhancements:
- Add player stats endpoint (GET /player-stats)
- Add token revocation (blacklist)
- Add player profile customization
- Add cross-device sync (via server-side storage)
- Add player achievements/badges
