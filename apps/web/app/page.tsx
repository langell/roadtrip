import { Suspense } from 'react';
import Link from 'next/link';
import { Surface } from '@roadtrip/ui';
import TripPlanner from '../components/trip-planner';
import AuthControls from '../components/auth-controls';
import HeroPhrase from '../components/hero-phrase';

const HomePage = () => (
  <div className="bg-wayfarer-bg font-body text-wayfarer-text-main antialiased">
    <header className="relative z-20 flex h-16 items-center justify-between px-6 md:px-10">
      <p className="font-display text-2xl font-extrabold uppercase tracking-[0.2em] text-wayfarer-primary">
        HopTrip
      </p>
      <AuthControls variant="nav" />
    </header>

    <main className="relative overflow-hidden">
      <section className="relative h-[23rem] min-h-[20rem] w-full md:h-screen md:min-h-[32rem]">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdZLdf8nn9pGc50ZxckpxO-MI4Z43NG62UapCBUrflkzyOSIMOXQ91-z0gXPE_N4O12b2LD5COH98TcH8qwt54m6y-RDlLubcQbRMzpGiym0zMRsSyv12hfEARw_dGIswWfHhIX4IggfyOE9C4iy8aSmVsCqMfHWBH24pcVP8orhSzxgLaDPGlwnfYKci1hPHvQhd7-M4-Y93Pbm8O1c0dp2UURc8IjHOeoHgQLnx1v3r18vvONM6uPIikoZh3F_WDgZCUtH0akKA"
          alt="Scenic mountain road"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-wayfarer-bg/20 to-wayfarer-bg" />
      </section>

      <section className="relative z-10 -mt-16 px-6 pb-10 md:-mt-[30rem] md:px-14 md:pb-20 lg:px-24">
        <div className="max-w-2xl rounded-3xl bg-wayfarer-bg/80 p-5 shadow-wayfarer-ambient backdrop-blur-sm md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
          <div className="mb-6 flex items-center gap-3">
            <span className="h-1 w-12 rounded-full bg-wayfarer-primary-light" />
            <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-wayfarer-primary">
              The Open Road Awaits
            </span>
          </div>

          <h1 className="mb-4 font-display text-3xl font-extrabold leading-[1.05] text-wayfarer-primary md:mb-5 md:text-6xl md:leading-tight">
            <HeroPhrase />.
          </h1>

          <p className="mb-6 max-w-xl text-sm leading-relaxed text-wayfarer-text-muted md:mb-8 md:text-lg">
            Experience hidden gems, scenic detours, and local secrets that transform
            transportation into exploration.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="#route-planner"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-wayfarer-primary px-6 py-3 text-base font-bold text-white shadow-wayfarer-ambient transition hover:opacity-90 md:px-7 md:py-4"
            >
              Start Your Trip
              <span aria-hidden>→</span>
            </a>
            <a
              href="#route-planner"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-wayfarer-surface-deep px-6 py-3 text-base font-bold text-wayfarer-primary transition hover:bg-wayfarer-surface md:px-7 md:py-4"
            >
              Browse Routes
            </a>
          </div>

          <div className="mt-8 hidden items-center gap-5 sm:flex md:mt-10">
            <div className="flex -space-x-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-wayfarer-bg bg-wayfarer-primary text-xs font-bold text-white">
                AL
              </span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-wayfarer-bg bg-wayfarer-secondary text-xs font-bold text-white">
                JT
              </span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-wayfarer-bg bg-wayfarer-primary-light text-xs font-bold text-wayfarer-primary">
                MI
              </span>
            </div>
            <p className="text-sm">
              <span className="block font-bold text-wayfarer-primary">
                Join 12,000+ wayfarers
              </span>
              <span className="text-wayfarer-text-muted">Finding their path today</span>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-wayfarer-bg px-6 pb-20 pt-4 md:px-14 md:pb-24 md:pt-10 lg:px-24">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0 md:pr-0">
          <article className="relative min-h-[16rem] min-w-[85%] snap-start overflow-hidden rounded-[2rem] bg-wayfarer-surface p-6 md:col-span-2 md:min-h-[22rem] md:min-w-0 md:p-10">
            <div className="relative z-10 max-w-md">
              <h2 className="mb-4 font-display text-3xl font-bold text-wayfarer-primary">
                Curated Scenic Byways
              </h2>
              <p className="mb-5 text-wayfarer-text-muted">
                Expertly designed routes that prioritize the view over the clock.
              </p>
              <a href="#route-planner" className="font-semibold text-wayfarer-primary">
                Explore Collections →
              </a>
            </div>
            <div className="absolute inset-y-0 right-0 hidden w-2/3 opacity-50 sm:block">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9N2jnzWTz1IaMG2SlTDB38l567WNr8pvaWNXcH0DGDN2Ww3DNYsm5iQotL0Vr_r5iu-ULDISF8rX6mfcGmawnq_G3pYdg9xuhyKIEsvR4fXx1FARKn_6A_9BBaeWTusa6qjhDE530zH85Sd0y_ShdrGf5b4cK6RA7wMYcwbYk5zqwkZTXqsXZAUPv144v2EMuFKj5nXJ_WXZzwkk6RoQaVVcEzuX03-7k04fGCZU0kHB1ol-XVGJ8860u7inK_Oq6H-DLRxKuP7k"
                alt="Breathtaking mountain lake view"
                className="h-full w-full rounded-tl-[4rem] object-cover"
              />
            </div>
          </article>

          <article className="flex min-h-[16rem] min-w-[85%] snap-start flex-col justify-end gap-4 rounded-[2rem] bg-wayfarer-primary p-6 text-white md:min-h-0 md:min-w-0 md:p-8">
            <p className="text-3xl">🗺️</p>
            <h3 className="font-display text-2xl font-bold">Offline Precision</h3>
            <p className="text-sm text-white/80">
              Download regions for seamless navigation where cellular service fails.
            </p>
          </article>

          <article className="flex min-h-[16rem] min-w-[85%] snap-start flex-col gap-6 rounded-[2rem] bg-wayfarer-surface-deep p-6 md:min-h-0 md:min-w-0 md:p-8">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-wayfarer-secondary/10 text-wayfarer-secondary">
                🍽️
              </span>
              <div>
                <p className="font-semibold text-wayfarer-primary">Smart Pit-Stops</p>
                <p className="text-xs text-wayfarer-text-muted">Recommended local eats</p>
              </div>
            </div>
            <div className="h-px bg-wayfarer-accent/40" />
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-wayfarer-primary-light/20 text-wayfarer-primary">
                📸
              </span>
              <div>
                <p className="font-semibold text-wayfarer-primary">Photo Ops</p>
                <p className="text-xs text-wayfarer-text-muted">Timed for golden hour</p>
              </div>
            </div>
          </article>

          <article className="flex min-h-[16rem] min-w-[85%] snap-start flex-col items-center gap-5 rounded-[2rem] border border-wayfarer-accent/40 p-6 md:col-span-2 md:min-h-0 md:min-w-0 md:gap-6 md:flex-row md:p-10">
            <div className="flex-1">
              <h3 className="mb-4 font-display text-3xl font-bold text-wayfarer-primary">
                Journey Journal
              </h3>
              <p className="text-wayfarer-text-muted">
                Auto-stitch your photos, stops, and route into a shareable scrapbook of
                your adventure.
              </p>
            </div>
            <div className="h-32 w-full max-w-48 overflow-hidden rounded-2xl border-4 border-white shadow-wayfarer-soft md:w-48">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDEz9xjmRvUmwmlDIS493_mzG6RnSZefLWcU7cYqK3BTiUi-TFV5GUmKeu7VpX7pF7_z91wsNITsbJXhyLwIhleVA4cHzhMu4DL9gmtzAqI4N3MFj3yRRidn4R1zH-ijChJuv7mz-70hVp02JZFR97-isXz-cVrzwS9bXAzg8o64i-WrRu9TfreiyRoylX5XmqChP8DKwGtUAkGFN57VGUJlwQbN5ToycJ3VKqi4kaP7OeMCts9epDiRQspPANbgJMYP7eJXZ7ss-g"
                alt="Polaroid style lake view"
                className="h-full w-full object-cover"
              />
            </div>
          </article>
        </div>
        <p className="mt-3 text-xs text-wayfarer-text-muted md:hidden">
          Swipe to explore more features →
        </p>
      </section>

      <section id="route-planner" className="mx-auto w-full max-w-6xl px-6 pb-24 md:px-8">
        <div className="mb-4 space-y-3">
          <p className="font-body text-xs uppercase tracking-[0.18em] text-wayfarer-text-muted">
            Route Builder
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
    </main>

    <footer className="border-t border-wayfarer-accent/40 bg-wayfarer-surface py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 md:flex-row md:justify-between md:px-8">
        <div>
          <p className="font-display text-xl font-black uppercase tracking-[0.2em] text-wayfarer-primary">
            HopTrip
          </p>
          <p className="mt-2 max-w-xs text-sm text-wayfarer-text-muted">
            Built for the curious. Designed for the drive.
          </p>
        </div>
        <div className="flex flex-wrap gap-10 text-sm">
          <div className="space-y-2">
            <p className="font-bold uppercase tracking-wider text-wayfarer-primary">
              Company
            </p>
            <Link
              href="/about"
              className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
            >
              About
            </Link>
            <Link
              href="/journal"
              className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
            >
              Journal
            </Link>
          </div>
          <div className="space-y-2">
            <p className="font-bold uppercase tracking-wider text-wayfarer-primary">
              Product
            </p>
            <Link
              href="/product/route-planner"
              className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
            >
              Route Planner
            </Link>
            <Link
              href="/product/offline-maps"
              className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
            >
              Offline Maps
            </Link>
          </div>
          <div className="space-y-2">
            <p className="font-bold uppercase tracking-wider text-wayfarer-primary">
              Legal
            </p>
            <Link
              href="/privacy"
              className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="block text-wayfarer-text-muted hover:text-wayfarer-primary"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  </div>
);

export default HomePage;
