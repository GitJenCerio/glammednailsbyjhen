import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { BlockedDate, Slot, SlotInput, SlotStatus } from '../types';
import { preventSlotInBlockedRange } from '../scheduling';

const slotCollection = adminDb.collection('slots');
const allowedStatuses: SlotStatus[] = ['available', 'blocked', 'pending', 'confirmed'];

export async function listSlots(): Promise<Slot[]> {
  const snapshot = await slotCollection.orderBy('date', 'asc').orderBy('time', 'asc').get();
  return snapshot.docs.map((doc) => docToSlot(doc.id, doc.data()));
}

export async function listSlotsByStatus(status: Slot['status']): Promise<Slot[]> {
  const snapshot = await slotCollection.where('status', '==', status).get();
  return snapshot.docs.map((doc) => docToSlot(doc.id, doc.data()));
}

export async function createSlot(payload: SlotInput, blocks: BlockedDate[]): Promise<Slot> {
  if (!allowedStatuses.includes(payload.status)) {
    throw new Error('Invalid slot status.');
  }
  preventSlotInBlockedRange(payload as Slot, blocks);

  const duplicateSnapshot = await slotCollection
    .where('date', '==', payload.date)
    .where('time', '==', payload.time)
    .get();

  if (!duplicateSnapshot.empty) {
    throw new Error('A slot already exists for that date and time.');
  }

  const now = Timestamp.now().toDate().toISOString();
  const data = {
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await slotCollection.add(data);
  return { ...(data as Slot), id: ref.id };
}

export async function updateSlot(id: string, data: Partial<Slot>, blocks: BlockedDate[]): Promise<Slot> {
  const ref = slotCollection.doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('Slot not found.');

  const updated: Slot = { ...(docToSlot(snapshot.id, snapshot.data()!)), ...data };
  if (data.status && !allowedStatuses.includes(data.status)) {
    throw new Error('Invalid slot status.');
  }
  preventSlotInBlockedRange(updated, blocks);

  const { id: _ignored, ...rest } = updated as Slot;
  await ref.set({ ...rest, updatedAt: Timestamp.now().toDate().toISOString() }, { merge: true });
  return { ...(updated as Slot), id };
}

export async function deleteSlot(id: string) {
  await slotCollection.doc(id).delete();
}

export async function deleteExpiredSlots() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    // Fetch all expired slots first (simpler query that doesn't need composite index)
    const expiredSnapshot = await slotCollection.where('date', '<', today).get();
    
    // Filter to only delete available slots (not booked/pending/confirmed)
    const availableExpiredSlots = expiredSnapshot.docs.filter(
      (doc) => doc.data().status === 'available'
    );
    
    const deletePromises = availableExpiredSlots.map((doc) => doc.ref.delete());
    await Promise.all(deletePromises);
    
    return availableExpiredSlots.length;
  } catch (error) {
    // If index doesn't exist yet, just log and continue
    // The index will be created automatically when the user clicks the link in the error
    console.warn('Could not delete expired slots (index may be missing):', error);
    return 0;
  }
}

export async function getSlotsByDate(date: string): Promise<Slot[]> {
  const snapshot = await slotCollection.where('date', '==', date).get();
  return snapshot.docs.map((doc) => docToSlot(doc.id, doc.data()));
}

export async function deleteSlotsByDate(date: string, options?: { onlyAvailable?: boolean }): Promise<{ deletedCount: number; slotsDeleted: Slot[] }> {
  const snapshot = await slotCollection.where('date', '==', date).get();
  
  let slotsToDelete = snapshot.docs.map((doc) => ({
    id: doc.id,
    slot: docToSlot(doc.id, doc.data()),
  }));
  
  // Filter by status if onlyAvailable is true
  if (options?.onlyAvailable) {
    slotsToDelete = slotsToDelete.filter((item) => item.slot.status === 'available');
  }
  
  const slotsDeleted = slotsToDelete.map((item) => item.slot);
  const deletePromises = slotsToDelete.map((item) => slotCollection.doc(item.id).delete());
  await Promise.all(deletePromises);
  
  return {
    deletedCount: slotsToDelete.length,
    slotsDeleted,
  };
}

function docToSlot(id: string, data: FirebaseFirestore.DocumentData): Slot {
  return {
    id,
    date: data.date,
    time: data.time,
    status: data.status,
    slotType: data.slotType ?? null,
    notes: data.notes ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

