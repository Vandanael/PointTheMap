import { z } from 'zod';

const MAX_ERRORS_PER_BATCH = 10;
const MAX_STACK_LENGTH = 4096;

const ErrorItemSchema = z
  .object({
    message: z.string().min(1).max(1000),
    stack: z.string().max(MAX_STACK_LENGTH).nullish(),
    context: z.string().max(100).nullish(),
    type: z.string().max(50).nullish(),
  })
  .strict();

export const ErrorReportSchema = z
  .object({
    errors: z.array(ErrorItemSchema).min(1).max(MAX_ERRORS_PER_BATCH),
  })
  .strict();
