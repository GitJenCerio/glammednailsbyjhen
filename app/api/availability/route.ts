import { NextResponse } from 'next/server';
import { listSlots } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';
import { getDefaultNailTech } from '@/lib/services/nailTechService';

// Prevent caching in production to ensure fresh slot data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nailTechId = searchParams.get('nailTechId');
  
  // If no nailTechId provided, default to Ms. Jhen
  let targetNailTechId = nailTechId || null;
  if (!targetNailTechId) {
    const defaultNailTech = await getDefaultNailTech();
    if (defaultNailTech) {
      targetNailTechId = defaultNailTech.id;
    }
  }
  
  // Automatic release is disabled - use manual release from admin dashboard instead
  // Return all slots (including booked/pending ones) so we can detect gaps in consecutive slot checking
  // Frontend will filter to show only available slots for display
  const [slots, blockedDates] = await Promise.all([
    targetNailTechId ? listSlots(targetNailTechId) : listSlots(),
    listBlockedDates()
  ]);
  
  // Prevent caching to ensure fresh data, especially after slot updates
  return NextResponse.json({ slots, blockedDates }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

