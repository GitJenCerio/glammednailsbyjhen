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
  
  // OPTIMIZED: Use date range instead of fetching ALL slots
  // This prevents the 119K reads issue - was fetching all slots every time
  // Fetch next 3 months of slots (enough for booking page)
  const today = new Date();
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
  const startDate = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const endDate = threeMonthsLater.toISOString().slice(0, 10);
  const todayStr = startDate; // Use startDate (which is today) for filtering
  
  const { listSlotsByDateRange } = await import('@/lib/services/slotService');
  
  // Return slots (including booked/pending ones) so we can detect gaps in consecutive slot checking
  // Frontend will filter to show only available slots for display
  // IMPORTANT: Filter out hidden slots from public booking page
  const [allSlots, blockedDates] = await Promise.all([
    targetNailTechId 
      ? listSlotsByDateRange(startDate, endDate, targetNailTechId)
      : listSlotsByDateRange(startDate, endDate),
    listBlockedDates()
  ]);
  
  // Filter out hidden slots and past-date slots - they should not be visible to customers
  const slots = allSlots.filter((slot) => !slot.isHidden && slot.date >= todayStr);
  
  // OPTIMIZED: Use stale-while-revalidate caching (30 seconds fresh, 60 seconds stale)
  // This reduces Firestore reads while still showing relatively fresh data
  // Slots change infrequently, so short cache is safe
  return NextResponse.json({ slots, blockedDates }, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'CDN-Cache-Control': 'public, s-maxage=30',
    },
  });
}

