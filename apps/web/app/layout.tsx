import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { auth } from '../auth';
import AuthSessionProvider from '../components/session-provider';
import GoogleMapsScriptLoader from '../components/GoogleMapsScriptLoader';

export const metadata: Metadata = {
  title: 'RoadTrip | Plan unforgettable drives',
  description:
    'RoadTrip surfaces curated attractions, optimizes routes, and helps you monetize curated travel content.',
  icons: {
    icon: '/favicon.svg',
  },
};

const RootLayout = async ({ children }: { children: ReactNode }) => {
  let session = null;

  try {
    session = await auth();
  } catch {
    session = null;
  }

  return (
    <html lang="en">
      <body>
        <GoogleMapsScriptLoader />
        <AuthSessionProvider session={session}>
          <main>{children}</main>
        </AuthSessionProvider>
      </body>
    </html>
  );
};

export default RootLayout;
