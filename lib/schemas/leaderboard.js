import { z } from 'zod';
import { ModeEnumSchema } from './_mode-enum.js';

export const LeaderboardQuerySchema = z.object({
  type: ModeEnumSchema.default('classic'),
});
