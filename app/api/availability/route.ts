import { NextResponse } from 'next/server';
import { listSlots } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';

export async function GET() {
  // Automatic release is disabled - use manual release from admin dashboard instead
  // Return all slots (including booked/pending ones) so we can detect gaps in consecutive slot checking
  // Frontend will filter to show only available slots for display
  const [slots, blockedDates] = await Promise.all([listSlots(), listBlockedDates()]);
  
  // Reduced cache time for availability to ensure fresh data for client booking
  // Cache is bypassed by client with cache: 'no-store' and timestamp query param
  return NextResponse.json({ slots, blockedDates }, {
    headers: {
      'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=10',
      'CDN-Cache-Control': 'public, s-maxage=1',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=1',
    },
  });
}

