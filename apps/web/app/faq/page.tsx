'use client';

import { useState } from 'react';
import Link from 'next/link';

type FaqItem = { q: string; a: string };
type FaqCategory = { category: string; items: FaqItem[] };

const FAQ: FaqCategory[] = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is HipTrip?',
        a: 'HipTrip is an AI-powered road trip planner that helps you discover scenic routes, hidden gems, and memorable stops along your drive. Just enter your origin and destination, set your preferences, and our AI generates a personalized itinerary complete with stops, descriptions, and hotel suggestions.',
      },
      {
        q: 'Do I need an account to use HipTrip?',
        a: 'You can browse and generate trip plans without an account. However, creating a free account lets you save trips, revisit past plans, share trips with friends, and unlock personalized recommendations based on your travel history.',
      },
      {
        q: 'How do I plan my first trip?',
        a: 'Click "Plan a Trip" from the home screen. Enter your starting point and destination, choose optional filters like Smart Pit-Stops or Photo Ops, and hit Generate. Our AI will create several itinerary options for you to choose from in seconds.',
      },
      {
        q: 'Is HipTrip free?',
        a: 'HipTrip is free to use for trip planning, browsing stops, and saving trips. We earn revenue through affiliate hotel booking links — when you book via a hotel card in the app, we may receive a small commission at no extra cost to you.',
      },
    ],
  },
  {
    category: 'Trip Planning',
    items: [
      {
        q: 'How does the AI generate my trip plan?',
        a: 'Our AI considers your route, travel distance, preferences (pit-stops, photo opportunities, etc.), and a curated database of stops to build a practical, interesting itinerary. It balances detour distance, stop quality, and stop variety to give you options that feel right for your trip.',
      },
      {
        q: 'What are Smart Pit-Stops?',
        a: 'Smart Pit-Stops are conveniently located gas stations, rest areas, and food spots that fall naturally along your route — timed to avoid long stretches without a break. Toggle this on when planning long drives.',
      },
      {
        q: 'What are Photo Ops?',
        a: 'Photo Ops highlights scenic viewpoints, landmarks, and visually striking locations along your route that are worth a quick stop for a great photo. Ideal if you love documenting your travels.',
      },
      {
        q: "Can I customize my trip after it's generated?",
        a: 'After generating a plan, you can save it to your account. Future updates will let you swap individual stops and refine the itinerary. For now, you can generate multiple plan variations by hitting Generate again.',
      },
      {
        q: 'How accurate are the stop suggestions?',
        a: 'Stop data is sourced from Google Places and enriched by our AI. While we strive for accuracy, hours, closures, and conditions can change. We recommend confirming key stops before departing, especially for restaurants or attractions.',
      },
      {
        q: 'How long does it take to generate a trip?',
        a: "Most trips generate in 5–15 seconds. Complex routes with many stops or high traffic can take a bit longer. If results are cached from a similar recent search, you'll see them almost instantly.",
      },
    ],
  },
  {
    category: 'Saving and Sharing',
    items: [
      {
        q: 'How do I save a trip?',
        a: 'After generating a plan, click the "Save Trip" button. You\'ll need to be signed in. Saved trips appear in "My Trips" and are accessible from any device.',
      },
      {
        q: 'Can I share my trip with others?',
        a: 'Yes! Every saved trip has a shareable link. Click the Share button on any trip card to copy the link. Anyone with the link can view the full itinerary without needing a HipTrip account.',
      },
      {
        q: 'Can I access my trips offline?',
        a: 'Offline access for saved trips is on our roadmap. For now, all trip data requires an internet connection. We recommend screenshotting your itinerary before heading into areas with poor cell service.',
      },
    ],
  },
  {
    category: 'Hotel Suggestions',
    items: [
      {
        q: 'Where do hotel suggestions come from?',
        a: 'Hotel cards on stop detail pages are sourced from Google Places and linked to Expedia and Booking.com via affiliate partnerships. We show nearby lodging options based on the location of each stop.',
      },
      {
        q: 'Does HipTrip charge extra for hotel bookings?',
        a: 'No. Hotel prices you see are the same as booking directly on Expedia or Booking.com. When you book via a HipTrip hotel link, we earn a small affiliate commission from the booking platform — at no additional cost to you.',
      },
      {
        q: 'Are hotel suggestions personalized to my dates?',
        a: 'Currently, hotel suggestions show nearby lodging options without date-based availability or pricing. Date-based search with live rates is planned for a future update.',
      },
    ],
  },
  {
    category: 'Account and Privacy',
    items: [
      {
        q: 'How do I sign in?',
        a: 'HipTrip supports sign-in via Google and email/password. Click "Sign In" in the top navigation to get started.',
      },
      {
        q: 'How do I delete my account?',
        a: 'To delete your account and all associated data, email us at support@hiptrip.net with the subject "Delete My Account." We\'ll process your request within 30 days.',
      },
      {
        q: 'Does HipTrip sell my data?',
        a: 'No. We do not sell your personal data to third parties. See our Privacy Policy for a full explanation of how we collect and use data.',
      },
      {
        q: 'How is my location used?',
        a: 'Your location (when granted) is used to suggest nearby stops and pre-fill your trip starting point. We do not track or store your real-time location history.',
      },
    ],
  },
  {
    category: 'Technical Issues',
    items: [
      {
        q: 'My trip failed to generate. What should I do?',
        a: 'Try refreshing and generating again. If the issue persists, it may be a temporary service disruption. You can also try a slightly different origin or destination — very obscure locations occasionally cause generation issues. If the problem continues, contact us at support@hiptrip.net.',
      },
      {
        q: 'The app is running slowly. Any tips?',
        a: 'HipTrip works best on modern browsers (Chrome, Safari, Firefox, Edge). Try clearing your browser cache or disabling browser extensions that might interfere. For mobile, using the latest OS version and a stable Wi-Fi or 5G connection helps.',
      },
      {
        q: 'I found a bug. How do I report it?',
        a: 'We appreciate bug reports! Please visit our Support page and send us a message with a description of the issue, the steps to reproduce it, and your device/browser. Screenshots are very helpful.',
      },
    ],
  },
];

const AccordionItem = ({ item }: { item: FaqItem }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-wayfarer-accent/20 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-4 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-wayfarer-text-main">{item.q}</span>
        <svg
          className={`mt-0.5 h-4 w-4 shrink-0 text-wayfarer-primary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-wayfarer-text-muted">{item.a}</p>
      )}
    </div>
  );
};

const FaqPage = () => (
  <main className="min-h-screen bg-wayfarer-bg px-6 py-24 font-body text-wayfarer-text-main md:px-10">
    <div className="mx-auto w-full max-w-4xl space-y-10">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wayfarer-text-muted">
          Help
        </p>
        <h1 className="font-display text-4xl font-bold text-wayfarer-primary md:text-5xl">
          Frequently Asked Questions
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-wayfarer-text-muted">
          Can&apos;t find an answer?{' '}
          <Link
            href="/support"
            className="font-semibold text-wayfarer-primary hover:opacity-80"
          >
            Contact our support team
          </Link>
          .
        </p>
      </div>

      <section className="space-y-6">
        {FAQ.map((cat) => (
          <article
            key={cat.category}
            className="rounded-2xl bg-wayfarer-surface p-6 shadow-wayfarer-soft md:p-8"
          >
            <h2 className="mb-4 font-display text-lg font-bold text-wayfarer-primary">
              {cat.category}
            </h2>
            <div>
              {cat.items.map((item) => (
                <AccordionItem key={item.q} item={item} />
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  </main>
);

export default FaqPage;
