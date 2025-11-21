import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { BlockedDate, BlockedDateInput } from '../types';

const blockCollection = adminDb.collection('blockedDates');

export async function listBlockedDates(): Promise<BlockedDate[]> {
  const snapshot = await blockCollection.orderBy('startDate', 'asc').get();
  return snapshot.docs.map((doc) => docToBlock(doc.id, doc.data()));
}

export async function createBlockedDate(payload: BlockedDateInput): Promise<BlockedDate> {
  const now = Timestamp.now().toDate().toISOString();
  const data = { ...payload, createdAt: now, updatedAt: now };
  const ref = await blockCollection.add(data);
  return { id: ref.id, ...(data as BlockedDate) };
}

export async function updateBlockedDate(id: string, data: Partial<BlockedDate>): Promise<BlockedDate> {
  const ref = blockCollection.doc(id);
  await ref.set({ ...data, updatedAt: Timestamp.now().toDate().toISOString() }, { merge: true });
  const snapshot = await ref.get();
  return docToBlock(snapshot.id, snapshot.data()!);
}

export async function deleteBlockedDate(id: string) {
  await blockCollection.doc(id).delete();
}

function docToBlock(id: string, data: FirebaseFirestore.DocumentData): BlockedDate {
  return {
    id,
    startDate: data.startDate,
    endDate: data.endDate,
    reason: data.reason ?? null,
    scope: data.scope ?? 'range',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

