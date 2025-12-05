import { NextResponse } from 'next/server';
import { listBookings } from '@/lib/services/bookingService';
import { listSlots } from '@/lib/services/slotService';
import { addDays, format, parseISO } from 'date-fns';

/**
 * Combined daily cron job for Vercel Hobby tier (only 1 cron per day allowed)
 * Runs daily at 9:00 AM and handles:
 * 1. Release expired pending bookings (DISABLED - use manual release from admin dashboard)
 * 2. Sync Google Sheets (automatic form submission sync)
 * 3. Check appointments scheduled for tomorrow (email functionality disabled)
 */
export async function GET(request: Request) {
  // Verify this is a cron request (optional security check)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    expiredBookings: { released: 0 },
    googleSheetsSync: { processed: 0 },
    appointmentsTomorrow: { count: 0 },
  };

  try {
    // Task 1: Release expired pending bookings
    // DISABLED: Automatic release is disabled - use manual release from admin dashboard instead
    // try {
    //   await releaseExpiredPendingBookings(30);
    // } catch (error) {
    //   console.error('Error releasing expired bookings:', error);
    // }

    // Task 2: Sync Google Sheets (automatic form submission sync)
    try {
      const { fetchSheetRows } = await import('@/lib/googleSheets');
      const { syncBookingWithForm } = await import('@/lib/services/bookingService');
      
      const range = process.env.GOOGLE_SHEETS_RANGE ?? "'Form Responses 1'!A:Z";
      const bookingIdColumn = process.env.GOOGLE_SHEETS_BOOKING_ID_COLUMN ?? 'bookingId';
      
      const rows = await fetchSheetRows(range);
      if (rows.length > 1) {
        const [header, ...dataRows] = rows;
        const originalHeader = header.map((h) => (h || '').trim());
        const bookingIdColumnIndex = originalHeader.findIndex(
          (h) => h.toLowerCase() === bookingIdColumn.toLowerCase()
        );
        
        if (bookingIdColumnIndex !== -1) {
          const systemColumns = ['timestamp', 'booking id (autofill)', 'booking id'];
          const bookingIdColumnLower = bookingIdColumn.toLowerCase();
          
          for (let index = 0; index < dataRows.length; index += 1) {
            const row = dataRows[index];
            if (!row || row.length === 0) continue;
            
            const bookingId = (row[bookingIdColumnIndex] || '').trim();
            if (!bookingId) continue;
            
            const record: Record<string, string> = {};
            const fieldOrder: string[] = [];
            
            originalHeader.forEach((originalKey, columnIndex) => {
              if (!originalKey) return;
              const normalizedKey = originalKey.toLowerCase();
              if (systemColumns.includes(normalizedKey) || normalizedKey === bookingIdColumnLower) {
                return;
              }
              const value = (row[columnIndex] || '').trim();
              record[originalKey] = value;
              fieldOrder.push(originalKey);
            });
            
            const result = await syncBookingWithForm(bookingId, record, fieldOrder, String(index + 2));
            if (result) {
              results.googleSheetsSync.processed += 1;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error syncing Google Sheets:', error);
    }

    // Task 3: Check appointments scheduled for tomorrow (email disabled)
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
          results.appointmentsTomorrow.count++;
        }
      }
    } catch (error) {
      console.error('Error checking appointments:', error);
    }

    return NextResponse.json({
      success: true,
      date: format(new Date(), 'yyyy-MM-dd'),
      results,
      message: 'Email functionality disabled',
    });
  } catch (error: any) {
    console.error('Error in daily tasks cron:', error);
    return NextResponse.json({
      error: error.message || 'Failed to complete daily tasks',
      results,
    }, { status: 500 });
  }
}

