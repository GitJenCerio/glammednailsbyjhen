import { Timestamp } from 'firebase-admin/firestore';
import { format, parseISO } from 'date-fns';
import { adminDb } from '../firebaseAdmin';
import { Booking, BookingStatus, ServiceType, Slot } from '../types';
import { listBlockedDates } from './blockService';
import { slotIsBlocked } from '../scheduling';
import { buildPrefilledGoogleFormUrl } from '../googleForms';
import { getNextSlotTime } from '../constants/slots';

const bookingsCollection = adminDb.collection('bookings');
const slotsCollection = adminDb.collection('slots');

export async function listBookings(): Promise<Booking[]> {
  const snapshot = await bookingsCollection.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => docToBooking(doc.id, doc.data()));
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const snapshot = await bookingsCollection.doc(id).get();
  if (!snapshot.exists) return null;
  return docToBooking(snapshot.id, snapshot.data()!);
}

type CreateBookingOptions = {
  serviceType?: ServiceType;
  pairedSlotId?: string | null;
  linkedSlotIds?: string[] | null;
  clientType?: 'new' | 'repeat';
  serviceLocation?: 'homebased_studio' | 'home_service';
};

function getRequiredSlotCount(serviceType: ServiceType): number {
  switch (serviceType) {
    case 'mani_pedi':
    case 'home_service_2slots':
      return 2;
    case 'home_service_3slots':
      return 3;
    default:
      return 1;
  }
}

/**
 * Get the next sequential booking number
 * Returns the next number in sequence (e.g., 1, 2, 3...) based on existing bookings
 * Only considers sequential IDs (GN-00001, GN-00002, etc.) and ignores old timestamp-based IDs
 */
