import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import type { Slot, Booking } from './types';

// Slot Operations
export async function getAllSlots(): Promise<Slot[]> {
  const q = query(collection(db, 'slots'), orderBy('date', 'asc'), orderBy('time', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slot));
}

export async function addSlot(slot: Omit<Slot, 'id'>): Promise<void> {
  await addDoc(collection(db, 'slots'), slot);
}

export async function updateSlot(slotId: string, data: Partial<Slot>): Promise<void> {
  await updateDoc(doc(db, 'slots', slotId), data as any);
}

export async function deleteSlot(slotId: string): Promise<void> {
  await deleteDoc(doc(db, 'slots', slotId));
}

// Booking Operations
export async function getAllBookings(): Promise<Booking[]> {
  const snapshot = await getDocs(collection(db, 'bookings'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
}

export async function createBooking(booking: Omit<Booking, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'bookings'), {
    ...booking,
    createdAt: new Date(),
  });
  return docRef.id;
}

export async function updateBooking(bookingId: string, data: Partial<Booking>): Promise<void> {
  await updateDoc(doc(db, 'bookings', bookingId), data as any);
}

export async function deleteBooking(bookingId: string): Promise<void> {
  await deleteDoc(doc(db, 'bookings', bookingId));
}

// Get bookings for a specific slot
export async function getBookingsForSlot(date: string, time: string): Promise<Booking[]> {
  const q = query(
    collection(db, 'bookings'),
    where('date', '==', date),
    where('time', '==', time)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
}
