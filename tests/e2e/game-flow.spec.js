import { test, expect } from '@playwright/test';
import { ensureAppBootstrapped } from './helpers/app-bootstrap.js';
import { clickMapSafely } from './helpers/map-interactions.js';

test('classic flow: start, play, see result', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore Netlify deploy-preview drawer CSP errors (not a bug in app code)
      if (text.includes('app.netlify.com')) return;
      consoleErrors.push(text);
    }
  });

  await page.goto('/');
  await ensureAppBootstrapped(page);

  await expect(page.locator('#start-modal')).toBeVisible();
  await page.locator('#category-capitals').click();
  await page.locator('#btn-start-game').click();

  await expect(page.locator('#question-modal')).toBeVisible();
  await page.locator('#btn-ready').click();

  await expect(page.locator('#game-header')).toBeVisible();
  await clickMapSafely(page);

  await expect(page.locator('#round-result')).toBeVisible();
  await expect(page.locator('#pointsDisplay')).toBeVisible();

  // Minimal assertion: no JS errors during core flow
  expect(consoleErrors).toEqual([]);
});
