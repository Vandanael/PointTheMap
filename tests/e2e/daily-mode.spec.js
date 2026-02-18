import { test, expect } from '@playwright/test';
import { ensureAppBootstrapped } from './helpers/app-bootstrap.js';

const mockCapitals = [
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
];

test('daily mode: can start daily challenge', async ({ page }) => {
  await page.route('**/.netlify/functions/start', async (route) => {
    const session = {
      token: 'daily-token',
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

  await page.goto('/');
  await ensureAppBootstrapped(page);

  await expect(page.locator('#start-modal')).toBeVisible();
  await page.locator('#category-capitals').click();
  await page.locator('#mode-daily').click();
  await page.locator('#btn-start-game').click();

  await expect(page.locator('#question-modal')).toBeVisible();
  await expect(page.locator('#btn-ready')).toBeVisible();
});
