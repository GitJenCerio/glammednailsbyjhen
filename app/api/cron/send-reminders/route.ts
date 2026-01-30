import { NextResponse } from 'next/server';
import { listBookings } from '@/lib/services/bookingService';
import { listSlots } from '@/lib/services/slotService';
import { addDays, format, parseISO } from 'date-fns';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

/**
 * Cron job to check appointments scheduled for tomorrow
 * Email functionality is disabled
 * Runs daily at 9:00 AM
 */
export async function GET(request: Request) {
  // Verify this is a cron request (optional security check)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

    // OPTIMIZED: Query only slots for tomorrow instead of all slots
    const { getSlotsByDate } = await import('@/lib/services/slotService');
    const slots = await getSlotsByDate(tomorrowStr);
    const slotMap = new Map(slots.map(s => [s.id, s]));

    // OPTIMIZED: Query only confirmed bookings and filter by slot IDs for tomorrow
    // This avoids fetching all bookings
    const { adminDb } = await import('@/lib/firebaseAdmin');
    const bookingsSnapshot = await adminDb
      .collection('bookings')
      .where('status', '==', 'confirmed')
      .get();
    
    const slotIds = new Set(slots.map(s => s.id));
    let count = 0;

    // Find bookings scheduled for tomorrow (only check bookings that reference tomorrow's slots)
    for (const doc of bookingsSnapshot.docs) {
      const booking = doc.data();
      if (slotIds.has(booking.slotId)) {
        count++;
      }
    }

    return NextResponse.json({
      success: true,
      date: tomorrowStr,
      message: 'Email functionality disabled',
      appointmentsTomorrow: count,
      total: bookingsSnapshot.docs.length,
    });
  } catch (error: any) {
    console.error('Error checking appointments:', error);
    return NextResponse.json({
      error: error.message || 'Failed to check appointments',
    }, { status: 500 });
  }
}

