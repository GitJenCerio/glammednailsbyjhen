import { NextResponse } from 'next/server';
import { createBooking, listBookings, releaseExpiredPendingBookings } from '@/lib/services/bookingService';
import { fetchSheetRows } from '@/lib/googleSheets';
import { syncBookingWithForm } from '@/lib/services/bookingService';

async function syncGoogleSheets() {
  const range = process.env.GOOGLE_SHEETS_RANGE ?? "'Form Responses 1'!A:Z";
  const bookingIdColumn = process.env.GOOGLE_SHEETS_BOOKING_ID_COLUMN ?? 'bookingId';

  const rows = await fetchSheetRows(range);
  if (!rows.length) {
    return { processed: 0 };
  }

  const [header, ...dataRows] = rows;
  let processed = 0;

  const originalHeader = header.map((h) => (h || '').trim());
  const bookingIdColumnIndex = originalHeader.findIndex(
    (h) => h.toLowerCase() === bookingIdColumn.toLowerCase()
  );
  
  if (bookingIdColumnIndex === -1) {
    return { processed: 0 }; // Silently skip if column not found
  }

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
      processed += 1;
    }
  }

  return { processed };
}

export async function GET() {
  // Clean up expired pending bookings (no form submitted after 30 minutes)
  // This runs whenever admin loads the dashboard or bookings are fetched
  await releaseExpiredPendingBookings(30);
  
  // Auto-sync Google Sheets when admin loads dashboard
  // This ensures new form submissions are automatically synced
  try {
    const syncResult = await syncGoogleSheets();
    if (syncResult.processed > 0) {
      console.log(`Auto-synced ${syncResult.processed} new form responses`);
    }
  } catch (error) {
    // Silently fail - manual sync button is still available
    console.log('Auto-sync skipped (manual sync available)');
  }
  
  const bookings = await listBookings();
  return NextResponse.json({ bookings });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { slotId, serviceType, pairedSlotId, linkedSlotIds, clientType, serviceLocation } = body ?? {};

  if (!slotId) {
    return NextResponse.json({ error: 'Missing slotId.' }, { status: 400 });
  }

  try {
    const result = await createBooking(slotId, { serviceType, pairedSlotId, linkedSlotIds, clientType, serviceLocation });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to create booking.' }, { status: 400 });
  }
}

