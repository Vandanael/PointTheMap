import { test, expect } from '@playwright/test';

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

test.skip('submit flow (mocked): play full game and submit score', async ({ page }) => {
  test.setTimeout(60_000);
  let submitCalls = 0;
  if (!isPreviewRun) {
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
  } else if (!e2eBypassToken) {
    throw new Error('E2E_BYPASS_TOKEN is required for preview submit-flow test');
  }

  if (!isPreviewRun) {
    await page.route(/.*\/submit.*/, async (route) => {
      submitCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ score: 12345, rank: 7, isTopFifty: true }),
      });
    });
  } else {
    await page.route(/.*\/submit.*/, async (route) => {
      const headers = { ...route.request().headers(), 'x-e2e-bypass': e2eBypassToken };
      await route.continue({ headers });
    });
  }

  await page.goto('/');
  await page.waitForFunction(
    () =>
      document.body.dataset.appReady === 'true' || document.body.dataset.appInitError === 'true',
    { timeout: 30000 }
  );

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
    await expect
      .poll(async () => page.evaluate(() => !document.body.classList.contains('map-locked')))
      .toBe(true);
    // Ensure no modal is covering the map before clicking
    await expect(page.locator('#round-result')).toBeHidden();
    await expect(page.locator('#result-modal')).toBeHidden();

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
    await page.locator('#map').click({ force: true });
    try {
      await waitForRoundResult();
    } catch {
      await page.waitForTimeout(300);
      await page.locator('#map').click({ force: true });
      await waitForRoundResult();
    }
    if (await page.locator('#round-result').isVisible()) {
      await page.locator('#btn-next').click();
    }
  }

  await expect(page.locator('#pseudo-input')).toBeVisible();
  await page.locator('#pseudo-input').fill('TEST');

  await page.locator('#btn-submit').click();

  if (!isPreviewRun) {
    await expect.poll(async () => submitCalls, { timeout: 15000 }).toBeGreaterThan(0);
  }

  await expect(page.locator('#newRecordLabel')).toBeVisible();
  await expect(page.locator('#newRecordLabel')).toContainText(
    /score saved|top 50|new personal best/i
  );
});
