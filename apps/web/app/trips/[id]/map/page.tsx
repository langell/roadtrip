import { redirect } from 'next/navigation';
import { auth } from '../../../../auth';
import {
  getTripDetailServer,
  getTripSponsoredStopServer,
} from '../../../../lib/server-api-client';
import TripMapView from '../../../../components/TripMapView';

type Props = {
  params: Promise<{ id: string }>;
};

const TripMapPage = async ({ params }: Props) => {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=/trips/${id}/map`);
  }

  const [trip, sponsored] = await Promise.all([
    getTripDetailServer(id),
    getTripSponsoredStopServer(id),
  ]);

  if (!trip) {
    redirect('/trips');
  }

  return <TripMapView trip={trip} sponsored={sponsored} />;
};

export default TripMapPage;
