import { NextResponse } from 'next/server';
import { createBooking, listBookings } from '@/lib/services/bookingService';
import { fetchSheetRows } from '@/lib/googleSheets';
import { syncBookingWithForm } from '@/lib/services/bookingService';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shouldSync = searchParams.get('sync') === '1' || searchParams.get('sync') === 'true';

  if (shouldSync) {
    // Auto-sync Google Sheets when explicitly requested
    try {
      const syncResult = await syncGoogleSheets();
      if (syncResult.processed > 0) {
        console.log(`Auto-synced ${syncResult.processed} new form responses`);
      }
    } catch (error) {
      // Silently fail - manual sync button is still available
      console.log('Auto-sync skipped (manual sync available)');
    }
  }
  
  const bookings = await listBookings();
  
  // OPTIMIZED: Use stale-while-revalidate (10 seconds fresh, 30 seconds stale)
  // Bookings change frequently but short cache reduces reads significantly
  // Admin dashboard syncs every 2 minutes anyway, so 10s cache is safe
  return NextResponse.json({ bookings }, {
    headers: {
      'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=30',
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { slotId, serviceType, pairedSlotId, linkedSlotIds, clientType, repeatClientEmail, serviceLocation, socialMediaName } = body ?? {};

  if (!slotId) {
    return NextResponse.json({ error: 'Missing slotId.' }, { status: 400 });
  }

  try {
    const result = await createBooking(slotId, { serviceType, pairedSlotId, linkedSlotIds, clientType, repeatClientEmail, serviceLocation, socialMediaName });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to create booking.' }, { status: 400 });
  }
}

