import { NextResponse } from 'next/server';
import { listSlots } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';

export async function GET() {
  // Automatic release is disabled - use manual release from admin dashboard instead
  // Return all slots (including booked/pending ones) so we can detect gaps in consecutive slot checking
  // Frontend will filter to show only available slots for display
  const [slots, blockedDates] = await Promise.all([listSlots(), listBlockedDates()]);
  
  // Add caching headers for better performance (shorter cache for availability)
  return NextResponse.json({ slots, blockedDates }, {
    headers: {
      'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
      'CDN-Cache-Control': 'public, s-maxage=5',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=5',
    },
  });
}

