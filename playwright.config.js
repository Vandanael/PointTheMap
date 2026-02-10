import { defineConfig } from '@playwright/test';

const isPreview = process.env.E2E_MODE === 'preview';
const port = isPreview ? 4173 : 5173;
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

const webServerCommand = isPreview
  ? 'VITE_USE_MOCK=true npm run build && VITE_USE_MOCK=true npm run preview -- --host 127.0.0.1 --port 4173'
  : 'npm run dev -- --host 127.0.0.1 --port 5173';
const shouldUseWebServer = !(isPreview && process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: shouldUseWebServer
    ? {
        command: webServerCommand,
        url: baseURL,
        reuseExistingServer: !isPreview,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
