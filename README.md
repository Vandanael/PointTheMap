# PointTheMap

A geography game where you must locate 5 capitals on a blank map within 5 seconds each.

## Description

PointTheMap is an interactive geography quiz game that challenges players to identify and click on the correct locations of world capitals on an interactive map. Each round presents 5 capitals that must be located within a time limit.

## Features

- Interactive map using Leaflet.js
- Time-limited gameplay (5 seconds per capital)
- Global leaderboard powered by Neon Database (PostgreSQL)
- Modern, responsive UI with Tailwind CSS
- Dark/Light theme support

## Technologies

- **Leaflet.js** - Interactive map library
- **Tailwind CSS** - Utility-first CSS framework
- **Vanilla JavaScript** - No framework dependencies
- **Neon Database** - PostgreSQL database for leaderboard, sessions and game data
- **Netlify Functions** - Serverless functions for game logic
- **Vite** - Build tool and development server

## Getting Started

### Prerequisites

- Node.js (for development)
- Netlify account (for deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Vandanael/PointTheMap.git
cd PointTheMap
```

2. Install dependencies:
```bash
npm install
```

### Development

Run the development server:
```bash
npm run dev
```

The app runs in mock mode locally (no API calls needed).

### Build

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run generate:og-image` - Generate Open Graph image for social sharing

## Deployment

The project is designed for Netlify deployment:

1. Push your code to a Git repository
2. Connect your repository to Netlify
3. Netlify will automatically detect and deploy the site
4. Netlify Functions will handle the API endpoints automatically

The leaderboard and game sessions are stored in Neon Database (PostgreSQL). A database must be configured in your Netlify project.

### Database Setup

1. Create a Neon PostgreSQL database
2. Run the schema migration: `netlify/database/schema.sql`
3. Run additional migrations if needed (e.g., `migration_add_ip_index.sql`)
4. Configure `NETLIFY_DATABASE_URL` in your Netlify environment variables

## License

MIT License - Copyright (c) 2026 Vandanael
