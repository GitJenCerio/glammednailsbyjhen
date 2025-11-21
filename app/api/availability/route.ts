import { NextResponse } from 'next/server';
import { listSlots } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';
import { slotIsBlocked } from '@/lib/scheduling';
import { releaseExpiredPendingBookings } from '@/lib/services/bookingService';

export async function GET() {
  await releaseExpiredPendingBookings(20);
  const [slots, blockedDates] = await Promise.all([listSlots(), listBlockedDates()]);
  const availableSlots = slots.filter((slot) => slot.status === 'available' && !slotIsBlocked(slot, blockedDates));
  return NextResponse.json({ slots: availableSlots, blockedDates });
}

