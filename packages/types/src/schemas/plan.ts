import { z } from 'zod';

export const StopTypeSchema = z
  .enum(['attraction', 'pit_stop', 'photo_op'])
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const PlannedSuggestionSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  distanceKm: z.number().positive(),
  lat: z.number(),
  lng: z.number(),
  imageUrl: z.string().url().optional(),
});

export const PlannedStopResolvedSchema = z.object({
  query: z.string().min(1),
  status: z.literal('resolved'),
  stopType: StopTypeSchema,
  suggestion: PlannedSuggestionSchema,
  alternatives: z.array(PlannedSuggestionSchema).optional(),
});

export const PlannedStopUnresolvedSchema = z.object({
  query: z.string().min(1),
  status: z.literal('unresolved'),
  stopType: StopTypeSchema,
  errorCode: z.union([z.literal('NOT_FOUND'), z.literal('UPSTREAM_ERROR')]),
});

export const PlannedOptionSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  stops: z
    .array(z.union([PlannedStopResolvedSchema, PlannedStopUnresolvedSchema]))
    .min(1),
});

export const PlannedOptionsSchema = z.array(PlannedOptionSchema).min(1);

export type StopType = 'attraction' | 'pit_stop' | 'photo_op' | null;

export type PlannedSuggestion = z.infer<typeof PlannedSuggestionSchema>;
export type PlannedStopResolved = z.infer<typeof PlannedStopResolvedSchema>;
export type PlannedStopUnresolved = z.infer<typeof PlannedStopUnresolvedSchema>;
export type PlannedStop = PlannedStopResolved | PlannedStopUnresolved;
export type PlannedOption = z.infer<typeof PlannedOptionSchema>;
