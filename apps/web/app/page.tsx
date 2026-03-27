import { Suspense } from 'react';
import { Surface } from '@roadtrip/ui';
import TripPlanner from '../components/trip-planner';
import AuthControls from '../components/auth-controls';
import HeroPhrase from '../components/hero-phrase';

const HomePage = () => (
  <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-10 md:px-8 md:py-14">
    <header className="space-y-7">
      <AuthControls />
      <p className="inline-flex items-center gap-2 rounded-full bg-wayfarer-surface px-4 py-1 font-body text-xs uppercase tracking-widest text-wayfarer-text-muted">
        RoadTrip Alpha · Production-grade foundations
      </p>
      <h1 className="max-w-4xl font-display text-4xl font-semibold leading-tight text-wayfarer-primary md:text-6xl">
        <HeroPhrase />.
      </h1>
      <p className="max-w-2xl font-body text-lg leading-relaxed text-wayfarer-text-muted">
        Plug in a region, we will stitch local gems, sponsored highlights, and traveler
        intel into a monetizable itinerary that actually feels curated.
      </p>
    </header>

    <section className="space-y-4">
      <div className="space-y-3">
        <p className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
          Route builder
        </p>
        <h2 className="font-display text-2xl font-bold text-wayfarer-primary md:text-3xl">
          Plan your next drive in minutes
        </h2>
        <p className="max-w-2xl font-body text-sm text-wayfarer-text-muted">
          Tune your route, generate curated stop ideas, and explore options in one
          continuous planning flow.
        </p>
      </div>
      <Surface
        elevation="raised"
        className="bg-gradient-to-br from-wayfarer-surface to-wayfarer-surface-deep"
      >
        <Suspense fallback={<p>Loading planner…</p>}>
          <TripPlanner />
        </Suspense>
      </Surface>
    </section>
  </div>
);

export default HomePage;
