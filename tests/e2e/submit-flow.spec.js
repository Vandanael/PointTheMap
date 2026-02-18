import { test, expect } from '@playwright/test';
import { ensureAppBootstrapped } from './helpers/app-bootstrap.js';
import { clickMapSafely } from './helpers/map-interactions.js';

const mockCapitals = [
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
];

const isPreviewRun =
  process.env.E2E_MODE === 'preview' ||
  (process.env.E2E_BASE_URL &&
    !process.env.E2E_BASE_URL.includes('127.0.0.1') &&
    !process.env.E2E_BASE_URL.includes('localhost'));
const e2eBypassToken = process.env.E2E_BYPASS_TOKEN || '';
const useMockApi = !isPreviewRun || !e2eBypassToken;

test('submit flow (mocked): play full game and submit score', async ({ page }) => {
  test.setTimeout(120_000);
  if (useMockApi) {
    await page.route('**/.netlify/functions/start', async (route) => {
      const session = {
        token: 'test-token',
        startTime: Date.now(),
        csrfToken: 'csrf-token',
        capitals: mockCapitals,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      });
    });
  }

  if (useMockApi) {
    await page.route('**/.netlify/functions/submit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ score: 12345, rank: 7, isTopFifty: true }),
      });
    });
  } else {
    await page.route('**/.netlify/functions/submit*', async (route) => {
      const headers = { ...route.request().headers(), 'x-e2e-bypass': e2eBypassToken };
      await route.continue({ headers });
    });
  }

  await page.goto('/');
  await ensureAppBootstrapped(page, 60_000);

  await expect(page.locator('#start-modal')).toBeVisible();
  await page.locator('#category-capitals').click();
  await page.locator('#btn-start-game').click();

  await expect(page.locator('#question-modal')).toBeVisible();
  await page.locator('#btn-ready').click();

  for (let round = 0; round < 5; round += 1) {
    await expect(page.locator('#game-header')).toBeVisible();
    if (await page.locator('#question-modal').isVisible()) {
      if (await page.locator('#btn-ready').isVisible()) {
        await page.locator('#btn-ready').click();
      } else {
        await page.locator('#question-modal').click();
      }
      await expect(page.locator('#question-modal')).toBeHidden();
    }
    await expect
      .poll(async () => {
        const transition = page.locator('#round-transition');
        if ((await transition.count()) === 0) return true;
        return !(await transition.isVisible());
      })
      .toBe(true);
    const waitForRoundResult = async () => {
      await expect
        .poll(
          async () => {
            const roundResultVisible = await page.locator('#round-result').isVisible();
            const gameOverVisible = await page.locator('#result-modal').isVisible();
            return roundResultVisible || gameOverVisible;
          },
          { timeout: 15000 }
        )
        .toBe(true);
    };

    // Click map (retry once if the click doesn't register)
    await clickMapSafely(page);
    try {
      await waitForRoundResult();
    } catch {
      await page.waitForTimeout(300);
      await clickMapSafely(page);
      await waitForRoundResult();
    }
    if (await page.locator('#round-result').isVisible()) {
      await page.locator('#btn-next').click();
    }
  }

  await expect(page.locator('#pseudo-input')).toBeVisible();
  await page.locator('#pseudo-input').fill('TEST');

  await page.locator('#btn-submit').click();

  await expect(page.locator('#newRecordLabel')).toBeVisible();
  await expect(page.locator('#newRecordLabel')).toContainText(
    /score saved|top 50|new personal best/i
  );
});
