const API_BASE = 'https://api.github.com';
const MAX_ATTEMPTS = 60; // 15 min at 15s interval
const SLEEP_MS = 15_000;
const fs = await import('node:fs/promises');

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;

if (!token) {
  throw new Error('GITHUB_TOKEN is required to resolve Netlify preview URL');
}
if (!repository) {
  throw new Error('GITHUB_REPOSITORY is required');
}
if (!sha) {
  throw new Error('GITHUB_SHA is required');
}

const deployPreviewRegex = /(https:\/\/deploy-preview-[a-z0-9-]+--[a-z0-9-]+\.netlify\.app)/i;

const request = async (path) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${path} failed: ${response.status} ${body}`);
  }

  return response.json();
};

const extractFirstPreviewUrl = (...texts) => {
  for (const text of texts) {
    if (!text || typeof text !== 'string') continue;
    const match = text.match(deployPreviewRegex);
    if (match?.[1]) return match[1];
  }
  return '';
};

const getUrlFromDeployments = async () => {
  const deployments = await request(`/repos/${repository}/deployments?sha=${sha}&per_page=20`);

  for (const deployment of deployments) {
    const statuses = await request(
      `/repos/${repository}/deployments/${deployment.id}/statuses?per_page=20`
    );

    for (const status of statuses) {
      const previewUrl = extractFirstPreviewUrl(
        status.environment_url,
        status.log_url,
        status.target_url,
        status.description
      );
      if (previewUrl) return previewUrl;
    }
  }

  return '';
};

const getUrlFromChecks = async () => {
  const checks = await request(`/repos/${repository}/commits/${sha}/check-runs?per_page=100`);

  for (const run of checks.check_runs || []) {
    const previewUrl = extractFirstPreviewUrl(
      run.details_url,
      run.output?.summary,
      run.output?.text,
      run.name
    );
    if (previewUrl) return previewUrl;
  }

  return '';
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const writeOutput = async (name, value) => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  await fs.appendFile(outputPath, `${name}=${value}\n`);
};

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  process.stdout.write(
    `Resolving Netlify deploy preview URL (attempt ${attempt}/${MAX_ATTEMPTS})...\n`
  );

  let previewUrl = '';
  try {
    previewUrl = (await getUrlFromDeployments()) || (await getUrlFromChecks());
  } catch (error) {
    process.stdout.write(`Resolver API error: ${String(error)}\n`);
  }

  if (previewUrl) {
    process.stdout.write(`Resolved deploy preview URL: ${previewUrl}\n`);
    await writeOutput('preview_url', previewUrl);
    process.exit(0);
  }

  if (attempt < MAX_ATTEMPTS) {
    await sleep(SLEEP_MS);
  }
}

throw new Error('Unable to resolve Netlify deploy preview URL for this commit within timeout');
