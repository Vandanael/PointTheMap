import { test, expect } from '@playwright/test';
import { clickMapSafely } from './helpers/map-interactions.js';

test('country mode loads and accepts a click', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () =>
      document.body.dataset.appReady === 'true' || document.body.dataset.appInitError === 'true',
    { timeout: 30000 }
  );

  await expect(page.locator('#start-modal')).toBeVisible();
  await page.locator('#category-countries').click();
  await page.locator('#btn-start-game').click();

  await expect(page.locator('#question-modal')).toBeVisible();
  await page.locator('#btn-ready').click();

  await expect(page.locator('#map')).toBeVisible();
  await clickMapSafely(page);

  await expect(page.locator('#round-result')).toBeVisible();
});
