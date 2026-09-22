import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'News Pulse — Topic-Clustered News Timeline',
  description:
    'Live news articles from BBC, NPR, and The Guardian, automatically grouped into topic clusters and visualized as an interactive timeline.',
  keywords: ['news', 'timeline', 'topic clustering', 'RSS', 'news aggregator'],
  authors: [{ name: 'Piyush' }],
  robots: 'index, follow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
