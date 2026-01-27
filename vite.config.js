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
        manualChunks: (id) => {
          // Check if module is in core directory
          if (id.includes('/src/core/') || id.includes('\\src\\core\\')) {
            return 'vendor-core';
          }
          // Check if module is in game directory
          if (id.includes('/src/game/') || id.includes('\\src\\game\\')) {
            return 'vendor-game';
          }
          // Check if module is in systems directory
          if (id.includes('/src/systems/') || id.includes('\\src\\systems\\')) {
            return 'vendor-systems';
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
