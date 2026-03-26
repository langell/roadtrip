import { env } from '../config/env.js';

export type PlaceSuggestion = {
  id: string;
  title: string;
  description: string;
  distanceKm: number;
};

export class GooglePlacesService {
  async findStops(params: {
    location: string;
    radiusKm: number;
    theme: string;
  }): Promise<PlaceSuggestion[]> {
    // TODO: Integrate with real Google Places + Directions API.
    const seed = `${params.location}-${params.theme}`;
    return [
      {
        id: Buffer.from(seed).toString('base64').slice(0, 12),
        title: `${params.theme} waypoint`,
        description: `prototype placeholder near ${params.location}`,
        distanceKm: Math.round(params.radiusKm * 0.4),
      },
    ];
  }
}

export const googlePlacesService = new GooglePlacesService();
void env.GOOGLE_MAPS_API_KEY; // ensures env is referenced until integration lands.
