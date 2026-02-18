const baseUrl = process.argv[2] || process.env.E2E_BASE_URL;

if (!baseUrl) {
  throw new Error('Missing target URL. Pass it as first arg or E2E_BASE_URL');
}

const normalizedBase = baseUrl.replace(/\/$/, '');

const fetchText = async (path) => {
  const url = `${normalizedBase}${path}`;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  const text = await response.text();
  return { url, status: response.status, text };
};

const about = await fetchText('/about.html');
const home = await fetchText('/');

if (about.status >= 400) {
  throw new Error(`Preflight failed: ${about.url} returned HTTP ${about.status}`);
}
if (home.status >= 400) {
  throw new Error(`Preflight failed: ${home.url} returned HTTP ${home.status}`);
}

const hasAboutContent =
  about.text.includes('id="content-en"') && about.text.includes('id="btn-share"');
const aboutLooksLikeHome =
  about.text.includes('id="start-modal"') || about.text.includes('id="btn-start-game"');

if (!hasAboutContent || aboutLooksLikeHome) {
  throw new Error(
    [
      `Preflight failed for ${normalizedBase}`,
      '/about.html does not match expected About page markers.',
      `contains #content-en and #btn-share: ${hasAboutContent}`,
      `looks like start screen: ${aboutLooksLikeHome}`,
    ].join(' ')
  );
}

process.stdout.write(`Preflight OK for ${normalizedBase}\n`);
