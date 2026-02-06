import { z } from 'zod';

export const StartSessionSchema = z.object({
  token: z.string().min(1),
  startTime: z.number().finite(),
  csrfToken: z.string().min(1),
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
