import { Suspense } from 'react';
import { Surface } from '@roadtrip/ui';
import TripPlanner from '../components/trip-planner';

const HomePage = () => (
  <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-12">
    <header className="space-y-6">
      <p className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-widest text-white/80">
        RoadTrip Alpha · Production-grade foundations
      </p>
      <h1 className="text-5xl font-semibold leading-tight text-white">
        Plan soulful drives with <span className="text-emerald-400">signal over noise</span>.
      </h1>
      <p className="max-w-2xl text-lg text-white/70">
        Plug in a region, we will stitch local gems, sponsored highlights, and traveler intel
        into a monetizable itinerary that actually feels curated.
      </p>
    </header>

    <Surface elevation="raised" className="bg-gradient-to-br from-slate-900 to-slate-950">
      <Suspense fallback={<p>Loading planner…</p>}>
        <TripPlanner />
      </Suspense>
    </Surface>
  </div>
);

export default HomePage;
