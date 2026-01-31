# Point The Map

> A fast-paced geography game where you must locate world capitals on a blank map!

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Tests](https://img.shields.io/badge/tests-587%20passing-brightgreen.svg)](#)

**Play now:** [point-the-map.netlify.app](https://point-the-map.netlify.app)

## About

Identify and click on world capitals under time pressure. 5 rounds, 5 seconds each. Score based on accuracy and speed.

### Game Modes
- **Classic**: 5 random capitals
- **Daily Challenge**: Same capitals for everyone each day

## Features

- Interactive Leaflet.js map
- 5-second rounds
- Distance-based scoring (25,000 max)
- Global leaderboards
- Dark/Light theme
- Mobile responsive

## Quick Start

```bash
# Clone and install
git clone https://github.com/Vandanael/PointTheMap.git
cd PointTheMap
npm install

# Start dev server
npm run dev
```

Visit `http://localhost:5173` - No database needed, runs in mock mode!

## Scripts

```bash
npm run dev                 # Development server
npm run build               # Production build
npm test                    # Run tests
npm run test:coverage       # Coverage report
npm run generate:start-screen  # Generate static start-screen images (mobile/tablet/desktop/2k, dark + light) from Carto tiles
```

## Architecture

Event-driven architecture with autonomous systems:

- **EventBus**: Central communication hub
- **Systems**: Timer, Scoring, Map, Validation, UI
- **Pure Functions**: Predictable game logic
- **State Manager**: Centralized state

```javascript
// Example: EventBus usage
eventBus.subscribe('timer:started', (data) => {
  console.log('Timer started!');
});

eventBus.emit('timer:started', { duration: 5000 });
```

## Testing

- **587 tests** passing
- **70%+** coverage
- Unit, integration, and load tests

```bash
npm test              # Watch mode
npm run test:coverage # With coverage
npm run test:ui       # Interactive UI
```


## Tech Stack

**Frontend**: Vanilla JS, Leaflet.js, Tailwind CSS, Vite
**Backend**: Netlify Functions, PostgreSQL
**Testing**: Vitest, Artillery, ESLint

## License

MIT License - Copyright (c) 2026 Vandanael

---

**Made by Vandanael**
