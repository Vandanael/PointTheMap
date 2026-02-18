import { test, expect } from '@playwright/test';
import { ensureAppBootstrapped } from './helpers/app-bootstrap.js';
import { clickMapSafely } from './helpers/map-interactions.js';

const mobileCases = [
  { category: 'capitals', label: 'classic capitals' },
  { category: 'capitals', daily: true, label: 'daily capitals' },
  { category: 'countries', label: 'classic countries' },
  { category: 'stadiums', label: 'classic stadiums' },
  { category: 'civilizations', label: 'classic civilizations' },
];

test.describe('Start screen (mobile dropdown)', () => {
  for (const { category, daily, label } of mobileCases) {
    test(`can start ${label} from mobile dropdown`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await ensureAppBootstrapped(page);

      await page.locator('#start-skeleton').waitFor({ state: 'detached', timeout: 30000 });
      await expect(page.locator('#start-modal')).toBeVisible();

      const modeSelect = page.locator('#mobile-game-mode-select');
      await expect(modeSelect).toBeVisible();
      await modeSelect.selectOption(category);

      const dailyToggle = page.locator('#mode-daily');
      const classicToggle = page.locator('#mode-classic');
      await expect(dailyToggle).toBeVisible();
      await expect(classicToggle).toBeVisible();
      if (daily) {
        await dailyToggle.click();
      } else {
        await classicToggle.click();
      }

      await page.locator('#btn-start-game').click();

      await expect(page.locator('#question-modal')).toBeVisible();
      await expect(page.locator('#btn-ready')).toBeVisible();
      await page.locator('#btn-ready').click();
      await expect(page.locator('#game-header')).toBeVisible();

      await clickMapSafely(page);
      await expect(page.locator('#round-result')).toBeVisible();
    });
  }
});
