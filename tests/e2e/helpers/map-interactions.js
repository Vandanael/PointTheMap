import { expect } from '@playwright/test';

export async function waitForMapClickable(page, timeout = 15_000) {
  await expect(page.locator('#map')).toBeVisible({ timeout });

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (el.hasAttribute('hidden')) return false;
            return !el.classList.contains('hidden');
          };

          const body = document.body;
          const questionModal = document.querySelector('#question-modal');
          const startModal = document.querySelector('#start-modal');
          const roundResult = document.querySelector('#round-result');
          const roundTransition = document.querySelector('#round-transition');

          const hasBlockingOverlay =
            isVisible(questionModal) ||
            isVisible(startModal) ||
            isVisible(roundResult) ||
            isVisible(roundTransition);

          return !body.classList.contains('map-locked') && !hasBlockingOverlay;
        }),
      { timeout }
    )
    .toBe(true);
}

export async function clickMapSafely(page, timeout = 15_000) {
  await waitForMapClickable(page, timeout);
  await page.locator('#map').click({ force: true });
}
