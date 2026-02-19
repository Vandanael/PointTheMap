import { z } from 'zod';
import { ModeEnumSchema } from './_mode-enum.js';

const ClickSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const RoundSchema = z.object({
  click: ClickSchema.nullable(),
  status: z.string(),
  score: z.number().int().nonnegative(),
  timeElapsed: z.number().int().nonnegative().optional(),
  capital: z.string().optional(),
  country: z.string().optional(),
  countryId: z.string().optional(),
  correctCountryId: z.string().optional(),
  clickedCountryId: z.string().optional(),
  distanceToTargetKm: z.number().nonnegative().optional(),
  stadium: z.string().optional(),
  city: z.string().optional(),
  civilization: z.string().optional(),
  civilizationId: z.string().optional(),
  correctCivilizationId: z.string().optional(),
  clickedCivilizationId: z.string().optional(),
});

const gameTypeEnum = ModeEnumSchema;

/** @param {unknown} value */
const hasNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

/** @param {string | undefined} gameType */
const modeCategory = (gameType) => {
  if (gameType === 'country' || gameType === 'country_daily') return 'country';
  if (gameType === 'civilization' || gameType === 'civilization_daily') return 'civilization';
  if (gameType === 'stadium' || gameType === 'stadium_daily') return 'stadium';
  return 'capital';
};

export const SubmitSchema = z
  .object({
    token: z.string().min(1),
    pseudo: z.string().regex(/^[A-Z]{3,5}$/),
    rounds: z.array(RoundSchema),
    gameType: gameTypeEnum.optional(),
    payloadVersion: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    const category = modeCategory(data.gameType);
    data.rounds.forEach((round, index) => {
      const path = ['rounds', index];

      if (category === 'country') {
        if (!hasNonEmptyString(round.country)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, 'country'],
            message: 'country is required for country modes',
          });
        }
        if (!hasNonEmptyString(round.countryId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, 'countryId'],
            message: 'countryId is required for country modes',
          });
        }
      } else if (category === 'civilization') {
        if (!hasNonEmptyString(round.civilization)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, 'civilization'],
            message: 'civilization is required for civilization modes',
          });
        }
        if (!hasNonEmptyString(round.civilizationId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, 'civilizationId'],
            message: 'civilizationId is required for civilization modes',
          });
        }
      } else if (category === 'stadium') {
        if (!hasNonEmptyString(round.stadium)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, 'stadium'],
            message: 'stadium is required for stadium modes',
          });
        }
      } else if (!hasNonEmptyString(round.capital)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'capital'],
          message: 'capital is required for capital modes',
        });
      }
    });
  });
