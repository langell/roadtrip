export type TripIdea = {
  id: string;
  title: string;
  description: string;
  distanceKm: number;
  imageUrl?: string;
};

export type PlannedStopResolved = {
  query: string;
  status: 'resolved';
  suggestion: {
    id: string;
    placeId: string;
    title: string;
    description: string;
    distanceKm: number;
    lat: number;
    lng: number;
    imageUrl?: string;
  };
};

export type PlannedStopUnresolved = {
  query: string;
  status: 'unresolved';
  errorCode: 'NOT_FOUND' | 'UPSTREAM_ERROR';
};

export type PlannedStop = PlannedStopResolved | PlannedStopUnresolved;

export type TripPlanOption = {
  title: string;
  rationale: string;
  stops: PlannedStop[];
};

export type TripPlanResponse = {
  location: string;
  radiusKm: number;
  themes: string[];
  source: 'cache' | 'ai';
  options: TripPlanOption[];
  degraded?: boolean;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

let cachedApiToken: { value: string; expiresAt: number } | null = null;

const getApiToken = async () => {
  const now = Date.now();
  if (cachedApiToken && cachedApiToken.expiresAt > now) {
    return cachedApiToken.value;
  }

  try {
    const response = await fetch('/api/auth/api-token', {
      cache: 'no-store',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as { token?: string };
    if (!data.token) {
      return undefined;
    }

    cachedApiToken = {
      value: data.token,
      expiresAt: now + 14 * 60 * 1000,
    };

    return data.token;
  } catch {
    return undefined;
  }
};

const buildAuthHeaders = async () => {
  const headers: Record<string, string> = {};
  const apiToken = await getApiToken();
  if (apiToken) {
    headers.authorization = `Bearer ${apiToken}`;
  }
  return headers;
};

export const fetchTripIdeas = async (params: {
  location: string;
  radiusKm: number;
  themes: string[];
}): Promise<TripIdea[]> => {
  const query = new URLSearchParams({
    location: params.location,
    radiusKm: String(params.radiusKm),
  });

  params.themes.forEach((theme) => {
    query.append('theme', theme);
  });

  try {
    const response = await fetch(`${apiBaseUrl}/suggestions?${query.toString()}`, {
      headers: await buildAuthHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as TripIdea[];
    return data;
  } catch {
    return [];
  }
};

export type SavePlanResult =
  | { saved: true; tripId: string }
  | { saved: false; requiresAuth: true }
  | { saved: false; requiresAuth: false; error: string };

export const savePlanOption = async (params: {
  title: string;
  rationale: string;
  location: string;
  originLat: number;
  originLng: number;
  radiusKm: number;
  themes: string[];
  stops: Array<{
    placeId: string;
    name: string;
    lat: number;
    lng: number;
    notes?: string;
    imageUrl?: string;
    order: number;
  }>;
}): Promise<SavePlanResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/trips/save-plan`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await buildAuthHeaders()),
      },
      body: JSON.stringify(params),
    });

    if (response.status === 401) {
      return { saved: false, requiresAuth: true };
    }

    if (!response.ok) {
      return {
        saved: false,
        requiresAuth: false,
        error: 'Save failed. Please try again.',
      };
    }

    const data = (await response.json()) as { id: string };
    return { saved: true, tripId: data.id };
  } catch {
    return { saved: false, requiresAuth: false, error: 'Save failed. Please try again.' };
  }
};

export type SavedTripStop = {
  id: string;
  placeId: string;
  name: string;
  order: number;
  lat: number;
  lng: number;
  notes?: string | null;
};

export type SavedTrip = {
  id: string;
  name: string;
  originLat: number;
  originLng: number;
  createdAt: string;
  stops: SavedTripStop[];
};

export const getMyTrips = async (): Promise<SavedTrip[]> => {
  try {
    const response = await fetch(`${apiBaseUrl}/trips`, {
      headers: await buildAuthHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as SavedTrip[];
  } catch {
    return [];
  }
};

export const shareTrip = async (tripId: string): Promise<{ shareUrl: string } | null> => {
  try {
    const response = await fetch(
      `${apiBaseUrl}/trips/${encodeURIComponent(tripId)}/share`,
      {
        method: 'POST',
        headers: await buildAuthHeaders(),
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as { shareUrl: string };
  } catch {
    return null;
  }
};

export type SharedPlan = {
  name: string;
  location: string;
  themes: string[];
  rationale: string;
  stops: Array<{
    name: string;
    order: number;
    notes?: string;
    placeId: string;
    imageUrl?: string;
    lat: number;
    lng: number;
    driveTimeMin: number | null;
  }>;
};

export const getSharedTrip = async (token: string): Promise<SharedPlan | null> => {
  try {
    const response = await fetch(
      `${apiBaseUrl}/trips/shared/${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return null;
    return (await response.json()) as SharedPlan;
  } catch {
    return null;
  }
};

export type TripDetailStop = {
  id: string;
  placeId: string;
  name: string;
  order: number;
  lat: number;
  lng: number;
  notes?: string;
  imageUrl?: string;
  driveTimeMin: number | null;
};

export type TripDetail = {
  id: string;
  name: string;
  originLat: number;
  originLng: number;
  shareToken?: string;
  location: string;
  themes: string[];
  rationale: string;
  stops: TripDetailStop[];
};

export type SponsoredStop = {
  id: string;
  placeId: string;
  title: string;
  description: string;
  imageUrl?: string;
  url?: string;
};

export const getTripDetail = async (tripId: string): Promise<TripDetail | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/trips/${encodeURIComponent(tripId)}`, {
      headers: await buildAuthHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as TripDetail;
  } catch {
    return null;
  }
};

export const getTripSponsoredStop = async (
  tripId: string,
): Promise<SponsoredStop | null> => {
  try {
    const response = await fetch(
      `${apiBaseUrl}/trips/${encodeURIComponent(tripId)}/sponsored-stop`,
      {
        headers: await buildAuthHeaders(),
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as SponsoredStop | null;
  } catch {
    return null;
  }
};

export type TrendingRoute = {
  cacheId: string;
  location: string;
  radiusKm: number;
  themes: string[];
  engagementScore: number;
  previewTitle: string;
  previewImageUrl?: string;
};

export type DiscoverStop = {
  id: string;
  placeId: string;
  title: string;
  description: string;
  imageUrl?: string;
  url?: string;
  sponsored: boolean;
};

export type DiscoverFeedResponse = {
  trendingRoutes: TrendingRoute[];
  nearbyStops: DiscoverStop[];
  sponsoredStops: DiscoverStop[];
};

export const getDiscoverFeed = async (): Promise<DiscoverFeedResponse | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/discover`, {
      headers: await buildAuthHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as DiscoverFeedResponse;
  } catch {
    return null;
  }
};

export const fetchCachedTripPlan = async (
  cacheId: string,
): Promise<TripPlanResponse | null> => {
  try {
    const response = await fetch(
      `${apiBaseUrl}/trips/cache/${encodeURIComponent(cacheId)}`,
      {
        headers: await buildAuthHeaders(),
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as TripPlanResponse;
  } catch {
    return null;
  }
};

export const fetchTripPlans = async (params: {
  location: string;
  radiusKm: number;
  themes: string[];
  maxOptions: 2 | 3;
  modifiers?: { smartPitstops?: boolean; photoOps?: boolean };
}): Promise<TripPlanResponse | null> => {
  try {
    const response = await fetch(`${apiBaseUrl}/trips/plan`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(await buildAuthHeaders()),
      },
      cache: 'no-store',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as TripPlanResponse;
    return data;
  } catch {
    return null;
  }
};
