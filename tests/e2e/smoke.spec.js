import { test, expect } from '@playwright/test';
import { ensureAppBootstrapped } from './helpers/app-bootstrap.js';
import { clickMapSafely } from './helpers/map-interactions.js';

test('smoke: can start classic round @smoke', async ({ page }) => {
  await page.goto('/');
  await ensureAppBootstrapped(page);

  await page.locator('#start-skeleton').waitFor({ state: 'detached', timeout: 30000 });
  await expect(page.locator('#start-modal')).toBeVisible();

  await page.locator('#category-capitals').click();
  await page.locator('#btn-start-game').click();

  await expect(page.locator('#question-modal')).toBeVisible();
  await expect(page.locator('#btn-ready')).toBeVisible();
  await expect
    .poll(async () => {
      const text = await page.locator('#capitalName').textContent();
      return text ? text.trim().length : 0;
    })
    .toBeGreaterThan(0);

  await page.locator('#btn-ready').click();
  await expect(page.locator('#game-header')).toBeVisible();
  await expect(page.locator('#timer-bar')).toBeVisible();
  await expect(page.locator('#map')).toBeVisible();

  await clickMapSafely(page);
  await expect(page.locator('#round-result')).toBeVisible();
});
