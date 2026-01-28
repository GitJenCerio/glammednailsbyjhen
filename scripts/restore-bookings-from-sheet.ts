import fs from 'fs';
import path from 'path';
import { format, parse } from 'date-fns';
import { fetchSheetRows } from '../lib/googleSheets';
import { adminDb } from '../lib/firebaseAdmin';
import { listBlockedDates } from '../lib/services/blockService';
import { listSlots } from '../lib/services/slotService';
import {
  getRequiredSlotCount,
  recoverBookingFromForm,
} from '../lib/services/bookingService';
import { createDefaultNailTech, getDefaultNailTech } from '../lib/services/nailTechService';
import { getNextSlotTime } from '../lib/constants/slots';
import { ServiceType } from '../lib/types';
import { preventSlotInBlockedRange } from '../lib/scheduling';

const requestedBookingIdsRaw = [
  'GN-00036',
  'GN-00022',
  'GN-00042',
  'GN-00021',
  'GN-00048',
  'GN-00057',
  'GN-00089',
  'GN-00094',
  'GN-00114',
  'GN00115',
  'GN0013',
  'GN00113',
];

const depositBookingIdsRaw = ['GN-00114', 'GN00115'];

// Use the provided nail tech ID (Ms. Jhen)
const preferredNailTechId = 'Us8hl6OjrmsyCfKSG1qq';

function loadEnvFile(filename: string) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) return;
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function normalizeBookingId(raw: string) {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed.startsWith('GN')) return trimmed;
  if (trimmed.startsWith('GN-')) return trimmed;
  const digits = trimmed.replace('GN', '').replace(/[^0-9]/g, '');
  if (!digits) return trimmed;
  return `GN-${digits.padStart(5, '0')}`;
}

function parseDateToISO(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return format(new Date(parsed), 'yyyy-MM-dd');
  }
  try {
    const parsedWithFormat = parse(raw, 'EEEE, MMMM d, yyyy', new Date());
    if (!Number.isNaN(parsedWithFormat.getTime())) {
      return format(parsedWithFormat, 'yyyy-MM-dd');
    }
  } catch {
    // ignore
  }
  return null;
}

