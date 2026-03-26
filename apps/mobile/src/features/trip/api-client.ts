export type TripSuggestion = {
  id: string;
  placeId: string;
  title: string;
  description: string;
  distanceKm: number;
  lat: number;
  lng: number;
};

export type SavedTrip = {
  id: string;
  name: string;
  origin: {
    lat: number;
    lng: number;
  };
  stops: Array<{
    id: string;
    name: string;
    order: number;
    lat: number;
    lng: number;
    notes?: string | null;
  }>;
};

type SavedTripApi = {
  id: string;
  name: string;
  originLat: number;
  originLng: number;
  stops: Array<{
    id: string;
    name: string;
    order: number;
    lat: number;
    lng: number;
    notes?: string | null;
  }>;
};

const mapSavedTrip = (trip: SavedTripApi): SavedTrip => ({
  id: trip.id,
  name: trip.name,
  origin: {
    lat: trip.originLat,
    lng: trip.originLng,
  },
  stops: [...trip.stops].sort((a, b) => a.order - b.order),
});

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const apiBearerToken = process.env.EXPO_PUBLIC_API_BEARER_TOKEN?.trim();

const buildAuthHeaders = (headers: Record<string, string> = {}) => {
  if (apiBearerToken) {
    headers.authorization = `Bearer ${apiBearerToken}`;
  }

  return headers;
};

export const fetchTripSuggestions = async (params: {
  location: string;
  radiusKm: number;
  theme: string;
}): Promise<TripSuggestion[]> => {
  const query = new URLSearchParams({
    location: params.location,
    radiusKm: String(params.radiusKm),
    theme: params.theme,
  });

  const response = await fetch(`${apiBaseUrl}/suggestions?${query.toString()}`, {
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as TripSuggestion[];
};

export const saveGeneratedTrip = async (params: {
  location: string;
  radiusKm: number;
  theme: string;
  name?: string;
}): Promise<SavedTrip | null> => {
  const response = await fetch(`${apiBaseUrl}/trips/save-generated`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as SavedTripApi;
  return mapSavedTrip(data);
};

export const listSavedTrips = async (): Promise<SavedTrip[]> => {
  const response = await fetch(`${apiBaseUrl}/trips`, {
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as SavedTripApi[];
  return data.map(mapSavedTrip);
};
