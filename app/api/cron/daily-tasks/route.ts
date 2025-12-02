import { NextResponse } from 'next/server';
import { listBookings, releaseExpiredPendingBookings } from '@/lib/services/bookingService';
import { listSlots } from '@/lib/services/slotService';
import { getCustomerById } from '@/lib/services/customerService';
import { sendAppointmentReminderEmail } from '@/lib/email';
import { addDays, format, parseISO } from 'date-fns';

/**
 * Combined daily cron job for Vercel Hobby tier (only 1 cron per day allowed)
 * Runs daily at 9:00 AM and handles:
 * 1. Release expired pending bookings
 * 2. Send appointment reminders for tomorrow's appointments
 */
export async function GET(request: Request) {
  // Verify this is a cron request (optional security check)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    expiredBookings: { released: 0 },
    reminders: { sent: 0, errors: 0 },
  };

  try {
    // Task 1: Release expired pending bookings
    try {
      await releaseExpiredPendingBookings(30);
    } catch (error) {
      console.error('Error releasing expired bookings:', error);
    }

    // Task 2: Send appointment reminders for tomorrow
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
              results.reminders.sent++;
            }
          } catch (error) {
            console.error(`Failed to send reminder for booking ${booking.bookingId}:`, error);
            results.reminders.errors++;
          }
        }
      }
    } catch (error) {
      console.error('Error sending appointment reminders:', error);
    }

    return NextResponse.json({
      success: true,
      date: format(new Date(), 'yyyy-MM-dd'),
      results,
    });
  } catch (error: any) {
    console.error('Error in daily tasks cron:', error);
    return NextResponse.json({
      error: error.message || 'Failed to complete daily tasks',
      results,
    }, { status: 500 });
  }
}

