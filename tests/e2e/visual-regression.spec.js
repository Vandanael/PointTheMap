import { test, expect } from '@playwright/test';
import { ensureAppBootstrapped } from './helpers/app-bootstrap.js';
import { clickMapSafely } from './helpers/map-interactions.js';

const mockCapitals = [
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
];

const freezeAnimations = async (page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
};

test.beforeEach(async ({ page }) => {
  await page.route('**/.netlify/functions/start', async (route) => {
    const session = {
      token: 'visual-token',
      startTime: Date.now(),
      csrfToken: 'visual-csrf-token',
      capitals: mockCapitals,
      targets: mockCapitals,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    });
  });
});

test('visual: start screen', async ({ page }) => {
  await page.goto('/');
  await ensureAppBootstrapped(page);
  await freezeAnimations(page);
  await expect(page.locator('#start-modal')).toBeVisible();
  await expect(page).toHaveScreenshot('start-screen.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});

test('visual: game round', async ({ page }) => {
  await page.goto('/');
  await ensureAppBootstrapped(page);
  await freezeAnimations(page);
  await page.locator('#category-capitals').click();
  await page.locator('#btn-start-game').click();
  await expect(page.locator('#question-modal')).toBeVisible();
  await expect(page.locator('#btn-ready')).toBeVisible();
  await page.locator('#btn-ready').click();
  await expect(page.locator('#game-header')).toBeVisible();
  await expect(page).toHaveScreenshot('game-round.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});

test('visual: round result modal', async ({ page }) => {
  await page.goto('/');
  await ensureAppBootstrapped(page);
  await freezeAnimations(page);
  await page.locator('#category-capitals').click();
  await page.locator('#btn-start-game').click();
  await expect(page.locator('#question-modal')).toBeVisible();
  await expect(page.locator('#btn-ready')).toBeVisible();
  await page.locator('#btn-ready').click();
  await clickMapSafely(page);
  await expect(page.locator('#round-result')).toBeVisible();
  await expect(page).toHaveScreenshot('round-result.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});
