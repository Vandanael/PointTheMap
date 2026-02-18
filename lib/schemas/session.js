import { z } from 'zod';

export const StartSessionSchema = z.object({
  token: z.string().min(1),
  startTime: z.number().finite(),
  csrfToken: z.string().min(1),
  gameType: z.string().optional(),
  targets: z.array(z.record(z.string(), z.unknown())).min(1),
});

export const StartSessionWithModeSchema = StartSessionSchema.superRefine((data, ctx) => {
  const gt = data.gameType;
  if (!gt) return;
  if (!Array.isArray(data.targets) || data.targets.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Missing targets' });
  }
});
