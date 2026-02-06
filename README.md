# Point The Map

A fast‑paced geography game: find the right location on a blank map under time pressure.

**Live demo:** https://pointthemap.netlify.app/

## Features

- 5 rounds, 5 seconds each
- Multiple modes: Capitals, Countries, Stadiums, Civilizations
- Distance‑based scoring + time bonus (daily modes)
- Global leaderboards
- Mobile‑friendly UI

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Scripts

```bash
npm run dev            # Dev server
npm run build          # Production build + bundle budget
npm run test:run       # Unit tests (Vitest)
npm run e2e:dev        # Playwright smoke (dev)
npm run e2e:preview    # Playwright smoke (build + preview)
```

## Tech Stack

- Vite + Vanilla JS
- Netlify Functions (Node.js)
- Neon (PostgreSQL)
- Vitest + Playwright

## License

MIT
