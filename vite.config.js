import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import https from 'https';
import { visualizer } from 'rollup-plugin-visualizer';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Inlines critical CSS and loads full stylesheet async to shorten the critical request chain (avoids blocking LCP). */
function criticalCssPreload({ enabled = true } = {}) {
  if (!enabled) return null;
  const criticalPath = resolve(process.cwd(), 'src/styles/critical.css');
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

function fetchUrlToFile(url, destination, maxRedirects = 3) {
  return new Promise((resolvePromise, reject) => {
    const request = https.get(url, (res) => {
      const status = res.statusCode || 0;
      const location = res.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location && maxRedirects > 0) {
        res.resume();
        const nextUrl = new URL(location, url).toString();
        return resolvePromise(fetchUrlToFile(nextUrl, destination, maxRedirects - 1));
      }
      if (status < 200 || status >= 300) {
        res.resume();
        return reject(new Error(`Failed to fetch ${url} (status ${status})`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        writeFileSync(destination, Buffer.concat(chunks));
        resolvePromise();
      });
    });

    request.on('error', reject);
  });
}

function ensureLocalPlausibleScript() {
  const plausibleUrl = 'https://plausible.io/js/pa-MWj6kC9TpD2-BKb6Pm-XK.js';
  const localDir = resolve(process.cwd(), 'public/vendor');
  const localPath = resolve(localDir, 'plausible.js');

  if (existsSync(localPath) && process.env.PLAUSIBLE_REFRESH !== '1') {
    return Promise.resolve();
  }

  mkdirSync(localDir, { recursive: true });
  return fetchUrlToFile(plausibleUrl, localPath);
}

function plausibleAnalyticsLocal({ strictCsp = false } = {}) {
  const inlineInit = `((window.plausible =
        window.plausible ||
        function () {
          (plausible.q = plausible.q || []).push(arguments);
        }),
        (plausible.init =
          plausible.init ||
          function (i) {
            plausible.o = i || {};
          }));
      plausible.init();`;

  let enabled = true;

  return {
    name: 'plausible-analytics-local',
    apply: 'build',
    async buildStart() {
      if (process.env.PLAUSIBLE_DISABLED === '1') return;
      try {
        await ensureLocalPlausibleScript();
        if (strictCsp) {
          const localDir = resolve(process.cwd(), 'public/vendor');
          const initPath = resolve(localDir, 'plausible-init.js');
          mkdirSync(localDir, { recursive: true });
          writeFileSync(initPath, `${inlineInit}\n`);
        }
      } catch (error) {
        enabled = false;
        this.warn(`Plausible script download failed; analytics disabled. ${error.message}`);
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (process.env.PLAUSIBLE_DISABLED === '1' || !enabled) return html;
        const snippet = strictCsp
          ? [
              '<!-- Privacy-friendly analytics by Plausible (local copy) -->',
              '<script async src="/vendor/plausible.js"></script>',
              '<script src="/vendor/plausible-init.js"></script>',
            ].join('\n    ')
          : [
              '<!-- Privacy-friendly analytics by Plausible (local copy) -->',
              '<script async src="/vendor/plausible.js"></script>',
              `<script>${inlineInit}</script>`,
            ].join('\n    ');
        return html.replace(/<\/head>/i, `  ${snippet}\n  </head>`);
      },
    },
  };
}

const devCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
  "connect-src 'self' ws: http://localhost:5173 http://localhost:5174 http://localhost:5190 http://localhost:8888 https://plausible.io",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** Inline tiny entry chunks to remove a critical JS request on first paint. */
function inlineSmallEntry({ maxSize = 10 * 1024, enabled = true } = {}) {
  if (!enabled) return null;
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

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    // Enable bundle visualizer with ANALYZE=1
    publicDir: 'public',
    server: {
      // Disable HMR when WebSocket gets 400 (e.g. Cursor browser, embedded iframes).
      // Use: DISABLE_HMR=1 npm run dev
      port: 5190,
      strictPort: true,
      hmr: process.env.DISABLE_HMR === '1' ? false : true,
      headers: {
        'Content-Security-Policy': devCsp,
        'X-Frame-Options': 'DENY',
      },
    },
    preview: {
      headers: {
        'Content-Security-Policy': devCsp,
        'X-Frame-Options': 'DENY',
      },
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
    esbuild: isProd ? { pure: ['console.log', 'console.warn'] } : undefined,
    plugins: [
      criticalCssPreload({ enabled: process.env.STRICT_CSP !== '1' }),
      inlineSmallEntry({ enabled: process.env.STRICT_CSP !== '1' }),
      plausibleAnalyticsLocal({ strictCsp: process.env.STRICT_CSP === '1' }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@lib': resolve(__dirname, './lib'),
      },
    },
  };
});
