export type TripIdea = {
  id: string;
  title: string;
  description: string;
  distanceKm: number;
};

export const fetchTripIdeas = async (params: {
  location: string;
  radiusKm: number;
  theme: string;
}): Promise<TripIdea[]> => {
  // TODO: Replace with real API call once backend routes are ready.
  await new Promise((resolve) => globalThis.setTimeout(resolve, 400));
  return [
    {
      id: 'sample-1',
      title: `${params.theme} sampler`,
      description: `Curated spots near ${params.location}`,
      distanceKm: Math.round(params.radiusKm * 0.4)
    }
  ];
};