async function getNextBookingNumber(): Promise<number> {
  const snapshot = await bookingsCollection.get();
  let maxNumber = 0;

  snapshot.docs.forEach((doc) => {
    const bookingId = doc.data().bookingId;
    if (bookingId && bookingId.startsWith('GN-')) {
      // Extract number from booking ID
      const numberPart = bookingId.substring(3); // Remove "GN-"
      
      // Only consider sequential IDs (1-6 digits max)
      // This excludes old timestamp-based IDs (13+ digits) like GN-1234567890123
      // Sequential IDs will be like GN-00001, GN-00002, etc. (5 digits padded)
      if (/^\d{1,6}$/.test(numberPart)) {
        const number = parseInt(numberPart, 10);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    }
  });

  return maxNumber + 1;
}

export async function createBooking(slotId: string, options?: CreateBookingOptions) {
  // Generate sequential booking ID: GN-00001, GN-00002, etc.
  const nextNumber = await getNextBookingNumber();
  const bookingId = `GN-${nextNumber.toString().padStart(5, '0')}`;
  const formEntryKey = process.env.GOOGLE_FORM_BOOKING_ID_ENTRY;
  const formDateEntryKey = process.env.GOOGLE_FORM_DATE_ENTRY;
  const formTimeEntryKey = process.env.GOOGLE_FORM_TIME_ENTRY;
  const formServiceLocationEntryKey = process.env.GOOGLE_FORM_SERVICE_LOCATION_ENTRY;
  const formUrl = process.env.GOOGLE_FORM_BASE_URL;

  if (!formEntryKey || !formUrl) {
    throw new Error('Missing Google Form configuration.');
  }

  const serviceType = options?.serviceType ?? 'manicure';
  const requiredSlotCount = getRequiredSlotCount(serviceType);
  const providedLinkedSlotIds = options?.linkedSlotIds ?? (options?.pairedSlotId ? [options.pairedSlotId] : []);
  const serviceLocation = options?.serviceLocation ?? 'homebased_studio';
  const blocks = await listBlockedDates();
  let slotDate: string | null = null;
  let slotTime: string | null = null;
  let finalLinkedSlotTime: string | null = null;

  await adminDb.runTransaction(async (transaction) => {
    const slotRef = slotsCollection.doc(slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists) throw new Error('Slot not found.');
    const slot = docToSlot(slotSnap.id, slotSnap.data()!);
    slotDate = slot.date; // Store date for use after transaction
    slotTime = slot.time; // Store time for use after transaction

    if (slot.status !== 'available') {
      throw new Error('Slot is no longer available.');
    }

    if (slotIsBlocked(slot, blocks)) {
      throw new Error('Slot is blocked.');
    }

    if (requiredSlotCount === 1 && providedLinkedSlotIds.length > 0) {
      throw new Error('Additional slots provided for a single-slot service.');
    }

    if (requiredSlotCount > 1 && providedLinkedSlotIds.length !== requiredSlotCount - 1) {
      throw new Error(`This service requires ${requiredSlotCount} consecutive slots.`);
    }

    const linkedSlotIds: string[] = [];
    const linkedSlotTimes: string[] = [];
    let previousSlot = slot;

    for (let index = 0; index < providedLinkedSlotIds.length; index += 1) {
      const linkedSlotId = providedLinkedSlotIds[index];
      const linkedRef = slotsCollection.doc(linkedSlotId);
      const linkedSnap = await transaction.get(linkedRef);
      if (!linkedSnap.exists) throw new Error('The consecutive slot was not found.');
      const linkedSlot = docToSlot(linkedSnap.id, linkedSnap.data()!);

      if (linkedSlot.status !== 'available') {
        throw new Error('The consecutive slot is no longer available.');
      }
      if (linkedSlot.date !== slot.date) {
        throw new Error('Consecutive slots must be on the same day.');
      }
      const expectedNextTime = getNextSlotTime(previousSlot.time);
      if (!expectedNextTime || linkedSlot.time !== expectedNextTime) {
        throw new Error('Selected slots are not consecutive.');
      }
      if (slotIsBlocked(linkedSlot, blocks)) {
        throw new Error('One of the consecutive slots is blocked.');
      }

      transaction.update(linkedRef, {
        status: 'pending',
        updatedAt: Timestamp.now().toDate().toISOString(),
      });

      linkedSlotIds.push(linkedSlot.id);
      linkedSlotTimes.push(linkedSlot.time);
      previousSlot = linkedSlot;
    }

    if (linkedSlotTimes.length > 0) {
      finalLinkedSlotTime = linkedSlotTimes[linkedSlotTimes.length - 1];
    }

    transaction.update(slotRef, {
      status: 'pending',
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    const bookingRef = bookingsCollection.doc();
    const clientType = options?.clientType;
    transaction.set(bookingRef, {
      slotId,
      pairedSlotId: linkedSlotIds[0] ?? null,
      linkedSlotIds: linkedSlotIds.length ? linkedSlotIds : undefined,
      bookingId,
      serviceType,
      clientType,
      serviceLocation,
      status: 'pending_form' as BookingStatus,
      createdAt: Timestamp.now().toDate().toISOString(),
      updatedAt: Timestamp.now().toDate().toISOString(),
    });
  });

  // Format date for Google Forms
  // Support multiple formats based on environment variable
  let formattedDate: string | undefined = undefined;
  if (slotDate && formDateEntryKey) {
    const dateFormat = process.env.GOOGLE_FORM_DATE_FORMAT || 'FULL'; // Default to full format: "Friday, November 28, 2025"
    const dateObj = parseISO(slotDate);
    
    switch (dateFormat.toUpperCase()) {
      case 'FULL':
      case 'LONG':
        // Full format: "Friday, November 28, 2025"
        formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy');
        break;
      case 'YYYY-MM-DD':
        // For Google Forms "Date" picker field type (ISO format)
        formattedDate = format(dateObj, 'yyyy-MM-dd');
        break;
      case 'DD/MM/YYYY':
        // For Google Forms "Date" picker with dd/mm/yyyy format
        formattedDate = format(dateObj, 'dd/MM/yyyy');
        break;
      case 'MM/DD/YYYY':
        // For "Short answer" field type (US format)
        formattedDate = format(dateObj, 'MM/dd/yyyy');
        break;
      default:
        // Default to FULL format
        formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy');
        break;
    }
  }

  // Format time for Google Forms (convert 24-hour to 12-hour format)
  // Note: Google Forms time picker fields may not support pre-filling
  // If your form uses a time picker, you may need to use a "Short answer" field instead
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    // Ensure minutes are always 2 digits
    const mins = minutes.padStart(2, '0');
    return `${hour12}:${mins} ${ampm}`;
  };

  let formattedTime: string | undefined = undefined;
  if (slotTime && formTimeEntryKey) {
    if (finalLinkedSlotTime) {
      // For multi-slot bookings, show time range: "10:30 AM - 3:00 PM"
      formattedTime = `${formatTime12Hour(slotTime)} - ${formatTime12Hour(finalLinkedSlotTime)}`;
    } else {
      // For single slot, show single time: "10:30 AM"
      formattedTime = formatTime12Hour(slotTime);
    }
  }

  const prefillFields: Record<string, string> = {
    [formEntryKey]: bookingId,
  };

  if (formDateEntryKey && formattedDate) {
    prefillFields[formDateEntryKey] = formattedDate;
  } else if (slotDate && !formDateEntryKey) {
    console.warn('GOOGLE_FORM_DATE_ENTRY not set - date will not be pre-filled in form');
  }

  if (formTimeEntryKey && formattedTime) {
    prefillFields[formTimeEntryKey] = formattedTime;
  } else if (slotTime && !formTimeEntryKey) {
    console.warn('GOOGLE_FORM_TIME_ENTRY not set - time will not be pre-filled in form');
  }

  // Format service location for Google Forms
  if (formServiceLocationEntryKey && serviceLocation) {
    const formattedServiceLocation = serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio';
    prefillFields[formServiceLocationEntryKey] = formattedServiceLocation;
  } else if (serviceLocation && !formServiceLocationEntryKey) {
    console.warn('GOOGLE_FORM_SERVICE_LOCATION_ENTRY not set - service location will not be pre-filled in form');
  }

  // Note: Client type is stored in the booking record, not pre-filled in Google Form
  const googleFormUrl = buildPrefilledGoogleFormUrl(formUrl, prefillFields);
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('Prefill fields:', Object.keys(prefillFields));
    console.log('Date entry key:', formDateEntryKey ? `Set (${formDateEntryKey})` : 'Not set');
    console.log('Time entry key:', formTimeEntryKey ? `Set (${formTimeEntryKey})` : 'Not set');
    if (formattedDate) {
      console.log('Formatted date:', formattedDate);
    }
    if (formattedTime) {
      console.log('Formatted time:', formattedTime);
    }
    console.log('Full prefill URL:', googleFormUrl);
  }

  return { bookingId, googleFormUrl };
}

export async function syncBookingWithForm(
  bookingId: string,
  formData: Record<string, string>,
  formResponseId?: string,
) {
  const bookingSnapshot = await bookingsCollection.where('bookingId', '==', bookingId).limit(1).get();
  if (bookingSnapshot.empty) return null;

  const doc = bookingSnapshot.docs[0];
  if (formResponseId && doc.data().formResponseId === formResponseId) {
    return null;
  }

  // Validate date and time if they were submitted
  const formDateEntryKey = process.env.GOOGLE_FORM_DATE_ENTRY;
  const formTimeEntryKey = process.env.GOOGLE_FORM_TIME_ENTRY;
  let dateChanged = false;
  let timeChanged = false;
  const validationWarnings: string[] = [];

  if (formDateEntryKey || formTimeEntryKey) {
    // Get the slot information for this booking
    const booking = docToBooking(doc.id, doc.data());
    const slotRef = slotsCollection.doc(booking.slotId);
    const slotSnap = await slotRef.get();
    
    if (slotSnap.exists) {
      const slot = docToSlot(slotSnap.id, slotSnap.data()!);
      
      // Check if date was changed
      if (formDateEntryKey && formData[formDateEntryKey]) {
        const submittedDate = formData[formDateEntryKey];
        // Convert submitted date to YYYY-MM-DD format for comparison
        // Handle MM/DD/YYYY format
        const dateMatch = submittedDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
          const [, month, day, year] = dateMatch;
          const formattedSubmittedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          if (formattedSubmittedDate !== slot.date) {
            dateChanged = true;
            validationWarnings.push(`Date changed from ${slot.date} to ${submittedDate}`);
          }
        }
      }

      // Check if time was changed
      if (formTimeEntryKey && formData[formTimeEntryKey]) {
        const submittedTime = formData[formTimeEntryKey];
        // Get expected time format
        const formatTime12Hour = (time24: string): string => {
          const [hours, minutes] = time24.split(':');
          const hour = parseInt(hours, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const hour12 = hour % 12 || 12;
          return `${hour12}:${minutes} ${ampm}`;
        };

        let expectedTime: string;
        const linkedSlotIds = booking.linkedSlotIds?.length
          ? booking.linkedSlotIds
          : booking.pairedSlotId
            ? [booking.pairedSlotId]
            : [];
        if (linkedSlotIds.length > 0) {
          const lastLinkedId = linkedSlotIds[linkedSlotIds.length - 1];
          const linkedSlotRef = slotsCollection.doc(lastLinkedId);
          const linkedSlotSnap = await linkedSlotRef.get();
          if (linkedSlotSnap.exists) {
            const linkedSlot = docToSlot(linkedSlotSnap.id, linkedSlotSnap.data()!);
            expectedTime = `${formatTime12Hour(slot.time)} - ${formatTime12Hour(linkedSlot.time)}`;
          } else {
            expectedTime = formatTime12Hour(slot.time);
          }
        } else {
          expectedTime = formatTime12Hour(slot.time);
        }

        // Normalize times for comparison (remove extra spaces, case insensitive)
        const normalizedSubmitted = submittedTime.trim().replace(/\s+/g, ' ');
        const normalizedExpected = expectedTime.trim().replace(/\s+/g, ' ');
        
        if (normalizedSubmitted.toLowerCase() !== normalizedExpected.toLowerCase()) {
          timeChanged = true;
          validationWarnings.push(`Time changed from "${expectedTime}" to "${submittedTime}"`);
        }
      }
    }
  }

  await doc.ref.set(
    {
      customerData: formData,
      status: 'pending_payment',
      formResponseId,
      dateChanged: dateChanged || undefined,
      timeChanged: timeChanged || undefined,
      validationWarnings: validationWarnings.length > 0 ? validationWarnings : undefined,
      updatedAt: Timestamp.now().toDate().toISOString(),
    },
    { merge: true },
  );

  // Log warning if date/time was changed
  if (validationWarnings.length > 0) {
    console.warn(`Booking ${bookingId} - Date/Time changed:`, validationWarnings);
  }

  return docToBooking(doc.id, { 
    ...doc.data(), 
    customerData: formData, 
    status: 'pending_payment',
    dateChanged,
    timeChanged,
    validationWarnings: validationWarnings.length > 0 ? validationWarnings : undefined,
  });
}

export async function confirmBooking(bookingId: string) {
  await adminDb.runTransaction(async (transaction) => {
    const bookingRef = bookingsCollection.doc(bookingId);
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new Error('Booking not found.');
    const booking = docToBooking(bookingSnap.id, bookingSnap.data()!);

    const slotRef = slotsCollection.doc(booking.slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists) throw new Error('Slot not found.');
    const slot = docToSlot(slotSnap.id, slotSnap.data()!);

    if (slot.status === 'blocked') {
      throw new Error('Cannot confirm booking on a blocked slot.');
    }

    const blocks = await listBlockedDates();
    if (slotIsBlocked(slot, blocks)) {
      throw new Error('Cannot confirm booking on a blocked date.');
    }

    transaction.update(bookingRef, {
      status: 'confirmed',
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    transaction.update(slotRef, {
      status: 'confirmed',
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    const linkedSlotIds = booking.linkedSlotIds?.length
      ? booking.linkedSlotIds
      : booking.pairedSlotId
        ? [booking.pairedSlotId]
        : [];
    for (const linkedId of linkedSlotIds) {
      const linkedRef = slotsCollection.doc(linkedId);
      const linkedSnap = await transaction.get(linkedRef);
      if (linkedSnap.exists) {
        transaction.update(linkedRef, {
          status: 'confirmed',
          updatedAt: Timestamp.now().toDate().toISOString(),
        });
      }
    }
  });
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  await bookingsCollection.doc(bookingId).set(
    {
      status,
      updatedAt: Timestamp.now().toDate().toISOString(),
    },
    { merge: true },
  );
}

export async function releaseExpiredPendingBookings(maxAgeMinutes = 20) {
  const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
  const snapshot = await bookingsCollection.where('status', '==', 'pending_form').get();

  await Promise.all(
    snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      if (!data.createdAt) return;
      const createdAt = new Date(data.createdAt).getTime();
      if (Number.isNaN(createdAt) || createdAt >= cutoff) return;

      await adminDb.runTransaction(async (transaction) => {
        const bookingRef = bookingsCollection.doc(docSnap.id);
        const slotRef = slotsCollection.doc(data.slotId);
        const slotSnap = await transaction.get(slotRef);

        const linkedSlotIds: string[] = Array.isArray(data.linkedSlotIds)
          ? data.linkedSlotIds
          : data.pairedSlotId
            ? [data.pairedSlotId]
            : [];
        const linkedRefs: FirebaseFirestore.DocumentReference[] = [];
        const linkedSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
        for (const linkedId of linkedSlotIds) {
          const ref = slotsCollection.doc(linkedId);
          linkedRefs.push(ref);
          linkedSnaps.push(await transaction.get(ref));
        }

        transaction.delete(bookingRef);

        if (slotSnap.exists && slotSnap.data()?.status === 'pending') {
          transaction.update(slotRef, {
            status: 'available',
            updatedAt: Timestamp.now().toDate().toISOString(),
          });
        }
        linkedRefs.forEach((ref, index) => {
          const snap = linkedSnaps[index];
          if (snap?.exists && snap.data()?.status === 'pending') {
            transaction.update(ref, {
              status: 'available',
              updatedAt: Timestamp.now().toDate().toISOString(),
            });
          }
        });
      });
    }),
  );
}

function docToBooking(id: string, data: FirebaseFirestore.DocumentData): Booking {
  return {
    id,
    slotId: data.slotId,
    pairedSlotId: data.pairedSlotId ?? null,
    linkedSlotIds: data.linkedSlotIds ?? undefined,
    bookingId: data.bookingId,
    status: data.status,
    serviceType: data.serviceType,
    clientType: data.clientType,
    serviceLocation: data.serviceLocation,
    customerData: data.customerData ?? undefined,
    formResponseId: data.formResponseId,
    dateChanged: data.dateChanged,
    timeChanged: data.timeChanged,
    validationWarnings: data.validationWarnings,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function docToSlot(id: string, data: FirebaseFirestore.DocumentData): Slot {
  return {
    id,
    date: data.date,
    time: data.time,
    status: data.status,
    notes: data.notes ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

