import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { visualizer } from 'rollup-plugin-visualizer';

/** Inlines critical CSS and loads full stylesheet async to shorten the critical request chain (avoids blocking LCP). */
function criticalCssPreload() {
  const criticalPath = resolve(process.cwd(), 'src/critical.css');
  let criticalCss = '';
  try {
    criticalCss = readFileSync(criticalPath, 'utf-8');
  } catch {
    criticalCss = '/* critical.css not found */';
  }
  const inlineCritical = `<style>${criticalCss.replace(/<\/style>/gi, '\\3c/style>')}</style>`;

  return {
    name: 'critical-css-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const styleTagRe = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g;
        const tags = [];
        let m;
        while ((m = styleTagRe.exec(html)) !== null) tags.push({ full: m[0], href: m[1] });
        if (!tags.length) return html;
        const local = tags.filter((t) => t.href.startsWith('/'));
        if (!local.length) return html;

        // Preload full CSS so it fetches early; load async so it does not block first paint.
        const preloads = local
          .map((t) => `<link rel="preload" href="${t.href}" as="style">`)
          .join('\n  ');
        const asyncStyles = local
          .map(
            (t) =>
              `<link rel="stylesheet" href="${t.href}" media="print" onload="this.media='all'">`
          )
          .join('\n  ');
        const noscriptFallback = local
          .map((t) => `<link rel="stylesheet" href="${t.href}">`)
          .join('');
        const noscript = `<noscript>${noscriptFallback}</noscript>`;

        let out = html;
        for (const t of local) out = out.replace(t.full, '');
        out = out.replace(
          /(<head[^>]*>)/i,
          `$1\n  ${inlineCritical}\n  ${preloads}\n  ${asyncStyles}\n  ${noscript}`
        );
        return out;
      },
    },
  };
}

/** Inline tiny entry chunks to remove a critical JS request on first paint. */
function inlineSmallEntry({ maxSize = 10 * 1024 } = {}) {
  return {
    name: 'inline-small-entry',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx?.bundle;
        if (!bundle) return html;

        const entryChunk = Object.values(bundle).find(
          (chunk) => chunk.type === 'chunk' && chunk.isEntry
        );
        if (!entryChunk) return html;
        if (entryChunk.code.length > maxSize) return html;

        const entryFile = `/${entryChunk.fileName}`;
        const escapedCode = entryChunk.code.replace(/<\/script>/gi, '<\\/script>');

        let out = html;
        // Remove modulepreload for the inlined entry.
        out = out.replace(
          new RegExp(`<link[^>]+rel="modulepreload"[^>]+href="${entryFile}"[^>]*>\\n?`, 'g'),
          ''
        );
        // Replace the entry script tag with an inline module.
        out = out.replace(
          new RegExp(`<script[^>]+type="module"[^>]+src="${entryFile}"[^>]*><\\/script>`),
          `<script type="module">${escapedCode}</script>`
        );

        return out;
      },
    },
  };
}

export default defineConfig({
  // Enable bundle visualizer with ANALYZE=1
  publicDir: 'public',
  server: {
    // Disable HMR when WebSocket gets 400 (e.g. Cursor browser, embedded iframes).
    // Use: DISABLE_HMR=1 npm run dev
    hmr: process.env.DISABLE_HMR === '1' ? false : true,
  },
  build: {
    outDir: 'dist',
    // Enable minification and compression
    minify: 'esbuild',
    cssMinify: true,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        // Split by change frequency; cyclic pairs grouped to avoid circular chunk warnings:
        // - core ↔ services (core→i18n→storage, services→EventBus/ErrorHandler)
        // - ui ↔ systems (ui→ScoringSystem, UISystem→UI)
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

          // Application chunks (cyclic pairs merged to break circular chunk warnings)

          // Core + Services: single chunk to avoid services→core→i18n→services cycle
          if (id.includes('vite/preload-helper.js')) {
            return 'core-services';
          }
          if (id.includes('/src/i18n.js') || id.includes('\\src\\i18n.js')) {
            return 'core-services';
          }
          if (id.includes('/src/utils.js') || id.includes('\\src\\utils.js')) {
            return 'core-services';
          }
          if (id.includes('/src/core/') || id.includes('\\src\\core\\')) {
            return 'core-services';
          }
          if (id.includes('/src/services/') || id.includes('\\src\\services\\')) {
            return 'core-services';
          }

          // Game: Moderate changes (game logic, rounds)
          if (id.includes('/src/game/') || id.includes('\\src\\game\\')) {
            return 'game';
          }

          // UI + Systems (+ Features): single chunk to avoid ui↔systems and features↔ui cycles
          if (id.includes('/src/systems/') || id.includes('\\src\\systems\\')) {
            return 'ui-systems';
          }
          if (id.includes('/src/ui/') || id.includes('\\src\\ui\\')) {
            return 'ui-systems';
          }
          if (id.includes('/src/features/') || id.includes('\\src\\features\\')) {
            return 'ui-systems';
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
      plugins:
        process.env.ANALYZE === '1'
          ? [
              visualizer({
                open: false,
                filename: 'dist/stats.html',
                gzipSize: true,
                brotliSize: true,
              }),
            ]
          : [],
    },
    // Increase chunk size warning limit (for better code splitting)
    chunkSizeWarningLimit: 1000,
  },
  plugins: [criticalCssPreload(), inlineSmallEntry()],
  resolve: {
    alias: {
      '@lib': resolve(__dirname, './lib'),
    },
  },
});
