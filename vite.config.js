import { defineConfig } from "vite";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";

/** Injects preload hints and moves critical CSS to the start of <head> to shorten the critical request chain. */
function criticalCssPreload() {
  return {
    name: "critical-css-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const styleTagRe = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g;
        const tags = [];
        let m;
        while ((m = styleTagRe.exec(html)) !== null) tags.push({ full: m[0], href: m[1] });
        if (!tags.length) return html;
        const local = tags.filter((t) => t.href.startsWith("/"));
        if (!local.length) return html;
        // No crossorigin: stylesheet requests use same-origin credentials by default;
        // the preload must match to be consumed by the browser.
        const preloads = local.map((t) => `<link rel="preload" href="${t.href}" as="style">`).join("\n  ");
        const stylesheets = local.map((t) => t.full).join("\n  ");
        let out = html;
        for (const t of local) out = out.replace(t.full, "");
        out = out.replace(/(<head[^>]*>)/i, `$1\n  ${preloads}\n  ${stylesheets}`);
        return out;
      },
    },
  };
}

export default defineConfig({
  publicDir: "public",
  server: {
    // Disable HMR when WebSocket gets 400 (e.g. Cursor browser, embedded iframes).
    // Use: DISABLE_HMR=1 npm run dev
    hmr: process.env.DISABLE_HMR === "1" ? false : true,
  },
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
  plugins: [criticalCssPreload()],
  resolve: {
    alias: {
      '@lib': resolve(__dirname, './lib'),
    },
  },
});
