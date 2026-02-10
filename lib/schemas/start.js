import { z } from 'zod';

const ALL_MODES = [
  'classic',
  'daily',
  'country',
  'country_daily',
  'stadium',
  'stadium_daily',
  'civilization',
  'civilization_daily',
];

export const StartBodySchema = z.object({
  gameType: z.enum(/** @type {[string, ...string[]]} */ (ALL_MODES)).default('classic'),
});
