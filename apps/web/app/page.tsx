import { Suspense } from 'react';
import { Surface } from '@roadtrip/ui';
import TripPlanner from '../components/trip-planner';
import AuthControls from '../components/auth-controls';
import HeroPhrase from '../components/hero-phrase';

const HomePage = () => (
  <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-10 md:px-8 md:py-12">
    <header className="space-y-5">
      <AuthControls />
      <p className="inline-flex items-center gap-2 rounded-full bg-[#f4f4ef] px-4 py-1 text-xs uppercase tracking-widest text-stone-500">
        RoadTrip Alpha · Production-grade foundations
      </p>
      <h1 className="text-4xl font-semibold leading-tight text-[#1B4332] md:text-6xl">
        Plan soulful drives with{' '}
        <span className="text-[#3b6090]">
          <HeroPhrase />
        </span>
        .
      </h1>
      <p className="max-w-3xl text-lg text-stone-600">
        Plug in a region, we will stitch local gems, sponsored highlights, and traveler
        intel into a monetizable itinerary that actually feels curated.
      </p>
    </header>

    <Surface elevation="raised" className="bg-gradient-to-br from-[#f4f4ef] to-[#eeeee9]">
      <Suspense fallback={<p>Loading planner…</p>}>
        <TripPlanner />
      </Suspense>
    </Surface>
  </div>
);

export default HomePage;
