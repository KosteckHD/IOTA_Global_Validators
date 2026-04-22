import type { Metadata } from 'next';
import { Oxanium, Space_Grotesk } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

const oxanium = Oxanium({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-oxanium',
});

export const metadata: Metadata = {
  title: 'IOTA Future Globe',
  description: 'Live interactive IOTA validators globe with streaming updates.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${oxanium.variable}`}>
      <head>
        <link rel="preload" as="image" href="/globe/night-sky.png" crossOrigin="anonymous" />
        <link rel="preload" as="image" href="/globe/earth-topology.png" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
