const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/**
 * Resolves a Google Places placeId to lat/lng coordinates.
 * Cached for 30 days — place locations don't change.
 */
export async function getPlaceCoords(
  placeId: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPS_KEY) return null;

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry&key=${MAPS_KEY}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      result?: { geometry?: { location?: { lat: number; lng: number } } };
    };

    if (data.status !== 'OK' || !data.result?.geometry?.location) return null;
    return data.result.geometry.location;
  } catch {
    return null;
  }
}

/**
 * Reverse geocodes a lat/lng to a "City, State" string using the Google
 * Geocoding API. Returns null when the key is absent or the request fails.
 *
 * Result is cached by Next.js fetch for 7 days — stop coordinates never change.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!MAPS_KEY) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=locality|administrative_area_level_1&key=${MAPS_KEY}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        address_components: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
      }>;
    };

    if (data.status !== 'OK' || !data.results.length) return null;

    // Extract locality (city) and administrative_area_level_1 (state/province)
    const components = data.results[0].address_components;
    const city = components.find((c) => c.types.includes('locality'))?.long_name;
    const state = components.find((c) =>
      c.types.includes('administrative_area_level_1'),
    )?.short_name;

    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
    return data.results[0].formatted_address ?? null;
  } catch {
    return null;
  }
}
