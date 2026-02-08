import { test, expect } from '@playwright/test';

const makeSavedState = () => ({
  gameType: 'classic',
  status: 'game_over',
  totalScore: 12345,
  currentRoundIndex: 4,
  runtimeConfig: { roundCount: 5 },
  session: { rounds: [] },
});

test('resume prompt restores game over state', async ({ page }) => {
  await page.addInitScript((payload) => {
    localStorage.setItem('ptm_in_progress_game', JSON.stringify(payload));
  }, {
    state: makeSavedState(),
    savedAt: Date.now(),
  });

  await page.goto('/');

  await expect(page.locator('#resume-modal')).toBeVisible();
  await page.locator('#btn-resume-continue').click();

  await expect(page.locator('#result-modal')).toBeVisible();
  await expect(page.locator('#finalScoreDisplay')).toContainText('pts');
});

test('resume prompt discard clears saved state', async ({ page }) => {
  await page.addInitScript((payload) => {
    localStorage.setItem('ptm_in_progress_game', JSON.stringify(payload));
  }, {
    state: makeSavedState(),
    savedAt: Date.now(),
  });

  await page.goto('/');

  await expect(page.locator('#resume-modal')).toBeVisible();
  await page.locator('#btn-resume-discard').click();

  await expect(page.locator('#start-modal')).toBeVisible();

  const hasSavedState = await page.evaluate(() =>
    Boolean(localStorage.getItem('ptm_in_progress_game'))
  );
  expect(hasSavedState).toBe(false);
});
