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
  options: TripPlanOption[];
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://api.hoptrip.net'
    : 'http://localhost:3001');

let cachedApiToken: { value: string; expiresAt: number } | null = null;

const hasAuthSessionCookie = () => {
  if (typeof document === 'undefined') {
    return false;
  }

  return [
    'authjs.session-token=',
    '__Secure-authjs.session-token=',
    'next-auth.session-token=',
    '__Secure-next-auth.session-token=',
  ].some((cookieName) => document.cookie.includes(cookieName));
};

const getApiToken = async () => {
  if (!hasAuthSessionCookie()) {
    return undefined;
  }

  const now = Date.now();
  if (cachedApiToken && cachedApiToken.expiresAt > now) {
    return cachedApiToken.value;
  }

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

export const fetchTripPlans = async (params: {
  location: string;
  radiusKm: number;
  themes: string[];
  maxOptions: 2 | 3;
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
