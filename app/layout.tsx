import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StructuredData } from "@/components/StructuredData";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.glammednailsbyjhen.com';
const siteName = 'glammednailsbyjhen';
const defaultTitle = `${siteName} - Professional Nail Art & Manicure Services`;
const defaultDescription = 'Premium Russian manicure, nail art, pedicure, and nail extension services in Manila, Philippines. Book your appointment online today!';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  keywords: [
    'nail salon',
    'nail studio',
    'manicure',
    'pedicure',
    'nail art',
    'Russian manicure',
    'nail extensions',
    'nail salon Manila',
    'nail services Philippines',
    'gel nails',
    'nail design',
    'nail technician',
    'nail care',
  ],
  authors: [{ name: 'glammednailsbyjhen' }],
  creator: 'glammednailsbyjhen',
  publisher: 'glammednailsbyjhen',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: '/logo.png',
        width: 400,
        height: 400,
        alt: 'glammednailsbyjhen - Professional Nail Services',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: defaultTitle,
    description: defaultDescription,
    images: ['/logo.png'],
    creator: '@glammednailsbyjhen', // Update with your actual Twitter handle if you have one
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your verification codes here when you set up Google Search Console
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
  alternates: {
    canonical: siteUrl,
  },
  category: 'Beauty Services',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <StructuredData />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

