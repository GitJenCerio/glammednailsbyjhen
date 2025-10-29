'use client';

import { lazy, Suspense } from 'react';
import Header from '@/components/Header';
import Hero from '@/components/Hero';

// Lazy load below-the-fold components for faster initial load
const Services = lazy(() => import('@/components/Services'));
const About = lazy(() => import('@/components/About'));
const Gallery = lazy(() => import('@/components/Gallery'));
const Pricing = lazy(() => import('@/components/Pricing'));
const FAQ = lazy(() => import('@/components/FAQ'));
const Footer = lazy(() => import('@/components/Footer'));

// Simple loading placeholder
const LoadingPlaceholder = () => (
  <div className="section-padding bg-white">
    <div className="max-w-7xl mx-auto">
      <div className="h-96 animate-pulse bg-gray-100 rounded-lg" />
    </div>
  </div>
);

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Suspense fallback={<LoadingPlaceholder />}>
        <Services />
      </Suspense>
      <Suspense fallback={<LoadingPlaceholder />}>
        <About />
      </Suspense>
      <Suspense fallback={<LoadingPlaceholder />}>
        <Gallery />
      </Suspense>
      <Suspense fallback={<LoadingPlaceholder />}>
        <Pricing />
      </Suspense>
      <Suspense fallback={<LoadingPlaceholder />}>
        <FAQ />
      </Suspense>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </main>
  );
}

