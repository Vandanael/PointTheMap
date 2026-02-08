import { test, expect } from '@playwright/test';

test('smoke: can start classic round @smoke', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.stack || err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    consoleErrors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText || ''}`);
  });

  await page.goto('/');
  try {
    await page.waitForFunction(
      () =>
        document.body.dataset.appReady === 'true' ||
        document.body.dataset.appInitError === 'true',
      { timeout: 30000 }
    );
  } catch (err) {
    throw new Error(
      `App readiness timeout: ${JSON.stringify({
        err: String(err),
        pageErrors,
        consoleErrors,
      })}`
    );
  }

  const initError = await page.evaluate(() =>
    document.body.dataset.appInitError === 'true'
      ? // @ts-ignore - debug signal for e2e
        window.__appInitError || 'Unknown init error'
      : null
  );
  if (initError) {
    const details = {
      initError,
      pageErrors,
      consoleErrors,
    };
    throw new Error(`App init failed: ${JSON.stringify(details)}`);
  }

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

  await page.locator('#map').click();
  await expect(page.locator('#round-result')).toBeVisible();
});
