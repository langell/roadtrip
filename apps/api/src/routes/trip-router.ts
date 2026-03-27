import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import {
  TripCreateRequestSchema,
  TripUpdateRequestSchema,
  type TripCreateRequest,
  type TripUpdateRequest,
} from '@roadtrip/types';
import { authenticatedProcedure, procedure, router } from '../lib/trpc.js';
import {
  googlePlacesService,
  GooglePlacesUpstreamError,
} from '../services/google-places-service.js';
import type { Context } from '../types/context.js';
import { logError } from '../lib/logger.js';

export const tripRouter = router({
  list: authenticatedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.trip.findMany({
      where: { userId: ctx.userId },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
  }),
  create: authenticatedProcedure
    .input(TripCreateRequestSchema)
    .mutation(async ({ ctx, input }: { ctx: Context; input: TripCreateRequest }) => {
      const userId = ctx.userId;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      return ctx.prisma.trip.create({
        data: {
          userId,
          name: input.name,
          originLat: input.origin.lat,
          originLng: input.origin.lng,
          filters: input.filters,
          stops: {
            create: input.stops.map((stop: TripCreateRequest['stops'][number]) => ({
              placeId: stop.placeId,
              name: stop.name,
              lat: stop.location.lat,
              lng: stop.location.lng,
              order: stop.order,
              notes: stop.notes,
            })),
          },
        },
        include: { stops: { orderBy: { order: 'asc' } } },
      });
    }),
  update: authenticatedProcedure
    .input(TripUpdateRequestSchema)
    .mutation(async ({ ctx, input }: { ctx: Context; input: TripUpdateRequest }) => {
      return ctx.prisma.trip.update({
        where: { id: input.id, userId: ctx.userId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.origin && {
            originLat: input.origin.lat,
            originLng: input.origin.lng,
          }),
          ...(input.filters && { filters: input.filters }),
        },
        include: { stops: { orderBy: { order: 'asc' } } },
      });
    }),
  suggestions: procedure
    .input(
      z.object({
        location: z.string().min(3),
        radiusKm: z.number().positive(),
        theme: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        return await googlePlacesService.findStops(input);
      } catch (error) {
        const placesErrorMeta =
          error instanceof GooglePlacesUpstreamError
            ? {
                code: error.message,
                stage: error.stage,
                details: error.details,
              }
            : {
                code: 'UNKNOWN_PLACES_ERROR',
                stage: 'unknown',
                details: { message: String(error) },
              };

        logError(ctx.logger, 'trpc.trip.suggestions upstream failure', error, {
          ...placesErrorMeta,
          input,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch places suggestions',
          cause: error,
        });
      }
    }),
  sponsoredPlaces: authenticatedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(10),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.sponsoredPlace.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 10,
      });
    }),
  trackEvent: authenticatedProcedure
    .input(
      z.object({
        type: z.string().min(1).max(64),
        payload: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      type AnalyticsPayload = Prisma.AnalyticsEventCreateInput['payload'];
      const event = await ctx.prisma.analyticsEvent.create({
        data: {
          userId,
          type: input.type,
          payload: input.payload as AnalyticsPayload,
        },
      });

      return { id: event.id, recorded: true };
    }),
});
