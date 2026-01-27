# 🗺️ Point The Map

> A fast-paced geography game where you must locate world capitals on a blank map within seconds!

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Tests](https://img.shields.io/badge/tests-583%20passing-brightgreen.svg)](./docs/testing.md)
[![Coverage](https://img.shields.io/badge/coverage-70.19%25-yellow.svg)](./docs/testing.md)

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

## 🎮 Overview

Point The Map is an interactive geography quiz game that challenges players to identify and click on the correct locations of world capitals on an interactive map. Each game consists of 10 rounds where players must quickly and accurately locate capitals under time pressure.

**Play now:** [point-the-map.netlify.app](https://point-the-map.netlify.app)

### Game Modes

- **Classic Mode**: Locate 10 random capitals with 10 seconds per round
- **Daily Challenge**: Everyone gets the same capitals each day
- **Practice Mode**: Unlimited time to learn capital locations

### Scoring System

Your score is based on:
- **Distance accuracy**: Closer clicks = higher points (10,000 max)
- **Speed bonus**: Faster responses = bonus multiplier
- **Streak bonus**: Consecutive correct answers increase your multiplier

## ✨ Features

### Core Gameplay
- 🗺️ Interactive map powered by Leaflet.js
- ⏱️ Time-limited rounds (10 seconds per capital)
- 🎯 Precision-based scoring system
- 🏆 Global and daily leaderboards
- 📊 Real-time score animations
- 💾 Offline support with retry queue

### User Experience
- 🎨 Dark/Light theme support with system preference detection
- 📱 Fully responsive design (mobile, tablet, desktop)
- ♿ Accessibility-focused (keyboard navigation, ARIA labels)
- 🚀 Lightning-fast performance (<25kb bundle)
- 🔄 Progressive Web App capabilities

### Technical Features
- 🏗️ Event-driven architecture (EventBus pattern)
- 🎯 Entity-Component-System inspired design
- 🧪 70%+ test coverage (583 tests)
- 🔒 Security hardened (XSS, CSRF protection)
- 📈 Performance optimized (Lighthouse 95+)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for development)
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/Vandanael/PointTheMap.git
cd PointTheMap

# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs in **mock mode** locally, so no database or API configuration is needed for development!

Visit `http://localhost:5173` to play the game.

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm run preview          # Preview production build

# Testing
npm test                 # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Generate coverage report
npm run test:ui          # Open Vitest UI

# Load Testing
npm run test:load        # Run load test against production
npm run test:load:local  # Run load test against local server
npm run test:load:report # Generate HTML load test report

# Utilities
npm run generate:og-image  # Generate social media preview image
```

## 🏗️ Architecture

Point The Map follows a modern, event-driven architecture inspired by Entity-Component-System (ECS) patterns.

### High-Level Structure

```
src/
├── core/              # Core framework (EventBus, StateManager)
├── config/            # Configuration constants
├── game/              # Game logic (pure functions)
├── systems/           # Game systems (Timer, Scoring, Validation, etc.)
├── ui/                # UI components and controllers
├── services/          # External services (API, Storage)
├── utils/             # Utilities (logger, performance, math)
└── storage/           # Storage abstraction layer
```

### Key Architectural Patterns

#### 1. EventBus Pattern

All components communicate via a central EventBus, eliminating tight coupling:

```javascript
// Subscribe to events
eventBus.subscribe('timer:started', () => {
  console.log('Timer started!');
});

// Emit events
eventBus.emit('timer:started', { duration: 10000 });
```

**Benefits:**
- Decoupled components
- Easy to test in isolation
- Extensible without modifying existing code

#### 2. Systems Architecture

Game logic is organized into autonomous systems:

- **TimerSystem**: Manages round timers and danger zones
- **ScoringSystem**: Calculates scores based on distance and speed
- **ValidationSystem**: Validates user inputs and game state
- **MapSystem**: Manages Leaflet map interactions
- **InputSystem**: Handles user input events
- **UISystem**: Synchronizes UI with game state

Each system:
- Subscribes to relevant events
- Processes data independently
- Emits results for other systems

#### 3. Pure Functional Game Logic

Core game logic in `src/game/` uses pure functions for predictability and testability:

```javascript
// Pure function - no side effects
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  return haversineDistance(lat1, lng1, lat2, lng2);
};

// State transitions are explicit
export const nextRound = (state) => {
  return {
    ...state,
    currentRoundIndex: state.currentRoundIndex + 1,
    status: state.currentRoundIndex >= 9 ? 'game_over' : 'playing'
  };
};
```

### Data Flow

```
User Action → EventBus → Systems → State Update → UI Update
     ↑                                                ↓
     └────────────────────────────────────────────────┘
```

For more details, see [Architecture Documentation](./docs/ARCHITECTURE.md).

## 💻 Development

### Project Structure

```
point-the-map/
├── src/
│   ├── core/              # EventBus, StateManager
│   ├── game/              # Game logic (Game.js, Map.js)
│   ├── systems/           # Game systems
│   ├── ui/                # UI components
│   ├── services/          # API, Storage services
│   └── utils/             # Helpers
├── netlify/
│   ├── functions/         # Serverless API endpoints
│   └── database/          # Database schema
├── docs/                  # Documentation
├── public/                # Static assets
└── tests/                 # Test files
```

### Development Workflow

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Make your changes**
   - Code is auto-formatted with Prettier
   - ESLint validates code quality
   - Hot module reload for instant feedback

3. **Write tests:**
   ```bash
   npm test
   ```

4. **Run linting:**
   ```bash
   npm run lint
   ```

5. **Build and preview:**
   ```bash
   npm run build
   npm run preview
   ```

### Mock Mode

In development, the app runs in mock mode (no API calls):

- Mock data is generated for capitals
- Scores are calculated locally
- Leaderboard shows dummy data
- Perfect for rapid development!

To test with real API:
```javascript
// src/config.js
export const USE_MOCK = false; // Set to false
```

### Hot Reload

Vite provides instant hot module replacement:
- CSS changes apply instantly
- JavaScript changes preserve state when possible
- Map state is maintained across reloads

## 🧪 Testing

Point The Map has comprehensive test coverage across unit, integration, and load testing.

### Test Coverage

- **Total Tests**: 583 passing
- **Coverage**: 70.19%
  - `src/game`: 99.26% ✅
  - `src/systems`: 95.72% ✅
  - `src/services`: 81.75% ✅

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run once with coverage
npm run test:coverage

# Open interactive UI
npm run test:ui

# Run specific test file
npm test Game.test.js
```

### Test Organization

```
src/
├── game/
│   ├── Game.js
│   └── Game.test.js          # Unit tests
├── systems/
│   ├── TimerSystem.js
│   └── TimerSystem.test.js   # System tests
└── integration.test.js        # Integration tests
```

### Writing Tests

We use Vitest with happy-dom for DOM testing:

```javascript
import { describe, it, expect, vi } from 'vitest';

describe('ScoringSystem', () => {
  it('should calculate score based on distance', () => {
    const score = calculateScore(0, 10000); // 0km distance
    expect(score).toBe(10000);
  });
});
```

### Load Testing

Test performance under load with Artillery:

```bash
# Test against production
npm run test:load

# Test locally
npm run test:load:local

# Generate HTML report
npm run test:load:report
```

See [Load Testing Guide](./docs/load-testing.md) for details.

### Security Testing

Security audit report: [docs/security-audit.md](./docs/security-audit.md)

- ✅ XSS Protection
- ✅ Input Validation
- ⚠️ CSRF Protection (recommendations provided)
- ✅ Rate Limiting

## 🚀 Deployment

### Netlify Deployment (Recommended)

1. **Connect your repository:**
   - Push code to GitHub
   - Connect to Netlify
   - Auto-deploy on push!

2. **Configure environment variables:**
   ```
   NETLIFY_DATABASE_URL=postgresql://...
   ```

3. **Database setup:**
   ```bash
   # Run migrations in Neon database
   psql $DATABASE_URL -f netlify/database/schema.sql
   ```

### Database Schema

Required tables:
- `capitals` - World capitals data
- `sessions` - Game sessions
- `scores` - Leaderboard entries

See [netlify/database/schema.sql](./netlify/database/schema.sql) for full schema.

### Environment Variables

```env
# Production
NETLIFY_DATABASE_URL=postgresql://user:pass@host/db

# Optional
SENTRY_DSN=https://...              # Error tracking
ANALYTICS_ID=UA-...                 # Google Analytics
```

### Build Configuration

Netlify auto-detects Vite configuration:

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## ⚡ Performance

Point The Map is optimized for speed:

### Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Bundle Size | <25kb | 24.3kb ✅ |
| LCP (Mobile) | <1.5s | 1.2s ✅ |
| FCP | <1.0s | 0.8s ✅ |
| Lighthouse Score | 95+ | 96 ✅ |

### Optimizations Applied

1. **Code Splitting**: Dynamic imports for heavy components
2. **Tree Shaking**: Unused code eliminated at build time
3. **Image Optimization**: WebP with fallback, lazy loading
4. **Debouncing**: Throttled event handlers
5. **Request Batching**: API calls optimized
6. **Service Worker**: Offline-first with retry queue

### Performance Tips

- Use Chrome DevTools Performance tab to profile
- Check bundle size: `npm run build -- --mode analyze`
- Monitor Core Web Vitals in production
- Run Lighthouse audits regularly

See [Performance Guide](./docs/performance.md) for optimization details.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Quick Contribution Guide

1. **Fork the repository**
2. **Create a feature branch:**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Write/update tests**
5. **Run tests:**
   ```bash
   npm test
   npm run test:coverage
   ```
6. **Commit your changes:**
   ```bash
   git commit -m "Add amazing feature"
   ```
7. **Push to your fork:**
   ```bash
   git push origin feature/amazing-feature
   ```
8. **Open a Pull Request**

### Code Style

- Use ESLint for linting
- Follow existing code patterns
- Write tests for new features
- Document public APIs with JSDoc
- Keep functions pure when possible

### Commit Messages

Follow conventional commits:
```
feat: add daily challenge mode
fix: resolve timer memory leak
docs: update architecture guide
test: add integration tests for scoring
```

## 📚 Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Testing Guide](./docs/testing.md)
- [Load Testing Guide](./docs/load-testing.md)
- [Security Audit](./docs/security-audit.md)
- [Migration Guide](./docs/MIGRATION.md)
- [Performance Optimization](./docs/performance.md)

## 🔧 Technologies

### Frontend
- **Vanilla JavaScript** - No framework overhead
- **Leaflet.js** - Interactive maps
- **Tailwind CSS** - Utility-first styling
- **Vite** - Lightning-fast build tool

### Backend
- **Netlify Functions** - Serverless API
- **Neon Database** - Serverless PostgreSQL
- **Node.js** - Runtime environment

### Testing & Quality
- **Vitest** - Fast unit testing
- **Happy-DOM** - Lightweight DOM for tests
- **Artillery** - Load testing
- **ESLint** - Code quality

### DevOps
- **GitHub Actions** - CI/CD (optional)
- **Netlify** - Hosting & deployment
- **Sentry** - Error tracking (optional)

## 📄 License

MIT License - Copyright (c) 2026 Vandanael

See [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- Map tiles from [OpenStreetMap](https://www.openstreetmap.org/)
- Geography data from various open sources
- Inspired by geography quiz games worldwide

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Vandanael/PointTheMap/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Vandanael/PointTheMap/discussions)

---

**Made with ❤️ by Vandanael**

*Happy mapping!* 🗺️
