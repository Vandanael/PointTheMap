export function attachPageDiagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => pageErrors.push(err.stack || err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    consoleErrors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText || ''}`);
  });

  return { pageErrors, consoleErrors };
}

export async function waitForAppReady(page, diagnostics, timeout = 30_000) {
  try {
    await page.waitForFunction(
      () => {
        const hasReadyFlag =
          document.body.dataset.appReady === 'true' ||
          document.body.dataset.appInitError === 'true';
        if (hasReadyFlag) return true;

        const startModal = document.getElementById('start-modal');
        const startSkeleton = document.getElementById('start-skeleton');
        const resumeModal = document.getElementById('resume-modal');
        return Boolean(startModal || resumeModal) && !startSkeleton;
      },
      { timeout }
    );
  } catch (err) {
    const details = diagnostics || { pageErrors: [], consoleErrors: [] };
    throw new Error(
      `App readiness timeout: ${JSON.stringify({
        err: String(err),
        pageErrors: details.pageErrors,
        consoleErrors: details.consoleErrors,
      })}`
    );
  }
}

export async function getAppInitError(page) {
  return page.evaluate(() =>
    document.body.dataset.appInitError === 'true'
      ? globalThis.__appInitError || 'Unknown init error'
      : null
  );
}

export async function ensureAppBootstrapped(page, timeout = 30_000) {
  const diagnostics = attachPageDiagnostics(page);
  await waitForAppReady(page, diagnostics, timeout);

  const initError = await getAppInitError(page);
  if (initError) {
    throw new Error(
      `App init failed: ${JSON.stringify({
        initError,
        pageErrors: diagnostics.pageErrors,
        consoleErrors: diagnostics.consoleErrors,
      })}`
    );
  }

  return diagnostics;
}
