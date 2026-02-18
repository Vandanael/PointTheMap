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

export const SubmitSchema = z.object({
  token: z.string().min(1),
  pseudo: z.string().regex(/^[A-Z]{3,5}$/),
  rounds: z.array(RoundSchema),
  gameType: z.enum(/** @type {[string, ...string[]]} */ (ALL_MODES)).optional(),
  payloadVersion: z.number().int().positive().optional(),
});
