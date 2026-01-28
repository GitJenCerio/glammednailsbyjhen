// Load environment variables from .env.local
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = cleanValue;
      }
    }
  });
} catch (error) {
  console.warn('Could not load .env.local file, using existing environment variables');
}

import { fetchSheetRows } from '../lib/googleSheets';
import { recoverBookingFromForm } from '../lib/services/bookingService';
import { getSlotsByDate, createSlot } from '../lib/services/slotService';
import { getDefaultNailTech } from '../lib/services/nailTechService';
import { getRequiredSlotCount } from '../lib/services/bookingService';
import { getNextSlotTime } from '../lib/constants/slots';
import { listBlockedDates } from '../lib/services/blockService';

/**
 * Recover a booking from Google Sheets by booking ID
 * Usage: npx tsx scripts/recover-booking-from-sheet.ts GN-00113
 */
async function recoverBookingFromSheet(bookingId: string) {
  console.log(`\n🔍 Searching for booking ${bookingId} in Google Sheets...\n`);

  // Fetch data from Google Sheets
  const range = process.env.GOOGLE_SHEETS_RANGE ?? "'Form Responses 1'!A:Z";
  const bookingIdColumn = process.env.GOOGLE_SHEETS_BOOKING_ID_COLUMN ?? 'bookingId';

  const rows = await fetchSheetRows(range);
  if (!rows.length) {
    throw new Error('No data found in Google Sheets');
  }

  const [header, ...dataRows] = rows;
  const originalHeader = header.map((h) => (h || '').trim());
  
  // Find the booking ID column
  const bookingIdColumnIndex = originalHeader.findIndex(
    (h) => h.toLowerCase() === bookingIdColumn.toLowerCase()
  );
  
  if (bookingIdColumnIndex === -1) {
    throw new Error(`Booking ID column "${bookingIdColumn}" not found. Available columns: ${originalHeader.filter(h => h).join(', ')}`);
  }

  // System columns to exclude
  const systemColumns = ['timestamp', 'booking id (autofill)', 'booking id'];
  const bookingIdColumnLower = bookingIdColumn.toLowerCase();

  // Find the row with the matching booking ID
  let targetRow: string[] | null = null;
  let rowIndex = -1;

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    if (!row || row.length === 0) continue;
    
    const rowBookingId = (row[bookingIdColumnIndex] || '').trim();
    if (rowBookingId === bookingId) {
      targetRow = row;
      rowIndex = index + 2; // +2 because row 1 is header, and sheets are 1-indexed
      break;
    }
  }

  if (!targetRow) {
    throw new Error(`Booking ${bookingId} not found in Google Sheets`);
  }

  console.log(`✅ Found booking ${bookingId} in row ${rowIndex}\n`);

  // Build form data record
  const formData: Record<string, string> = {};
  const fieldOrder: string[] = [];

  originalHeader.forEach((originalKey, columnIndex) => {
    if (!originalKey) return;
    
    const normalizedKey = originalKey.toLowerCase();
    
    // Skip system columns and booking ID column
    if (systemColumns.includes(normalizedKey) || normalizedKey === bookingIdColumnLower) {
      return;
    }
    
    const value = (targetRow![columnIndex] || '').trim();
    formData[originalKey] = value;
    fieldOrder.push(originalKey);
  });

  console.log('📋 Form data extracted:');
  console.log(JSON.stringify(formData, null, 2));
  console.log('');

  // Extract date and time from form data
  const appointmentDateField = 
    formData['Appointment Date (Autofill)'] ||
    formData['Appointment Date'] ||
    formData['appointment date'] ||
    formData['AppointmentDate'] ||
    formData['Date'] ||
    formData['date'];

  const appointmentTimeField =
    formData['Appointment Time (AutoFill)'] ||
    formData['Appointment Time (Autofill)'] ||
    formData['Appointment Time'] ||
    formData['Time'] ||
    formData['time'] ||
    formData['AppointmentTime'];

  if (!appointmentDateField || !appointmentTimeField) {
    throw new Error(`Missing date or time in form data. Date: ${appointmentDateField || 'NOT FOUND'}, Time: ${appointmentTimeField || 'NOT FOUND'}`);
  }

  // Parse date
  let parsedDate: Date | null = null;
  const dateStr = String(appointmentDateField).trim();
  parsedDate = new Date(dateStr);
  
  if (isNaN(parsedDate.getTime())) {
    // Try parsing format like "Tuesday, January 13, 2026"
    const dateMatch = dateStr.match(/(\w+day),\s+(\w+)\s+(\d+),\s+(\d+)/);
    if (dateMatch) {
      const [, , monthName, day, year] = dateMatch;
      const monthMap: Record<string, number> = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3,
        'May': 4, 'June': 5, 'July': 6, 'August': 7,
        'September': 8, 'October': 9, 'November': 10, 'December': 11
      };
      const month = monthMap[monthName] ?? 0;
      parsedDate = new Date(parseInt(year), month, parseInt(day));
    }
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) {
    throw new Error(`Could not parse date: ${appointmentDateField}`);
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const slotDate = `${year}-${month}-${day}`;

  // Parse time
  const timeStr = String(appointmentTimeField).trim();
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!timeMatch) {
    throw new Error(`Could not parse time: ${appointmentTimeField}`);
  }

  let hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2];
  const ampm = timeMatch[3]?.toUpperCase();
  
  if (ampm === 'PM' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }
  
  const slotTime = `${String(hours).padStart(2, '0')}:${minutes}`;

  console.log(`📅 Extracted appointment: ${slotDate} at ${slotTime}\n`);

  // Determine service type from form data
  const serviceTypeField = 
    formData['Service Type'] ||
    formData['Service'] ||
    formData['service type'] ||
    formData['service'];
  
  let serviceType: 'manicure' | 'pedicure' | 'mani_pedi' | 'home_service_2slots' | 'home_service_3slots' = 'manicure';
  
  if (serviceTypeField) {
    const serviceTypeLower = String(serviceTypeField).toLowerCase();
    if (serviceTypeLower.includes('mani') && serviceTypeLower.includes('pedi')) {
      serviceType = 'mani_pedi';
    } else if (serviceTypeLower.includes('pedicure')) {
      serviceType = 'pedicure';
    } else if (serviceTypeLower.includes('home service') || serviceTypeLower.includes('home_service')) {
      // Check if it mentions 2 or 3 slots
      if (serviceTypeLower.includes('3') || serviceTypeLower.includes('three')) {
        serviceType = 'home_service_3slots';
      } else if (serviceTypeLower.includes('2') || serviceTypeLower.includes('two')) {
        serviceType = 'home_service_2slots';
      } else {
        serviceType = 'home_service_2slots'; // Default for home service
      }
    }
  }

  const requiredSlotCount = getRequiredSlotCount(serviceType);
  console.log(`🔧 Service type: ${serviceType} (requires ${requiredSlotCount} slot(s))\n`);

  // Get default nail tech
  const defaultNailTech = await getDefaultNailTech();
  if (!defaultNailTech) {
    throw new Error('No default nail tech found');
  }

  console.log(`👤 Using nail tech: ${defaultNailTech.name} (${defaultNailTech.id})\n`);

  // Get blocked dates
  const blocks = await listBlockedDates();

  // Find or create slots
  const slotsOnDate = await getSlotsByDate(slotDate, defaultNailTech.id);
  let primarySlot = slotsOnDate.find(s => s.time === slotTime && (s.status === 'available' || s.status === 'pending'));

  if (!primarySlot) {
    console.log(`⚠️  Slot not found at ${slotDate} ${slotTime}, creating new slot...\n`);
    primarySlot = await createSlot({
      date: slotDate,
      time: slotTime,
      nailTechId: defaultNailTech.id,
      status: 'pending',
    }, blocks);
    console.log(`✅ Created slot: ${primarySlot.id}\n`);
  } else {
    console.log(`✅ Found existing slot: ${primarySlot.id}\n`);
  }

  // Find or create linked slots if needed
  const linkedSlotIds: string[] = [];
  if (requiredSlotCount > 1) {
    let currentTime = slotTime;
    for (let i = 1; i < requiredSlotCount; i++) {
      const nextTime = getNextSlotTime(currentTime);
      if (!nextTime) {
        throw new Error(`Cannot determine next slot time after ${currentTime}`);
      }

      let linkedSlot = slotsOnDate.find(s => s.time === nextTime && (s.status === 'available' || s.status === 'pending'));
      
      if (!linkedSlot) {
        console.log(`⚠️  Linked slot not found at ${slotDate} ${nextTime}, creating new slot...\n`);
        linkedSlot = await createSlot({
          date: slotDate,
          time: nextTime,
          nailTechId: defaultNailTech.id,
          status: 'pending',
        }, blocks);
        console.log(`✅ Created linked slot: ${linkedSlot.id}\n`);
      } else {
        console.log(`✅ Found existing linked slot: ${linkedSlot.id}\n`);
      }

      linkedSlotIds.push(linkedSlot.id);
      currentTime = nextTime;
    }
  }

  // Determine service location
  const serviceLocationField = 
    formData['Service Location'] ||
    formData['Location'] ||
    formData['service location'] ||
    formData['location'];
  
  let serviceLocation: 'homebased_studio' | 'home_service' = 'homebased_studio';
  if (serviceLocationField) {
    const locationLower = String(serviceLocationField).toLowerCase();
    if (locationLower.includes('home service') || locationLower.includes('home_service')) {
      serviceLocation = 'home_service';
    }
  }

  // Recover the booking
  console.log(`🔄 Recovering booking ${bookingId}...\n`);
  
  const booking = await recoverBookingFromForm(
    bookingId,
    primarySlot.id,
    {
      serviceType,
      linkedSlotIds: linkedSlotIds.length > 0 ? linkedSlotIds : undefined,
      serviceLocation,
    },
    formData,
    fieldOrder,
    String(rowIndex)
  );

  console.log(`\n✅ Successfully recovered booking ${bookingId}!`);
  console.log(`   Booking ID: ${booking.bookingId}`);
  console.log(`   Status: ${booking.status}`);
  console.log(`   Slot: ${booking.slotId}`);
  console.log(`   Customer: ${booking.customerId}`);
  console.log(`   Service: ${booking.serviceType}`);
  console.log(`   Location: ${booking.serviceLocation || 'homebased_studio'}\n`);

  return booking;
}

// Run the script
const bookingId = process.argv[2];
if (!bookingId) {
  console.error('Usage: npx tsx scripts/recover-booking-from-sheet.ts <BOOKING_ID>');
  console.error('Example: npx tsx scripts/recover-booking-from-sheet.ts GN-00113');
  process.exit(1);
}

recoverBookingFromSheet(bookingId)
  .then(() => {
    console.log('✅ Recovery completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error recovering booking:', error);
    process.exit(1);
  });
