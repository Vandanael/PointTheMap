# PointTheMap

A geography game where you must locate 5 capitals on a blank map within 5 seconds each.

## Description

PointTheMap is an interactive geography quiz game that challenges players to identify and click on the correct locations of world capitals on an interactive map. Each round presents 5 capitals that must be located within a time limit.

## Features

- Interactive map using Leaflet.js
- Time-limited gameplay (5 seconds per capital)
- Global leaderboard powered by Supabase
- Modern, responsive UI with Tailwind CSS
- Dark/Light theme support

## Technologies

- **Leaflet.js** - Interactive map library
- **Tailwind CSS** - Utility-first CSS framework
- **Vanilla JavaScript** - No framework dependencies
- **Supabase** - Backend for global leaderboard
- **Vite** - Build tool and development server

## Getting Started

### Prerequisites

- Node.js (for development)
- A Supabase project (for leaderboard functionality)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/PointTheMap.git
cd PointTheMap
```

2. Install dependencies:
```bash
npm install
```

3. Configure Supabase:
   - Create a Supabase project
   - Set up the database table and security policies (see Supabase documentation)
   - Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `index.html`

### Development

Run the development server:
```bash
npm run dev
```

### Build

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Deployment

The project is static and compatible with GitHub Pages. Push the code to the `main` branch and enable GitHub Pages in the repository settings.

Alternatively, the project can be deployed to any static hosting service (Netlify, Vercel, etc.).

## License

MIT License - Copyright (c) 2024 Vandanael