function parseTimeToSlotTime(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const startPart = raw.split('-')[0]?.trim() ?? raw;
  const match = startPart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  let hour24 = hours % 12;
  if (period === 'PM') hour24 += 12;
  return `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function parseDurationMinutes(value: string) {
  const raw = value.trim();
  if (!raw.includes('-')) return null;
  const [startRaw, endRaw] = raw.split('-').map((part) => part.trim());
  const start = Date.parse(`2000-01-01 ${startRaw}`);
  const end = Date.parse(`2000-01-01 ${endRaw}`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 60000));
}

function inferServiceLocation(value: string): 'homebased_studio' | 'home_service' {
  return value.toLowerCase().includes('home service') ? 'home_service' : 'homebased_studio';
}

function inferServiceType(
  serviceText: string,
  serviceLocation: 'homebased_studio' | 'home_service',
  timeRange: string
): ServiceType {
  const lower = serviceText.toLowerCase();
  const hasMani = lower.includes('manicure') || lower.includes('mani');
  const hasPedi = lower.includes('pedicure') || lower.includes('pedi');
  if (serviceLocation === 'home_service') {
    const durationMinutes = parseDurationMinutes(timeRange);
    if (durationMinutes && durationMinutes >= 180) {
      return 'home_service_3slots';
    }
    return 'home_service_2slots';
  }
  if (hasMani && hasPedi) {
    return 'mani_pedi';
  }
  return 'manicure';
}

async function getBookingIdsUsingSlot(slotId: string) {
  const bookingsCollection = adminDb.collection('bookings');
  const [directSnap, linkedSnap, pairedSnap] = await Promise.all([
    bookingsCollection.where('slotId', '==', slotId).get(),
    bookingsCollection.where('linkedSlotIds', 'array-contains', slotId).get(),
    bookingsCollection.where('pairedSlotId', '==', slotId).get(),
  ]);
  const bookingIds = new Set<string>();
  directSnap.docs.forEach((doc) => bookingIds.add(doc.data().bookingId));
  linkedSnap.docs.forEach((doc) => bookingIds.add(doc.data().bookingId));
  pairedSnap.docs.forEach((doc) => bookingIds.add(doc.data().bookingId));
  return Array.from(bookingIds);
}

async function getBookingByBookingId(bookingId: string) {
  const snapshot = await adminDb.collection('bookings').where('bookingId', '==', bookingId).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() };
}

async function confirmBookingManual(bookingDocId: string, slotIds: string[], depositAmount?: number) {
  const now = new Date().toISOString();
  const batch = adminDb.batch();
  const bookingRef = adminDb.collection('bookings').doc(bookingDocId);
  const updateData: any = {
    status: 'confirmed',
    updatedAt: now,
    paymentStatus: depositAmount && depositAmount > 0 ? 'partial' : 'unpaid',
  };
  if (depositAmount && depositAmount > 0) {
    updateData.depositAmount = depositAmount;
    updateData.depositDate = now;
  }
  batch.set(bookingRef, updateData, { merge: true });
  slotIds.forEach((slotId) => {
    const slotRef = adminDb.collection('slots').doc(slotId);
    batch.set(slotRef, { status: 'confirmed', updatedAt: now }, { merge: true });
  });
  await batch.commit();
}

async function createSlotManual(date: string, time: string, nailTechId: string, blocks: any[]) {
  const now = new Date().toISOString();
  const slotData = {
    date,
    time,
    status: 'available' as const,
    nailTechId,
    createdAt: now,
    updatedAt: now,
  };
  preventSlotInBlockedRange(slotData as any, blocks);
  const slotRef = adminDb.collection('slots').doc();
  await slotRef.set(slotData);
  return { id: slotRef.id, status: slotData.status };
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const range = process.env.GOOGLE_SHEETS_RANGE ?? "'Form Responses 1'!A:Z";
  const rows = await fetchSheetRows(range);
  if (!rows.length) {
    console.log(JSON.stringify({ success: false, message: 'No rows found in sheet.' }, null, 2));
    return;
  }

  const [header, ...dataRows] = rows;
  const originalHeader = header.map((h) => (h || '').trim());
  const bookingIdColumn = process.env.GOOGLE_SHEETS_BOOKING_ID_COLUMN ?? 'Booking ID (Autofill)';
  const bookingIdColumnIndex = originalHeader.findIndex(
    (h) => h.toLowerCase() === bookingIdColumn.toLowerCase()
  );
  if (bookingIdColumnIndex === -1) {
    throw new Error(`Booking ID column "${bookingIdColumn}" not found in sheet.`);
  }

  const dateColumnIndex = originalHeader.findIndex((h) =>
    h.toLowerCase().includes('appointment date')
  );
  const timeColumnIndex = originalHeader.findIndex((h) =>
    h.toLowerCase().includes('appointment time')
  );
  const serviceLocationIndex = originalHeader.findIndex((h) =>
    h.toLowerCase().includes('home service')
  );
  const serviceIndex = originalHeader.findIndex((h) =>
    h.toLowerCase().includes('what nail services')
  );

  const rowByBookingId = new Map<string, { row: string[]; rowNumber: number }>();
  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    if (!row || row.length === 0) continue;
    const bookingId = (row[bookingIdColumnIndex] || '').trim().toUpperCase();
    if (!bookingId) continue;
    rowByBookingId.set(bookingId, { row, rowNumber: index + 2 });
  }

  const allSheetIds = Array.from(rowByBookingId.keys());
  const resolveId = (raw: string) => {
    const normalized = normalizeBookingId(raw);
    if (rowByBookingId.has(normalized)) return normalized;
    const digits = normalized.replace('GN-', '');
    const fallback = allSheetIds.filter((id) => id.endsWith(digits));
    if (fallback.length === 1) return fallback[0];
    return normalized;
  };

  const requestedIds = requestedBookingIdsRaw.map(resolveId);
  const depositIds = new Set(depositBookingIdsRaw.map(resolveId));

  const defaultNailTech = (await getDefaultNailTech()) ?? (await createDefaultNailTech());
  const nailTechId = preferredNailTechId || defaultNailTech?.id;
  if (!nailTechId) {
    throw new Error('Failed to resolve nail tech.');
  }

  const blocks = await listBlockedDates();
  const slots = await listSlots(nailTechId);
  const slotMap = new Map<string, { id: string; status: string }>();
  slots.forEach((slot) => {
    slotMap.set(`${slot.date}|${slot.time}|${slot.nailTechId}`, { id: slot.id, status: slot.status });
  });

  const results: Array<Record<string, any>> = [];

  for (const bookingId of requestedIds) {
    const sheetRow = rowByBookingId.get(bookingId);
    if (!sheetRow) {
      results.push({ bookingId, status: 'skipped', reason: 'Booking ID not found in sheet.' });
      continue;
    }

    const existingBooking = await getBookingByBookingId(bookingId);

    const { row, rowNumber } = sheetRow;
    const formData: Record<string, string> = {};
    const fieldOrder: string[] = [];
    originalHeader.forEach((key, columnIndex) => {
      if (!key) return;
      const value = (row[columnIndex] || '').trim();
      formData[key] = value;
      fieldOrder.push(key);
    });

    const dateRaw = dateColumnIndex >= 0 ? String(row[dateColumnIndex] || '') : '';
    const timeRaw = timeColumnIndex >= 0 ? String(row[timeColumnIndex] || '') : '';
    const serviceLocationRaw = serviceLocationIndex >= 0 ? String(row[serviceLocationIndex] || '') : '';
    const serviceText = serviceIndex >= 0 ? String(row[serviceIndex] || '') : '';

    const date = parseDateToISO(dateRaw);
    const baseTime = parseTimeToSlotTime(timeRaw);
    if (!date || !baseTime) {
      results.push({ bookingId, status: 'failed', reason: 'Could not parse date/time from sheet.', rowNumber });
      continue;
    }

    const serviceLocation = inferServiceLocation(serviceLocationRaw);
    const serviceType = inferServiceType(serviceText, serviceLocation, timeRaw);
    const requiredSlots = getRequiredSlotCount(serviceType);

    const slotTimes: string[] = [baseTime];
    while (slotTimes.length < requiredSlots) {
      const nextTime = getNextSlotTime(slotTimes[slotTimes.length - 1]);
      if (!nextTime) break;
      slotTimes.push(nextTime);
    }

    if (slotTimes.length === 0) {
      results.push({
        bookingId,
        status: 'failed',
        reason: 'No slot times could be resolved from the sheet time.',
        rowNumber,
      });
      continue;
    }

    if (slotTimes.length < requiredSlots) {
      results.push({
        bookingId,
        status: 'failed',
        reason: `Not enough consecutive slot times starting at ${baseTime}.`,
        rowNumber,
      });
      continue;
    }

    const slotIds: string[] = [];
    let hasConflict = false;
    for (const slotTime of slotTimes) {
      const key = `${date}|${slotTime}|${nailTechId}`;
      const existing = slotMap.get(key);
      if (existing) {
        if (!existing.id) {
          results.push({
            bookingId,
            status: 'failed',
            reason: `Slot ${date} ${slotTime} is missing an ID.`,
            rowNumber,
          });
          hasConflict = true;
          break;
        }
        if (existing.status !== 'available' && existing.status !== 'pending') {
          if (existing.status === 'confirmed') {
            const bookingIdsUsingSlot = await getBookingIdsUsingSlot(existing.id);
            const inUseByOthers =
              bookingIdsUsingSlot.length > 0 && !bookingIdsUsingSlot.includes(bookingId);
            if (!inUseByOthers && !existingBooking) {
              await adminDb.collection('slots').doc(existing.id).set(
                { status: 'available', updatedAt: new Date().toISOString() },
                { merge: true }
              );
              existing.status = 'available';
            }
            if (inUseByOthers) {
              results.push({
                bookingId,
                status: 'failed',
                reason: `Slot ${date} ${slotTime} is confirmed and already used by: ${bookingIdsUsingSlot.join(', ')}`,
                rowNumber,
              });
              hasConflict = true;
              break;
            }
            if (existingBooking) {
              slotIds.push(existing.id);
              continue;
            }
          }
        }
        if (existing.status !== 'available' && existing.status !== 'pending') {
          results.push({
            bookingId,
            status: 'failed',
            reason: `Slot ${date} ${slotTime} is ${existing.status} and cannot be used.`,
            rowNumber,
          });
          hasConflict = true;
          break;
        }
        slotIds.push(existing.id);
        continue;
      }

      const created = await createSlotManual(date, slotTime, nailTechId, blocks);
      if (!created.id) {
        results.push({
          bookingId,
          status: 'failed',
          reason: `Created slot ${date} ${slotTime} returned an empty ID.`,
          rowNumber,
        });
        hasConflict = true;
        break;
      }
      slotMap.set(key, { id: created.id, status: created.status });
      slotIds.push(created.id);
    }

    if (hasConflict) continue;

    let step = 'resolve-slots';
    try {
      if (slotIds.length === 0 || slotIds.some((id) => !id)) {
        results.push({
          bookingId,
          status: 'failed',
          reason: 'No valid slot IDs were resolved for this booking.',
          rowNumber,
          slotTimes,
          date,
          baseTime,
          slotIds,
        });
        continue;
      }

      const depositAmount = depositIds.has(bookingId) ? 500 : undefined;

      if (existingBooking) {
        step = 'update-existing-booking';
        await adminDb.collection('bookings').doc(existingBooking.id).set(
          {
            slotId: slotIds[0],
            pairedSlotId: slotIds.length > 1 ? slotIds[1] : null,
            linkedSlotIds: slotIds.length > 1 ? slotIds.slice(1) : [],
            serviceType,
            serviceLocation,
            customerData: formData,
            customerDataOrder: fieldOrder,
            formResponseId: String(rowNumber),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        step = 'confirm-existing-booking';
        await confirmBookingManual(existingBooking.id, slotIds, depositAmount);

        results.push({
          bookingId,
          status: 'updated',
          serviceType,
          serviceLocation,
          slotTimes,
          depositAmount: depositAmount ?? 0,
        });
      } else {
        step = 'recover-new-booking';
        const recovered = await recoverBookingFromForm(
          bookingId,
          slotIds[0],
          {
            serviceType,
            linkedSlotIds: slotIds.length > 1 ? slotIds.slice(1) : [],
            serviceLocation,
          },
          formData,
          fieldOrder,
          String(rowNumber)
        );

        step = 'confirm-new-booking';
        await confirmBookingManual(recovered.id, slotIds, depositAmount);

        results.push({
          bookingId,
          status: 'restored',
          serviceType,
          serviceLocation,
          slotTimes,
          depositAmount: depositAmount ?? 0,
        });
      }
    } catch (error: any) {
      results.push({
        bookingId,
        status: 'failed',
        reason: error.message || 'Failed to recover booking.',
        step,
        rowNumber,
        slotIds,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        requestedBookingIds: requestedIds,
        results,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Restore failed:', error);
  process.exit(1);
});
