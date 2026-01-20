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

    // Get all confirmed bookings
    const bookings = await listBookings();
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');

    // Get all slots to match with bookings
    const slots = await listSlots();
    const slotMap = new Map(slots.map(s => [s.id, s]));

    let count = 0;

    // Find bookings scheduled for tomorrow
    for (const booking of confirmedBookings) {
      const slot = slotMap.get(booking.slotId);
      if (!slot) continue;

      // Check if booking is for tomorrow
      const bookingDate = parseISO(slot.date);
      const bookingDateStr = format(bookingDate, 'yyyy-MM-dd');
      
      if (bookingDateStr === tomorrowStr) {
        count++;
      }
    }

    return NextResponse.json({
      success: true,
      date: tomorrowStr,
      message: 'Email functionality disabled',
      appointmentsTomorrow: count,
      total: confirmedBookings.length,
    });
  } catch (error: any) {
    console.error('Error checking appointments:', error);
    return NextResponse.json({
      error: error.message || 'Failed to check appointments',
    }, { status: 500 });
  }
}

