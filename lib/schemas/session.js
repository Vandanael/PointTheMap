import { z } from 'zod';

export const StartSessionSchema = z.object({
  token: z.string().min(1),
  startTime: z.number().finite(),
  csrfToken: z.string().min(1),
  gameType: z.string().optional(),
  capitals: z
    .array(
      z.object({
        name: z.string(),
        country: z.string(),
        lat: z.number().finite(),
        lng: z.number().finite(),
        popular: z.boolean().optional(),
      })
    )
    .optional(),
  countries: z
    .array(
      z.object({
        name: z.string(),
        countryId: z.string(),
        popular: z.boolean().optional(),
      })
    )
    .optional(),
  stadiums: z
    .array(
      z.object({
        name: z.string(),
        city: z.string(),
        country: z.string(),
        lat: z.number().finite(),
        lng: z.number().finite(),
        popular: z.boolean().optional(),
      })
    )
    .optional(),
  civilizations: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        popular: z.boolean().optional(),
      })
    )
    .optional(),
});

export const StartSessionWithModeSchema = StartSessionSchema.superRefine((data, ctx) => {
  const gt = data.gameType;
  if (!gt) return;

  /** @type {[string, string, unknown[] | undefined][]} */
  const checks = [
    ['country', 'Missing countries', data.countries],
    ['stadium', 'Missing stadiums', data.stadiums],
    ['civilization', 'Missing civilizations', data.civilizations],
  ];

  for (const [keyword, message, arr] of checks) {
    if (gt.includes(keyword)) {
      if (!Array.isArray(arr) || arr.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      }
      return;
    }
  }

  if (!Array.isArray(data.capitals) || data.capitals.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Missing capitals' });
  }
});
