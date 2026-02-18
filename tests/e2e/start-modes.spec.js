import { test, expect } from '@playwright/test';
import { ensureAppBootstrapped } from './helpers/app-bootstrap.js';
import { clickMapSafely } from './helpers/map-interactions.js';

const cases = [
  { id: 'category-capitals', label: 'capitals' },
  { id: 'category-countries', label: 'countries' },
  { id: 'category-civilizations', label: 'civilizations' },
  { id: 'category-stadiums', label: 'stadiums' },
];

test.describe('Start screen', () => {
  for (const { id, label } of cases) {
    test(`can start ${label} mode`, async ({ page }) => {
      await page.goto('/');
      await ensureAppBootstrapped(page);

      await page.locator('#start-skeleton').waitFor({ state: 'detached', timeout: 30000 });
      await expect(page.locator('#start-modal')).toBeVisible();

      await page.locator(`#${id}`).click();
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
      await expect
        .poll(async () => {
          const text = await page.locator('#pointsDisplay').textContent();
          return text ? text.replace(/[^\d]/g, '') : '';
        })
        .not.toBe('');
    });
  }
});
