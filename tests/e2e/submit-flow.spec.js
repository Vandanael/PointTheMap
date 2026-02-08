import { test, expect } from '@playwright/test';

const mockCapitals = [
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
];

test('submit flow (mocked): play full game and submit score', async ({ page }) => {
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

  await page.route('**/.netlify/functions/submit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ score: 12345, rank: 7, isTopFifty: true }),
    });
  });

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
      .poll(async () => page.evaluate(() => !document.body.classList.contains('map-locked')))
      .toBe(true);
    await page.locator('#map').click({ position: { x: 200, y: 200 } });
    await expect
      .poll(async () => {
        const roundResult = await page.locator('#round-result').count();
        const gameOver = await page.locator('#result-modal').count();
        return roundResult > 0 || gameOver > 0;
      })
      .toBe(true);
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
