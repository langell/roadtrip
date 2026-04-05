import { redirect } from 'next/navigation';
import { requireAuth } from '../../../../lib/session';
import {
  getTripDetailServer,
  getTripSponsoredStopServer,
} from '../../../../lib/server-api-client';
import TripMapView from '../../../../components/TripMapView';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

type Props = {
  params: Promise<{ id: string }>;
};

const TripMapPage = async ({ params }: Props) => {
  const { id } = await params;

  await requireAuth(`/trips/${id}/map`);

  const [trip, sponsored] = await Promise.all([
    getTripDetailServer(id),
    getTripSponsoredStopServer(id),
  ]);

  void fetch(`${API_BASE}/analytics/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'trip_open', payload: { tripId: id } }),
    cache: 'no-store',
  }).catch(() => {});

  if (!trip) {
    redirect('/trips');
  }

  return <TripMapView trip={trip} sponsored={sponsored} />;
};

export default TripMapPage;
