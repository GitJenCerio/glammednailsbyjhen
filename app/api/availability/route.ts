import { NextResponse } from 'next/server';
import { listSlots } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';

// Prevent caching in production to ensure fresh slot data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // Automatic release is disabled - use manual release from admin dashboard instead
  // Return all slots (including booked/pending ones) so we can detect gaps in consecutive slot checking
  // Frontend will filter to show only available slots for display
  const [slots, blockedDates] = await Promise.all([listSlots(), listBlockedDates()]);
  
  // Prevent caching to ensure fresh data, especially after slot updates
  return NextResponse.json({ slots, blockedDates }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

