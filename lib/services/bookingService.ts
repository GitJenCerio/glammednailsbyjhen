import { Timestamp } from 'firebase-admin/firestore';
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
};

export async function createBooking(slotId: string, options?: CreateBookingOptions) {
  const bookingId = `GN-${Date.now()}`;
  const formEntryKey = process.env.GOOGLE_FORM_BOOKING_ID_ENTRY;
  const formUrl = process.env.GOOGLE_FORM_BASE_URL;

  if (!formEntryKey || !formUrl) {
    throw new Error('Missing Google Form configuration.');
  }

  const serviceType = options?.serviceType ?? 'manicure';
  const requiresPair = serviceType === 'mani_pedi';
  const providedPairedSlotId = options?.pairedSlotId ?? null;
  const blocks = await listBlockedDates();

  await adminDb.runTransaction(async (transaction) => {
    const slotRef = slotsCollection.doc(slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists) throw new Error('Slot not found.');
    const slot = docToSlot(slotSnap.id, slotSnap.data()!);

    if (slot.status !== 'available') {
      throw new Error('Slot is no longer available.');
    }

    if (slotIsBlocked(slot, blocks)) {
      throw new Error('Slot is blocked.');
    }

    let pairedSlotId: string | null = null;
    if (requiresPair) {
      if (!providedPairedSlotId) {
        throw new Error('This service requires two consecutive slots.');
      }

      const pairedRef = slotsCollection.doc(providedPairedSlotId);
      const pairedSnap = await transaction.get(pairedRef);
      if (!pairedSnap.exists) throw new Error('The consecutive slot was not found.');
      const pairedSlot = docToSlot(pairedSnap.id, pairedSnap.data()!);

      if (pairedSlot.status !== 'available') {
        throw new Error('The consecutive slot is no longer available.');
      }
      if (pairedSlot.date !== slot.date) {
        throw new Error('Consecutive slots must be on the same day.');
      }
      const expectedNextTime = getNextSlotTime(slot.time);
      if (!expectedNextTime || pairedSlot.time !== expectedNextTime) {
        throw new Error('Selected slots are not consecutive.');
      }
      if (slotIsBlocked(pairedSlot, blocks)) {
        throw new Error('The consecutive slot is blocked.');
      }

      transaction.update(pairedRef, {
        status: 'pending',
        updatedAt: Timestamp.now().toDate().toISOString(),
      });
      pairedSlotId = pairedSlot.id;
    } else if (providedPairedSlotId) {
      throw new Error('Paired slot provided for a single-slot service.');
    }

    transaction.update(slotRef, {
      status: 'pending',
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    const bookingRef = bookingsCollection.doc();
    transaction.set(bookingRef, {
      slotId,
      pairedSlotId,
      bookingId,
      serviceType,
      status: 'pending_form' as BookingStatus,
      createdAt: Timestamp.now().toDate().toISOString(),
      updatedAt: Timestamp.now().toDate().toISOString(),
    });
  });

  const googleFormUrl = buildPrefilledGoogleFormUrl(formUrl, {
    [formEntryKey]: bookingId,
  });

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

  await doc.ref.set(
    {
      customerData: formData,
      status: 'pending_payment',
      formResponseId,
      updatedAt: Timestamp.now().toDate().toISOString(),
    },
    { merge: true },
  );

  return docToBooking(doc.id, { ...doc.data(), customerData: formData, status: 'pending_payment' });
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

    if (booking.pairedSlotId) {
      const pairedRef = slotsCollection.doc(booking.pairedSlotId);
      const pairedSnap = await transaction.get(pairedRef);
      if (pairedSnap.exists) {
        transaction.update(pairedRef, {
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

        let pairedRef: FirebaseFirestore.DocumentReference | null = null;
        let pairedSnap: FirebaseFirestore.DocumentSnapshot | null = null;
        if (data.pairedSlotId) {
          pairedRef = slotsCollection.doc(data.pairedSlotId);
          pairedSnap = await transaction.get(pairedRef);
        }

        transaction.delete(bookingRef);

        if (slotSnap.exists && slotSnap.data()?.status === 'pending') {
          transaction.update(slotRef, {
            status: 'available',
            updatedAt: Timestamp.now().toDate().toISOString(),
          });
        }
        if (pairedRef && pairedSnap?.exists && pairedSnap.data()?.status === 'pending') {
          transaction.update(pairedRef, {
            status: 'available',
            updatedAt: Timestamp.now().toDate().toISOString(),
          });
        }
      });
    }),
  );
}

function docToBooking(id: string, data: FirebaseFirestore.DocumentData): Booking {
  return {
    id,
    slotId: data.slotId,
    pairedSlotId: data.pairedSlotId ?? null,
    bookingId: data.bookingId,
    status: data.status,
    serviceType: data.serviceType,
    customerData: data.customerData ?? undefined,
    formResponseId: data.formResponseId,
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

