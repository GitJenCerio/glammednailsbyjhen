import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { BlockedDate, Slot, SlotInput, SlotStatus } from '../types';
import { preventSlotInBlockedRange } from '../scheduling';
import { getDefaultNailTech } from './nailTechService';

// Use a getter to avoid touching Firebase at module load time for some usages
const getSlotCollection = () => adminDb.collection('slots');
// Keep a direct reference for existing logic that expects a const
const slotCollection = adminDb.collection('slots');
const allowedStatuses: SlotStatus[] = ['available', 'blocked', 'pending', 'confirmed'];

export async function getSlotsByIds(slotIds: string[]): Promise<Slot[]> {
  const uniqueIds = Array.from(new Set((slotIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const refs = uniqueIds.map((id) => getSlotCollection().doc(id));
  const snaps = await adminDb.getAll(...refs);

  const slots: Slot[] = [];
  snaps.forEach((snap) => {
    if (!snap.exists) return;
    slots.push(docToSlot(snap.id, snap.data()!));
  });

  return slots;
}

async function normalizeSlotsFromSnapshot(snapshot: FirebaseFirestore.QuerySnapshot) {
  // Handle backward compatibility: assign default nail tech to slots without one
  const defaultNailTech = await getDefaultNailTech();
  const slots: Slot[] = [];
  const slotsToUpdate: Array<{ ref: FirebaseFirestore.DocumentReference; nailTechId: string }> = [];

  // First pass: collect slots and identify which need updates
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.nailTechId && defaultNailTech) {
      // Queue for batch update (don't block on individual writes)
      slotsToUpdate.push({ ref: doc.ref, nailTechId: defaultNailTech.id });
      slots.push(docToSlot(doc.id, { ...data, nailTechId: defaultNailTech.id }));
    } else {
      slots.push(docToSlot(doc.id, data));
    }
  }

  // Batch update slots that need nailTechId (non-blocking, fire and forget)
  if (slotsToUpdate.length > 0) {
    // Use batch write for efficiency (max 500 operations per batch)
    const batch = adminDb.batch();
    const batches: FirebaseFirestore.WriteBatch[] = [batch];
    let currentBatch = batch;
    let operationCount = 0;

    for (const { ref, nailTechId } of slotsToUpdate) {
      if (operationCount >= 500) {
        // Firestore batch limit is 500 operations
        currentBatch = adminDb.batch();
        batches.push(currentBatch);
        operationCount = 0;
      }
      currentBatch.set(ref, { nailTechId }, { merge: true });
      operationCount++;
    }

    // Execute all batches in parallel (don't await - let it run in background)
    Promise.all(batches.map(b => b.commit())).catch(err => {
      console.warn('Background slot update failed (non-critical):', err);
    });
  }

  return slots;
}

/**
 * @deprecated This function fetches ALL slots and can cause quota exhaustion.
 * Use listSlotsByDateRange() instead with explicit startDate and endDate.
 * 
 * This function is kept for backward compatibility but will throw an error
 * to prevent accidental unbounded queries.
 */
export async function listSlots(nailTechId?: string): Promise<Slot[]> {
  throw new Error(
    'listSlots() is deprecated and disabled to prevent quota exhaustion. ' +
    'Use listSlotsByDateRange(startDate, endDate, nailTechId) instead with explicit date ranges.'
  );
}

export async function listSlotsByDateRange(startDate: string, endDate: string, nailTechId?: string): Promise<Slot[]> {
  const snapshot = await getSlotCollection()
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

  const slots = await normalizeSlotsFromSnapshot(snapshot);

  let filteredSlots = slots;
  if (nailTechId) {
    filteredSlots = slots.filter((slot) => slot.nailTechId === nailTechId);
  }

  return filteredSlots.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });
}

/**
 * @deprecated This function is disabled to prevent unbounded queries.
 * Use listSlotsByDateRange() with explicit date ranges instead.
 */
export async function listSlotsByNailTech(nailTechId: string): Promise<Slot[]> {
  throw new Error(
    'listSlotsByNailTech() is deprecated and disabled to prevent quota exhaustion. ' +
    'Use listSlotsByDateRange(startDate, endDate, nailTechId) instead with explicit date ranges.'
  );
}

export async function listSlotsByStatus(status: Slot['status'], nailTechId?: string): Promise<Slot[]> {
  let snapshot;
  if (nailTechId) {
    snapshot = await getSlotCollection()
      .where('status', '==', status)
      .where('nailTechId', '==', nailTechId)
      .get();
  } else {
    snapshot = await getSlotCollection().where('status', '==', status).get();
  }
  
  // Handle backward compatibility
  const defaultNailTech = await getDefaultNailTech();
  const slots: Slot[] = [];
  const slotsToUpdate: Array<{ ref: FirebaseFirestore.DocumentReference; nailTechId: string }> = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.nailTechId && defaultNailTech) {
      slotsToUpdate.push({ ref: doc.ref, nailTechId: defaultNailTech.id });
      slots.push(docToSlot(doc.id, { ...data, nailTechId: defaultNailTech.id }));
    } else {
      slots.push(docToSlot(doc.id, data));
    }
  }
  
  // Batch update in background (non-blocking)
  if (slotsToUpdate.length > 0) {
    const batch = adminDb.batch();
    slotsToUpdate.forEach(({ ref, nailTechId }) => {
      batch.set(ref, { nailTechId }, { merge: true });
    });
    batch.commit().catch(err => {
      console.warn('Background slot update failed (non-critical):', err);
    });
  }
  
  return slots;
}

