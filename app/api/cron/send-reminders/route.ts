import { NextResponse } from 'next/server';
import { listBookings } from '@/lib/services/bookingService';
import { listSlots } from '@/lib/services/slotService';
import { getCustomerById } from '@/lib/services/customerService';
import { sendAppointmentReminderEmail } from '@/lib/email';
import { addDays, format, parseISO } from 'date-fns';

/**
 * Cron job to send appointment reminders the day before appointments
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

    let sent = 0;
    let errors = 0;

    // Find bookings scheduled for tomorrow
    for (const booking of confirmedBookings) {
      const slot = slotMap.get(booking.slotId);
      if (!slot) continue;

      // Check if booking is for tomorrow
      const bookingDate = parseISO(slot.date);
      const bookingDateStr = format(bookingDate, 'yyyy-MM-dd');
      
      if (bookingDateStr === tomorrowStr) {
        try {
          const customer = await getCustomerById(booking.customerId);
          if (customer && customer.email) {
            await sendAppointmentReminderEmail(booking, customer, slot.date, slot.time);
            sent++;
          }
        } catch (error) {
          console.error(`Failed to send reminder for booking ${booking.bookingId}:`, error);
          errors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: tomorrowStr,
      sent,
      errors,
      total: confirmedBookings.length,
    });
  } catch (error: any) {
    console.error('Error sending appointment reminders:', error);
    return NextResponse.json({
      error: error.message || 'Failed to send reminders',
    }, { status: 500 });
  }
}

