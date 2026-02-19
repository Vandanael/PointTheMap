import { z } from 'zod';
import { ModeEnumSchema } from './_mode-enum.js';

export const StartBodySchema = z.object({
  gameType: ModeEnumSchema.default('classic'),
});
