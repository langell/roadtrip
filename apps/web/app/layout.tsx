import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import './globals.css';
import { getSession } from '../lib/session';
import AuthSessionProvider from '../components/session-provider';
import GoogleMapsScriptLoader from '../components/GoogleMapsScriptLoader';
import ServiceWorkerRegistration from '../components/ServiceWorkerRegistration';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'HipTrip',
  description:
    'HipTrip surfaces curated attractions, optimizes routes, and helps you monetize curated travel content.',
  icons: {
    icon: '/favicon.png',
    apple: '/icons/icon-192x192.png',
  },
  manifest: '/manifest.json',
};

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getSession();

  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#1B4332" />
      </head>
      <body>
        <Script
          id="affiliate-tpembars"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=document.createElement("script");s.async=1;s.src='https://tpembars.com/NTE3NDMx.js?t=517431';document.head.appendChild(s);})();`,
          }}
        />
        <ServiceWorkerRegistration />
        <GoogleMapsScriptLoader />
        <AuthSessionProvider session={session}>
          <main>{children}</main>
        </AuthSessionProvider>
        <Analytics />
      </body>
    </html>
  );
};

export default RootLayout;
