import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'RoadTrip | Plan unforgettable drives',
  description:
    'RoadTrip surfaces curated attractions, optimizes routes, and helps you monetize curated travel content.'
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>
      <main>{children}</main>
    </body>
  </html>
);

export default RootLayout;
