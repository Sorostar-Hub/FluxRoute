/**
 * Root layout — sets up Tailwind, global styles, and the app shell.
 */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FluxRoute — Cross-protocol intent routing on Stellar',
  description:
    'Express what you want, and FluxRoute finds and executes the optimal route across Soroswap, Blend, DeFindex, and native path payments.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
