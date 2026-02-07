import { z } from 'zod';

export const GeoJSONGeometrySchema = z.object({
  type: z.string(),
  coordinates: z.any(),
});

export const GeoJSONFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: GeoJSONGeometrySchema,
  properties: z.record(z.string(), z.any()),
});

export const GeoJSONSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(GeoJSONFeatureSchema),
});
