#!/bin/bash

# Script de test automatique du système de player tokens
# Usage: ./test-player-tokens.sh

set -e  # Exit on error

echo "🚀 Test du système de player tokens"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "📡 Vérification du serveur..."
if ! curl -s http://localhost:8888 > /dev/null 2>&1; then
    echo -e "${RED}❌ Serveur non accessible sur http://localhost:8888${NC}"
    echo "Lance 'netlify dev' dans un autre terminal d'abord !"
    exit 1
fi
echo -e "${GREEN}✓ Serveur accessible${NC}"
echo ""

# Test 1: Generate player token
echo "🎫 Test 1: Génération du player token..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8888/.netlify/functions/generate-player-token)

if echo "$TOKEN_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ Erreur lors de la génération du token:${NC}"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

PLAYER_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
PLAYER_ID=$(echo "$TOKEN_RESPONSE" | grep -o '"player_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PLAYER_TOKEN" ]; then
    echo -e "${RED}❌ Token non généré${NC}"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Token généré avec succès${NC}"
echo "  Player ID: ${PLAYER_ID:0:8}..."
echo "  Token: ${PLAYER_TOKEN:0:30}..."
echo ""

# Test 2: Start game with token
echo "🎮 Test 2: Démarrage d'une partie avec le token..."
START_RESPONSE=$(curl -s -X POST http://localhost:8888/.netlify/functions/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -d '{"gameType":"classic"}')

if echo "$START_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ Erreur lors du démarrage:${NC}"
    echo "$START_RESPONSE"
    exit 1
fi

SESSION_TOKEN=$(echo "$START_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
CSRF_TOKEN=$(echo "$START_RESPONSE" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

# Extract capital names
CAPITAL1=$(echo "$START_RESPONSE" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
CAPITAL2=$(echo "$START_RESPONSE" | grep -o '"name":"[^"]*"' | head -2 | tail -1 | cut -d'"' -f4)
CAPITAL3=$(echo "$START_RESPONSE" | grep -o '"name":"[^"]*"' | head -3 | tail -1 | cut -d'"' -f4)
CAPITAL4=$(echo "$START_RESPONSE" | grep -o '"name":"[^"]*"' | head -4 | tail -1 | cut -d'"' -f4)
CAPITAL5=$(echo "$START_RESPONSE" | grep -o '"name":"[^"]*"' | head -5 | tail -1 | cut -d'"' -f4)

if [ -z "$SESSION_TOKEN" ]; then
    echo -e "${RED}❌ Session non créée${NC}"
    echo "$START_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Partie démarrée avec succès${NC}"
echo "  Session: ${SESSION_TOKEN:0:8}..."
echo "  CSRF: ${CSRF_TOKEN:0:8}..."
echo "  Capitales: $CAPITAL1, $CAPITAL2, $CAPITAL3, $CAPITAL4, $CAPITAL5"
echo ""

# Wait to avoid "too fast" anti-cheat (minimum 15 seconds, we wait 18 to be safe)
echo "⏳ Attente de 18 secondes (anti-cheat du serveur)..."
for i in {18..1}; do
    echo -ne "\r  ${YELLOW}$i secondes restantes...${NC}"
    sleep 1
done
echo -ne "\r${GREEN}  ✓ Temps d'attente écoulé${NC}       \n"
echo ""

# Test 3: Submit score
echo "📊 Test 3: Soumission d'un score..."

# Use realistic timeElapsed values (3-4 seconds per round)
# Total should be around 16-20 seconds to match our wait time
SUBMIT_RESPONSE=$(curl -s -X POST http://localhost:8888/.netlify/functions/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "token": "'$SESSION_TOKEN'",
    "pseudo": "TEST",
    "gameType": "classic",
    "rounds": [
      {"capital": "'$CAPITAL1'", "click": {"lat": 48.8566, "lng": 2.3522}, "status": "completed", "score": 5000, "timeElapsed": 3200},
      {"capital": "'$CAPITAL2'", "click": {"lat": 35.6762, "lng": 139.6503}, "status": "completed", "score": 5000, "timeElapsed": 3400},
      {"capital": "'$CAPITAL3'", "click": {"lat": 51.5074, "lng": -0.1278}, "status": "completed", "score": 5000, "timeElapsed": 3100},
      {"capital": "'$CAPITAL4'", "click": {"lat": 52.52, "lng": 13.405}, "status": "completed", "score": 5000, "timeElapsed": 3600},
      {"capital": "'$CAPITAL5'", "click": {"lat": 41.9028, "lng": 12.4964}, "status": "completed", "score": 5000, "timeElapsed": 3300}
    ]
  }')

if echo "$SUBMIT_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ Erreur lors de la soumission:${NC}"
    echo "$SUBMIT_RESPONSE"
    exit 1
fi

FINAL_SCORE=$(echo "$SUBMIT_RESPONSE" | grep -o '"score":[0-9]*' | head -1 | cut -d':' -f2)
RANK=$(echo "$SUBMIT_RESPONSE" | grep -o '"rank":[0-9]*' | cut -d':' -f2)

if [ -z "$FINAL_SCORE" ]; then
    echo -e "${RED}❌ Score non enregistré${NC}"
    echo "$SUBMIT_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Score soumis avec succès${NC}"
echo "  Score final: $FINAL_SCORE"
echo "  Rang: $RANK"
echo ""

# Summary
echo "=================================="
echo -e "${GREEN}🎉 TOUS LES TESTS RÉUSSIS !${NC}"
echo "=================================="
echo ""
echo "Résumé:"
echo "  Player ID: $PLAYER_ID"
echo "  Score: $FINAL_SCORE points"
echo "  Rang: #$RANK"
echo ""
echo "Le système de player tokens fonctionne parfaitement !"
echo ""
echo "Prochaines étapes:"
echo "  1. Commit: git add . && git commit -m 'feat: player token system working'"
echo "  2. Push: git push origin main"
echo "  3. Vérifier en production une fois déployé"
