import { test, expect } from '@playwright/test';

test('classic flow: start, play, see result', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await page.waitForFunction(
    () => document.body.dataset.appReady === 'true' || document.body.dataset.appInitError === 'true',
    { timeout: 30000 }
  );

  await expect(page.locator('#start-modal')).toBeVisible();
  await page.locator('#category-capitals').click();
  await page.locator('#btn-start-game').click();

  await expect(page.locator('#question-modal')).toBeVisible();
  await page.locator('#btn-ready').click();

  await expect(page.locator('#game-header')).toBeVisible();
  await page.locator('#map').click();

  await expect(page.locator('#round-result')).toBeVisible();
  await expect(page.locator('#pointsDisplay')).toBeVisible();

  // Minimal assertion: no JS errors during core flow
  expect(consoleErrors).toEqual([]);
});

