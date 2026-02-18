import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('submit and rate-limit hot path index guards', () => {
  it('keeps required DB indexes for rank and cleanup queries', () => {
    const schema = fs.readFileSync('netlify/database/schema.sql', 'utf8');

    expect(schema).toMatch(
      /create index if not exists idx_rate_limits_expires_at on rate_limits\(expires_at\);/i
    );
    expect(schema).toMatch(
      /create index if not exists idx_scores_rank on scores\(game_type, score desc, time asc\);/i
    );
  });

  it('keeps hot-path queries aligned with indexed columns', () => {
    const submit = fs.readFileSync('netlify/functions/submit.js', 'utf8');
    const rateLimit = fs.readFileSync('netlify/functions/_rate-limit.js', 'utf8');

    expect(submit).toMatch(/where game_type\s*=\s*\$\{/i);
    expect(submit).toMatch(/score > \$\{|score = \$\{.*time < \$\{/i);
    expect(rateLimit).toMatch(/delete from rate_limits where expires_at < now\(\)/i);
  });
});
