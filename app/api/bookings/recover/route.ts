import { NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/googleSheets';
import { syncBookingWithForm, createBooking } from '@/lib/services/bookingService';
import { listSlots } from '@/lib/services/slotService';
import { parseISO, format } from 'date-fns';

/**
 * POST: Recover an expired booking from Google Sheets form data
 * Body: { bookingId: string }
 * 
 * This will:
 * 1. Find the form submission in Google Sheets
 * 2. Extract the date and time from the form
 * 3. Find or create the slot(s) for that date/time
 * 4. Recreate the booking and sync with form data
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    // Normalize booking ID (handle both GN-00001 and GN00001 formats)
    const normalizedBookingId = bookingId.startsWith('GN-') ? bookingId : `GN-${bookingId.padStart(5, '0')}`;

    const range = process.env.GOOGLE_SHEETS_RANGE ?? "'Form Responses 1'!A:Z";
    const bookingIdColumn = process.env.GOOGLE_SHEETS_BOOKING_ID_COLUMN ?? 'bookingId';
    const formDateEntryKey = process.env.GOOGLE_FORM_DATE_ENTRY;
    const formTimeEntryKey = process.env.GOOGLE_FORM_TIME_ENTRY;

    // Fetch all form responses
    const rows = await fetchSheetRows(range);
    if (!rows.length) {
      return NextResponse.json({ error: 'No form responses found in Google Sheets' }, { status: 404 });
    }

    const [header, ...dataRows] = rows;
    const originalHeader = header.map((h) => (h || '').trim());
    const bookingIdColumnIndex = originalHeader.findIndex(
      (h) => h.toLowerCase() === bookingIdColumn.toLowerCase()
    );

    if (bookingIdColumnIndex === -1) {
      return NextResponse.json({ 
        error: `Booking ID column "${bookingIdColumn}" not found in sheet. Available columns: ${originalHeader.filter(h => h).join(', ')}` 
      }, { status: 400 });
    }

    // Find the form submission with matching booking ID
    let formRow: string[] | null = null;
    let formRowIndex = -1;

    for (let index = 0; index < dataRows.length; index += 1) {
      const row = dataRows[index];
      if (!row || row.length === 0) continue;
      
      const rowBookingId = (row[bookingIdColumnIndex] || '').trim();
      // Normalize for comparison
      const normalizedRowBookingId = rowBookingId.startsWith('GN-') 
        ? rowBookingId 
        : rowBookingId.match(/^GN(\d+)$/) 
          ? `GN-${rowBookingId.substring(2).padStart(5, '0')}`
          : rowBookingId;

      if (normalizedRowBookingId === normalizedBookingId) {
        formRow = row;
        formRowIndex = index;
        break;
      }
    }

    if (!formRow) {
      return NextResponse.json({ 
        error: `Form submission for booking ID "${normalizedBookingId}" not found in Google Sheets. Please check the booking ID.` 
      }, { status: 404 });
    }

    // Build form data record
    const systemColumns = ['timestamp', 'booking id (autofill)', 'booking id'];
    const bookingIdColumnLower = bookingIdColumn.toLowerCase();
    const record: Record<string, string> = {};
    const fieldOrder: string[] = [];

    originalHeader.forEach((originalKey, columnIndex) => {
      if (!originalKey) return;
      const normalizedKey = originalKey.toLowerCase();
      if (systemColumns.includes(normalizedKey) || normalizedKey === bookingIdColumnLower) {
        return;
      }
      const value = (formRow![columnIndex] || '').trim();
      record[originalKey] = value;
      fieldOrder.push(originalKey);
    });

    // Extract date and time from form data
    // Try multiple strategies to find date and time fields
    let slotDate: string | null = null;
    let slotTime: string | null = null;

    // Helper function to parse date from various formats
    const parseDate = (dateStr: string): string | null => {
      if (!dateStr || !dateStr.trim()) return null;
      
      // Handle format: "Tuesday, January 13, 2026" (EEEE, MMMM d, yyyy)
      // This is the format used when autofilled from the booking system
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch {
        // Continue to next format
      }
      
      // Handle MM/DD/YYYY format
      const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateMatch) {
        const [, month, day, year] = dateMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Try to parse as ISO date (YYYY-MM-DD)
      try {
        const parsed = parseISO(dateStr);
        if (!isNaN(parsed.getTime())) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch {
        // Continue to next format
      }
      
      return null;
    };

    // Helper function to parse time from various formats
    const parseTime = (timeStr: string): string | null => {
      if (!timeStr || !timeStr.trim()) return null;
      
      // Handle format: "8:00 AM" (autofilled format - single digit hour, no leading zero)
      // Also handles "10:30 AM" or "10:30 AM - 2:00 PM" (time ranges)
      // Extract the first time from the string
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        let [, hours, minutes, ampm] = timeMatch;
        let hour24 = parseInt(hours, 10);
        if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
          hour24 += 12;
        } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
          hour24 = 0;
        }
        return `${hour24.toString().padStart(2, '0')}:${minutes}`;
      }
      
      // Try 24-hour format (HH:mm)
      const time24Match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (time24Match) {
        const [, hours, minutes] = time24Match;
        const hour24 = parseInt(hours, 10);
        if (hour24 >= 0 && hour24 < 24) {
          return `${hour24.toString().padStart(2, '0')}:${minutes}`;
        }
      }
      
      return null;
    };

    // Strategy 1: Use environment variable field names if set
    if (formDateEntryKey && record[formDateEntryKey]) {
      slotDate = parseDate(record[formDateEntryKey]);
    }
    
    if (formTimeEntryKey && record[formTimeEntryKey]) {
      slotTime = parseTime(record[formTimeEntryKey]);
    }

    // Strategy 2: Try to find date/time fields by common names (case-insensitive)
    if (!slotDate) {
      const dateFieldNames = ['date', 'appointment date', 'booking date', 'preferred date', 'date of appointment'];
      for (const fieldName of dateFieldNames) {
        for (const [key, value] of Object.entries(record)) {
          if (key.toLowerCase().includes(fieldName) && value) {
            slotDate = parseDate(value);
            if (slotDate) break;
          }
        }
        if (slotDate) break;
      }
    }

    if (!slotTime) {
      const timeFieldNames = ['time', 'appointment time', 'booking time', 'preferred time', 'time of appointment'];
      for (const fieldName of timeFieldNames) {
        for (const [key, value] of Object.entries(record)) {
          if (key.toLowerCase().includes(fieldName) && value) {
            slotTime = parseTime(value);
            if (slotTime) break;
          }
        }
        if (slotTime) break;
      }
    }

    // If still not found, return helpful error with all available fields
    if (!slotDate || !slotTime) {
      const availableFields = Object.keys(record).filter(k => record[k] && record[k].trim());
      const fieldValues = Object.entries(record)
        .filter(([k, v]) => v && v.trim())
        .map(([k, v]) => `${k}: "${v}"`)
        .join(', ');
      
      return NextResponse.json({ 
        error: `Could not extract date and time from form data. Date: ${slotDate || 'missing'}, Time: ${slotTime || 'missing'}.`,
        details: {
          expectedDateField: formDateEntryKey || 'Not configured (check GOOGLE_FORM_DATE_ENTRY)',
          expectedTimeField: formTimeEntryKey || 'Not configured (check GOOGLE_FORM_TIME_ENTRY)',
          availableFields: availableFields,
          formData: record,
          fieldValues: fieldValues
        },
        suggestion: 'Please check your Google Form field names and ensure GOOGLE_FORM_DATE_ENTRY and GOOGLE_FORM_TIME_ENTRY environment variables are set correctly, or manually recreate the booking.'
      }, { status: 400 });
    }

    // Find the slot for this date and time
    const allSlots = await listSlots();
    let slot = allSlots.find(s => s.date === slotDate && s.time === slotTime);

    if (!slot) {
      return NextResponse.json({ 
        error: `Slot not found for date ${slotDate} and time ${slotTime}. The slot may have been deleted. You may need to recreate the slot first.`,
        slotDate,
        slotTime,
        formData: record
      }, { status: 404 });
    }

    // Check if slot is available or pending
    if (slot.status !== 'available' && slot.status !== 'pending') {
      return NextResponse.json({ 
        error: `Slot is ${slot.status} and cannot be used for recovery. Please select a different slot or release the current one.`,
        slotId: slot.id,
        slotStatus: slot.status
      }, { status: 400 });
    }

    // Try to sync with existing booking first (in case it still exists)
    const syncResult = await syncBookingWithForm(normalizedBookingId, record, fieldOrder, String(formRowIndex + 2));
    
    if (syncResult) {
      // Booking exists and was synced successfully
      return NextResponse.json({ 
        success: true,
        message: `Booking ${normalizedBookingId} was found and synced with form data.`,
        booking: syncResult
      });
    }

    // Booking doesn't exist, need to recreate it
    // Determine service type from form data or use default
    // You might need to adjust this based on your form fields
    const serviceType = (record['Service Type'] || record['Service'] || 'manicure') as any;
    const clientType = (record['Client Type'] || 'new') as any;
    const serviceLocation = (record['Service Location'] || 'homebased_studio') as any;
    
    // Check if we need linked slots based on service type
    const { getRequiredSlotCount } = await import('@/lib/services/bookingService');
    const requiredSlots = getRequiredSlotCount(serviceType as any);
    const linkedSlotIds: string[] = [];
    
    if (requiredSlots > 1) {
      // Find consecutive slots
      const { getNextSlotTime } = await import('@/lib/constants/slots');
      let currentSlot = slot;
      for (let i = 1; i < requiredSlots; i++) {
        const nextTime = getNextSlotTime(currentSlot.time);
        if (!nextTime) break;
        const nextSlot = allSlots.find(s => s.date === slotDate && s.time === nextTime);
        if (nextSlot && (nextSlot.status === 'available' || nextSlot.status === 'pending')) {
          linkedSlotIds.push(nextSlot.id);
          currentSlot = nextSlot;
        } else {
          return NextResponse.json({ 
            error: `Service requires ${requiredSlots} consecutive slots, but only found ${i} available slots.`,
            slotDate,
            slotTime,
            requiredSlots
          }, { status: 400 });
        }
      }
    }
    
    // Recover the booking with the original booking ID
    const { recoverBookingFromForm } = await import('@/lib/services/bookingService');
    const recoveredBooking = await recoverBookingFromForm(
      normalizedBookingId,
      slot.id,
      {
        serviceType,
        clientType,
        serviceLocation,
        linkedSlotIds: linkedSlotIds.length > 0 ? linkedSlotIds : undefined,
        pairedSlotId: linkedSlotIds[0] || undefined,
      },
      record,
      fieldOrder,
      String(formRowIndex + 2)
    );

    return NextResponse.json({ 
      success: true,
      message: `Booking ${normalizedBookingId} has been recovered and synced with form data.`,
      booking: recoveredBooking
    });

  } catch (error: any) {
    console.error('Error recovering booking:', error);
    return NextResponse.json({ 
      error: error.message ?? 'Failed to recover booking',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

