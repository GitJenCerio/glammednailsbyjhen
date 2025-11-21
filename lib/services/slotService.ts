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
  return { id: ref.id, ...(data as Slot) };
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

