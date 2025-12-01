import { NextResponse } from 'next/server';
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

  // Preserve original header with exact field names as they appear in the form
  // Only trim whitespace, keep all columns (including empty ones) to maintain proper column mapping
  const originalHeader = header.map((h) => (h || '').trim());
  
  // Find the booking ID column index using original header (with all columns)
  const bookingIdColumnIndex = originalHeader.findIndex(
    (h) => h.toLowerCase() === bookingIdColumn.toLowerCase()
  );
  
  if (bookingIdColumnIndex === -1) {
    throw new Error(`Booking ID column "${bookingIdColumn}" not found in sheet. Available columns: ${originalHeader.filter(h => h).join(', ')}`);
  }

  // System columns to exclude from customer data
  const systemColumns = ['timestamp', 'booking id (autofill)', 'booking id'];
  const bookingIdColumnLower = bookingIdColumn.toLowerCase();

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    
    // Skip empty rows
    if (!row || row.length === 0) continue;
    
    // Get booking ID from the correct column (using original header index)
    const bookingId = (row[bookingIdColumnIndex] || '').trim();
    if (!bookingId) continue;

    // Build record object preserving exact field names and order from the form
    // Use originalHeader to maintain proper column-to-data mapping
    const record: Record<string, string> = {};
    const fieldOrder: string[] = []; // Store the order of fields
    
    originalHeader.forEach((originalKey, columnIndex) => {
      // Skip empty header columns
      if (!originalKey) return;
      
      const normalizedKey = originalKey.toLowerCase();
      
      // Skip system columns and the booking ID column itself (it's not customer data)
      if (systemColumns.includes(normalizedKey) || normalizedKey === bookingIdColumnLower) {
        return;
      }
      
      // Get the value from the row using the same columnIndex
      // Handle cases where row might be shorter than header
      const value = (row[columnIndex] || '').trim();
      
      // Include the field with its exact original name from the form
      // This ensures "Email Address", "First Name", etc. appear exactly as in the form
      record[originalKey] = value;
      fieldOrder.push(originalKey); // Store the order
    });

    const result = await syncBookingWithForm(bookingId, record, fieldOrder, String(index + 2));
    if (result) {
      processed += 1;
    }
  }

  return { processed };
}

// Support both GET (for cron jobs) and POST (for manual sync)
export async function GET() {
  try {
    const result = await syncGoogleSheets();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Google Sheets sync error:', error);
    return NextResponse.json({ 
      error: error.message ?? 'Sync failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await syncGoogleSheets();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Google Sheets sync error:', error);
    return NextResponse.json({ 
      error: error.message ?? 'Sync failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

