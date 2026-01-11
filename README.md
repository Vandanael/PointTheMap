# PointTheMap

Jeu géographique où vous devez localiser 5 capitales sur une carte muette en 5 secondes chacune.

## Technologies

- Leaflet.js pour la carte
- Tailwind CSS pour le design
- Vanilla JavaScript
- Supabase pour le leaderboard global

## Configuration

Le leaderboard nécessite un projet Supabase. Créez une table `leaderboard` avec les colonnes : `pseudo`, `score`, `time`, `wordle`, `date`, `timestamp`, `session_id`. Mettez à jour `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `index.html`.

## Déploiement

Le projet est statique et compatible GitHub Pages. Poussez le code sur la branche `main` et activez GitHub Pages dans les paramètres du dépôt.
