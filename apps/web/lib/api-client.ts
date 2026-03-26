export type TripIdea = {
  id: string;
  title: string;
  description: string;
  distanceKm: number;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

let cachedApiToken: { value: string; expiresAt: number } | null = null;

const getApiToken = async () => {
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
  theme: string;
}): Promise<TripIdea[]> => {
  const query = new URLSearchParams({
    location: params.location,
    radiusKm: String(params.radiusKm),
    theme: params.theme,
  });

  const response = await fetch(`${apiBaseUrl}/suggestions?${query.toString()}`, {
    headers: await buildAuthHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as TripIdea[];
  return data;
};
