import { test, expect } from '@playwright/test';

test('about page loads and toggles work @smoke', async ({ page }) => {
  // Navigate to about page
  await page.goto('/about.html');

  // Wait for page to load
  await expect(page.locator('h1')).toBeVisible();

  // Verify default is English
  await expect(page.locator('#content-en')).toBeVisible();
  await expect(page.locator('#content-fr')).toHaveClass(/hidden/);

  // Test language toggle
  await page.locator('#btn-lang').click();

  // Should now show French
  await expect(page.locator('#content-fr')).toBeVisible();
  await expect(page.locator('#content-en')).toHaveClass(/hidden/);
  await expect(page.locator('#lang-icon')).toHaveText('FR');

  // Toggle back to English
  await page.locator('#btn-lang').click();
  await expect(page.locator('#content-en')).toBeVisible();
  await expect(page.locator('#lang-icon')).toHaveText('EN');

  // Test theme toggle (default is dark)
  await expect(page.locator('body')).not.toHaveClass(/light-theme/);
  await expect(page.locator('#theme-icon')).toHaveText('🌙');

  // Toggle to light theme
  await page.locator('#btn-theme').click();
  await expect(page.locator('body')).toHaveClass(/light-theme/);
  await expect(page.locator('#theme-icon')).toHaveText('☀️');

  // Toggle back to dark
  await page.locator('#btn-theme').click();
  await expect(page.locator('body')).not.toHaveClass(/light-theme/);
  await expect(page.locator('#theme-icon')).toHaveText('🌙');
});

test('about page share button works', async ({ page }) => {
  await page.goto('/about.html');

  // Grant clipboard permissions
  await page.context().grantPermissions(['clipboard-write', 'clipboard-read']);

  // Dismiss Netlify deploy-preview drawer if present (it intercepts pointer events)
  await page.evaluate(() => {
    const drawer = document.querySelector('iframe[title="Netlify Drawer"]');
    if (drawer) drawer.style.display = 'none';
  });

  // Click share button (will copy to clipboard if navigator.share not available)
  await page.locator('#btn-share').click();

  // Check if URL was copied to clipboard or share dialog appeared
  // In headless mode, navigator.share is not available, so clipboard is used
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  // Assert a URL was copied — matches localhost in dev and the real host in deploy previews/production
  const currentOrigin = new URL(page.url()).origin;
  expect(clipboardText).toContain(currentOrigin);
});