export async function createSlot(payload: SlotInput, blocks: BlockedDate[]): Promise<Slot> {
  if (!allowedStatuses.includes(payload.status)) {
    throw new Error('Invalid slot status.');
  }
  
  // Ensure nailTechId is set
  if (!payload.nailTechId) {
    const defaultNailTech = await getDefaultNailTech();
    if (!defaultNailTech) {
      throw new Error('No nail tech available. Please create a nail tech first.');
    }
    payload.nailTechId = defaultNailTech.id;
  }
  
  preventSlotInBlockedRange(payload as Slot, blocks);

  // Check for duplicate slot for the same nail tech
  const duplicateSnapshot = await slotCollection
    .where('date', '==', payload.date)
    .where('time', '==', payload.time)
    .where('nailTechId', '==', payload.nailTechId)
    .get();

  if (!duplicateSnapshot.empty) {
    throw new Error('A slot already exists for that date, time, and nail tech.');
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
  // Check if slot exists
  const slotDoc = await slotCollection.doc(id).get();
  if (!slotDoc.exists) {
    throw new Error('Slot not found.');
  }
  const slotData = slotDoc.data();
  if (slotData?.status === 'confirmed') {
    throw new Error('Cannot delete a confirmed slot. Please cancel the booking instead.');
  }

  // Check for active bookings (not cancelled) that use this slot
  const { adminDb } = await import('../firebaseAdmin');
  const bookingsCollection = adminDb.collection('bookings');
  
  // Check if this slot is used in any active booking
  const bookingsWithSlot = await bookingsCollection
    .where('slotId', '==', id)
    .get();
  
  // Also check if this slot is used as a linked slot
  const bookingsWithLinkedSlot = await bookingsCollection
    .where('linkedSlotIds', 'array-contains', id)
    .get();
  
  // Also check if this slot is used as a paired slot
  const bookingsWithPairedSlot = await bookingsCollection
    .where('pairedSlotId', '==', id)
    .get();

  // Combine all bookings that use this slot
  const allBookings = [
    ...bookingsWithSlot.docs,
    ...bookingsWithLinkedSlot.docs,
    ...bookingsWithPairedSlot.docs,
  ];

  // Filter to only active bookings (not cancelled)
  const activeBookings = allBookings.filter((doc) => {
    const data = doc.data();
    return data.status !== 'cancelled';
  });

  if (activeBookings.length > 0) {
    throw new Error('Cannot delete slot: This slot has active bookings. Please cancel the bookings first.');
  }

  // Safe to delete
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

export async function getSlotById(slotId: string): Promise<Slot | null> {
  const doc = await slotCollection.doc(slotId).get();
  if (!doc.exists) return null;
  
  const data = doc.data()!;
  const defaultNailTech = await getDefaultNailTech();
  
  // Handle backward compatibility: assign default nail tech if missing (non-blocking)
  if (!data.nailTechId && defaultNailTech) {
    // Update in background - don't block the response
    doc.ref.set({ nailTechId: defaultNailTech.id }, { merge: true }).catch(err => {
      console.warn('Background slot update failed (non-critical):', err);
    });
    return docToSlot(doc.id, { ...data, nailTechId: defaultNailTech.id });
  }
  
  return docToSlot(doc.id, data);
}

export async function getSlotsByDate(date: string, nailTechId?: string): Promise<Slot[]> {
  let snapshot;
  if (nailTechId) {
    snapshot = await slotCollection
      .where('date', '==', date)
      .where('nailTechId', '==', nailTechId)
      .get();
  } else {
    snapshot = await slotCollection.where('date', '==', date).get();
  }
  
  // Handle backward compatibility
  const defaultNailTech = await getDefaultNailTech();
  const slots: Slot[] = [];
  const slotsToUpdate: Array<{ ref: FirebaseFirestore.DocumentReference; nailTechId: string }> = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.nailTechId && defaultNailTech) {
      slotsToUpdate.push({ ref: doc.ref, nailTechId: defaultNailTech.id });
      slots.push(docToSlot(doc.id, { ...data, nailTechId: defaultNailTech.id }));
    } else {
      slots.push(docToSlot(doc.id, data));
    }
  }
  
  // Batch update in background (non-blocking)
  if (slotsToUpdate.length > 0) {
    const batch = adminDb.batch();
    slotsToUpdate.forEach(({ ref, nailTechId }) => {
      batch.set(ref, { nailTechId }, { merge: true });
    });
    batch.commit().catch(err => {
      console.warn('Background slot update failed (non-critical):', err);
    });
  }
  
  return slots;
}

export async function deleteSlotsByDate(
  date: string,
  options?: { onlyAvailable?: boolean; nailTechId?: string | null }
): Promise<{ deletedCount: number; slotsDeleted: Slot[] }> {
  const nailTechId = options?.nailTechId;
  const snapshot = nailTechId
    ? await slotCollection.where('date', '==', date).where('nailTechId', '==', nailTechId).get()
    : await slotCollection.where('date', '==', date).get();
  
  let slotsToDelete = snapshot.docs.map((doc) => ({
    id: doc.id,
    slot: docToSlot(doc.id, doc.data()),
  }));
  
  const confirmedSlots = slotsToDelete.filter((item) => item.slot.status === 'confirmed');
  if (!options?.onlyAvailable && confirmedSlots.length > 0) {
    throw new Error('Cannot delete confirmed slots. Please cancel the bookings first.');
  }

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
    isHidden: data.isHidden ?? false, // Default to false for backward compatibility
    nailTechId: data.nailTechId, // Required - should be set before calling this function
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

