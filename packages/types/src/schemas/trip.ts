import { z } from 'zod';

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const TripStopSchema = z.object({
  id: z.string().uuid(),
  placeId: z.string(),
  name: z.string().min(1),
  location: CoordinatesSchema,
  notes: z.string().optional(),
  order: z.number().int().nonnegative(),
});

export const TripThemeSchema = z.enum([
  'scenic',
  'foodie',
  'culture',
  'adventure',
  'family',
]);

export const TripFiltersSchema = z.object({
  radiusKm: z.number().positive().max(500),
  theme: TripThemeSchema,
  maxStops: z.number().int().min(1).max(12),
});

export const TripSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  origin: CoordinatesSchema,
  stops: z.array(TripStopSchema),
  filters: TripFiltersSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TripCreateRequestSchema = TripSchema.pick({
  name: true,
  origin: true,
  stops: true,
  filters: true,
});

export const TripUpdateRequestSchema = TripCreateRequestSchema.partial().extend({
  id: z.string().uuid(),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type TripStop = z.infer<typeof TripStopSchema>;
export type TripFilters = z.infer<typeof TripFiltersSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type TripCreateRequest = z.infer<typeof TripCreateRequestSchema>;
export type TripUpdateRequest = z.infer<typeof TripUpdateRequestSchema>;
