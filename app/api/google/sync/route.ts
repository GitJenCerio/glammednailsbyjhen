import { NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/googleSheets';
import { syncBookingWithForm } from '@/lib/services/bookingService';

export async function POST() {
  const range = process.env.GOOGLE_SHEETS_RANGE ?? "'Form Responses 1'!A:Z";
  const bookingIdColumn = process.env.GOOGLE_SHEETS_BOOKING_ID_COLUMN ?? 'bookingId';

  const rows = await fetchSheetRows(range);
  if (!rows.length) {
    return NextResponse.json({ processed: 0 });
  }

  const [header, ...dataRows] = rows;
  let processed = 0;

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    const record: Record<string, string> = {};
    header.forEach((key, columnIndex) => {
      record[key] = row[columnIndex];
    });

    const bookingId = record[bookingIdColumn];
    if (!bookingId) continue;

    const result = await syncBookingWithForm(bookingId, record, String(index + 2));
    if (result) {
      processed += 1;
    }
  }

  return NextResponse.json({ processed });
}

