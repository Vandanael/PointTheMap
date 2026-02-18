import { z } from 'zod';

export const ErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const SuccessEnvelopeSchema = (dataSchema) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
    meta: z.unknown().optional(),
  });
