# Point The Map

**Live:** https://pointthemap.net/

A competitive geography game focused on precision and speed.

## Core Features

- Precision clicking on an interactive map.
- Dynamic scoring based on distance (km) and time.
- Real-time visual feedback and a smooth game loop.

## Technical Architecture

The project uses a decoupled, event-driven architecture. User interactions flow through a clear pipeline, and systems communicate through the `EventBus` to avoid tight coupling.

Primary flow:

```txt
InputSystem -> EventBus -> StateManager -> UI / Map Systems
```

Key points:

- `StateManager` applies immutable updates, validates state, and emits changes.
- `EventBus` orchestrates interactions between Map, Timer, UI, Scoring, and Input systems.
- Asynchronous geographic data loading with caching and preloading.
- Asset optimizations: compressed GeoJSON, WebP images, and progressive loading.

## Tech Stack

- Frontend: Vite, Vanilla JS
- Styles: TailwindCSS
- Mapping: Leaflet (basemap tiles via Carto)
- Backend: Netlify Functions, Neon (PostgreSQL)

## Quick Start

```bash
npm install
cp .env.example .env   # then fill in VITE_CARTO_API_KEY (see below)
npm run dev
```

Ouvrir `http://localhost:5173`.

### Basemap API key (required)

Map tiles come from CARTO, whose raster basemaps now require an API key. Without one the
CDN still returns `200 OK` but watermarks every tile with **"API KEY REQUIRED"** — which is
why no tile error is raised and the OSM fallback never triggers.

1. Request a free key (no account needed, 5M tiles/month): <https://carto.com/basemaps/apikey>
2. Set `VITE_CARTO_API_KEY=<your-key>` in `.env` (local) and in the Netlify environment
   variables (production/preview), then rebuild.
3. Keep the map attribution visible — it is part of the free-tier terms.
   The static start-screen images (`npm run generate:start-screen`) read the same variable.

## Scripts

```bash
npm run dev            # Dev server
npm run build          # Production build + bundle budget + CSS import guard
npm run test:run       # Unit tests (Vitest)
npm run e2e:dev        # Playwright smoke (dev)
npm run e2e:preview    # Playwright smoke (build + preview)
npm run visual:check   # Playwright visual regression comparison
npm run bench:submit -- --base-url=http://127.0.0.1:8888 --runs=20
npm run bench:submit:local -- --runs=100
```

## License & Copyright

Copyright © 2026 Vandanael. All rights reserved.

This project is not open-source. The code is provided for educational and review purposes only.
No unauthorized copying, modification, or commercial redistribution is permitted.
