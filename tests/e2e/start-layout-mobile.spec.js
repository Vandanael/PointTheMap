import { test, expect } from '@playwright/test';
import { ensureAppBootstrapped } from './helpers/app-bootstrap.js';

const devices = [
  { name: 'iPhone 13', width: 390, height: 844 },
  { name: 'Pixel 5', width: 393, height: 851 },
];

test.describe('Start screen mobile layout fit', () => {
  for (const device of devices) {
    test(`fits without clipping on ${device.name}`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.goto('/');
      await ensureAppBootstrapped(page);

      await page.locator('#start-skeleton').waitFor({ state: 'detached', timeout: 30000 });
      await expect(page.locator('#start-modal')).toBeVisible();
      await expect(page.locator('#btn-start-game')).toBeVisible();
      await expect(page.locator('#mobile-game-mode-select')).toBeVisible();
      await expect(page.locator('#mode-classic')).toBeVisible();
      await expect(page.locator('#mode-daily')).toBeVisible();

      const layout = await page.evaluate(() => {
        const btn = document.getElementById('btn-start-game');
        const modal = document.getElementById('start-modal');
        const body = document.body;
        if (!btn || !modal) return null;
        const rect = btn.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return {
          btnHeight: rect.height,
          btnFitsHorizontally: rect.left >= 0 && rect.right <= vw,
          btnFitsVertically: rect.top >= 0 && rect.bottom <= vh,
          noHorizontalOverflow: body.scrollWidth <= vw,
          modalFitsViewport: modal.scrollHeight <= vh,
        };
      });

      expect(layout).not.toBeNull();
      expect(layout.btnHeight).toBeGreaterThanOrEqual(56);
      expect(layout.btnFitsHorizontally).toBe(true);
      expect(layout.btnFitsVertically).toBe(true);
      expect(layout.noHorizontalOverflow).toBe(true);
      expect(layout.modalFitsViewport).toBe(true);
    });
  }
});
