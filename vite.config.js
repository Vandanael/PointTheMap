import { defineConfig } from "vite";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "dist",
    // Enable minification and compression
    minify: 'esbuild',
    cssMinify: true,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        // Split by change frequency: stable code (core) vs frequently changing (ui)
        manualChunks: (id) => {
          // External dependencies
          if (id.includes('node_modules')) {
            // Leaflet is large and stable - separate chunk for better caching
            if (id.includes('leaflet')) {
              return 'vendor-leaflet';
            }
            // All other node_modules dependencies
            return 'vendor';
          }

          // Application chunks (split by change frequency for better caching)

          // Core: Rarely changes (EventBus, StateManager, ErrorHandler)
          if (id.includes('/src/core/') || id.includes('\\src\\core\\')) {
            return 'core';
          }

          // Game: Moderate changes (game logic, rounds)
          if (id.includes('/src/game/') || id.includes('\\src\\game\\')) {
            return 'game';
          }

          // Systems: Frequent changes (new features, scoring tweaks)
          if (id.includes('/src/systems/') || id.includes('\\src\\systems\\')) {
            return 'systems';
          }

          // UI: Very frequent changes (UI tweaks, components)
          if (id.includes('/src/ui/') || id.includes('\\src\\ui\\')) {
            return 'ui';
          }

          // Features: New features added here
          if (id.includes('/src/features/') || id.includes('\\src\\features\\')) {
            return 'features';
          }

          // Services: API and storage (moderate changes)
          if (id.includes('/src/services/') || id.includes('\\src\\services\\')) {
            return 'services';
          }
        },
        // Optimize asset file names for better caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
      plugins: [
        visualizer({
          open: false,
          filename: "dist/stats.html",
          gzipSize: true,
          brotliSize: true,
        }),
      ],
    },
    // Increase chunk size warning limit (for better code splitting)
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@lib': resolve(__dirname, './lib'),
    },
  },
});
