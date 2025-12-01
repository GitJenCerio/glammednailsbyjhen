import { NextResponse } from 'next/server';
import { listSlots } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';
import { slotIsBlocked } from '@/lib/scheduling';
import { releaseExpiredPendingBookings } from '@/lib/services/bookingService';

export async function GET() {
  await releaseExpiredPendingBookings(30);
  const [slots, blockedDates] = await Promise.all([listSlots(), listBlockedDates()]);
  // Return all slots (including booked ones) so we can detect gaps in consecutive slot checking
  // Frontend will filter to show only available slots for display
  return NextResponse.json({ slots, blockedDates });
}

