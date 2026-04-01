/**
 * Server-only API client helpers.
 *
 * `buildAuthHeaders()` in api-client.ts fetches a JWT via a relative URL, which
 * doesn't work in Server Components. This module generates the same JWT directly
 * using the session from `auth()` and the shared `AUTH_SECRET`, skipping the
 * HTTP round-trip.
 */

import { SignJWT } from 'jose';
import { auth } from '../auth';
import type { SavedTrip, TripDetail, SponsoredStop } from './api-client';

const API_TOKEN_ISSUER = 'roadtrip-web';
const API_TOKEN_AUDIENCE = 'roadtrip-api';
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

const getAuthSecret = () => {
  const secret = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)?.trim();
  return secret?.length ? secret : undefined;
};

const buildServerAuthHeaders = async (): Promise<Record<string, string>> => {
  const session = await auth();
  const userId = session?.user?.id ?? session?.user?.email ?? undefined;
  if (!userId) return {};

  const secret = getAuthSecret();
  if (!secret) return {};

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(API_TOKEN_ISSUER)
    .setAudience(API_TOKEN_AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret));

  return { authorization: `Bearer ${token}` };
};

export const getMyTripsServer = async (): Promise<SavedTrip[]> => {
  try {
    const response = await fetch(`${apiBaseUrl}/trips`, {
      headers: await buildServerAuthHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) return [];
    return (await response.json()) as SavedTrip[];
  } catch {
    return [];
  }
};

export const getTripDetailServer = async (tripId: string): Promise<TripDetail | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/trips/${encodeURIComponent(tripId)}`, {
      headers: await buildServerAuthHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as TripDetail;
  } catch {
    return null;
  }
};

export const getTripSponsoredStopServer = async (
  tripId: string,
): Promise<SponsoredStop | null> => {
  try {
    const response = await fetch(
      `${apiBaseUrl}/trips/${encodeURIComponent(tripId)}/sponsored-stop`,
      {
        headers: await buildServerAuthHeaders(),
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as SponsoredStop | null;
  } catch {
    return null;
  }
};
