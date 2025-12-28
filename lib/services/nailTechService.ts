import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { NailTech, NailTechInput, DayAvailability, NAIL_TECH_TIME_SLOTS } from '../types';

const nailTechsCollection = adminDb.collection('nail_techs');

export async function listNailTechs(): Promise<NailTech[]> {
  const snapshot = await nailTechsCollection.orderBy('fullName', 'asc').get();
  return snapshot.docs.map((doc) => docToNailTech(doc.id, doc.data()));
}

export async function getNailTechById(id: string): Promise<NailTech | null> {
  const snapshot = await nailTechsCollection.doc(id).get();
  if (!snapshot.exists) return null;
  return docToNailTech(snapshot.id, snapshot.data()!);
}

export async function createNailTech(input: NailTechInput): Promise<NailTech> {
  const now = Timestamp.now().toDate().toISOString();
  const data = {
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await nailTechsCollection.add(data);
  const doc = await docRef.get();
  return docToNailTech(doc.id, doc.data()!);
}

export async function updateNailTech(id: string, input: Partial<NailTechInput>): Promise<NailTech> {
  const updateData = {
    ...input,
    updatedAt: Timestamp.now().toDate().toISOString(),
  };

  await nailTechsCollection.doc(id).set(updateData, { merge: true });
  const updated = await getNailTechById(id);
  if (!updated) throw new Error('Nail tech not found after update');
  return updated;
}

export async function deleteNailTech(id: string): Promise<void> {
  await nailTechsCollection.doc(id).delete();
}

function docToNailTech(id: string, data: FirebaseFirestore.DocumentData): NailTech {
  // Handle migration from old format (startTime/endTime) to new format (availableSlots)
  let availability = data.availability;
  if (availability && Array.isArray(availability)) {
    // Check if old format (has startTime/endTime) and convert
    const needsMigration = availability.some((day: any) => day.startTime || day.endTime);
    if (needsMigration) {
      // Migrate old format to new format - include all slots by default
      const allSlots: typeof NAIL_TECH_TIME_SLOTS[number][] = [...NAIL_TECH_TIME_SLOTS];
      availability = availability.map((day: any) => ({
        dayOfWeek: day.dayOfWeek,
        enabled: day.enabled ?? false,
        availableSlots: day.enabled ? allSlots : [],
      }));
    }
  } else {
    availability = getDefaultAvailability();
  }

  return {
    id,
    fullName: data.fullName,
    role: data.role ?? undefined,
    isActive: data.isActive ?? true,
    serviceLocationAvailability: data.serviceLocationAvailability ?? 'both',
    availability,
    pricingRule: data.pricingRule ?? undefined,
    notes: data.notes ?? undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function getDefaultAvailability(): DayAvailability[] {
  // Default: Monday to Saturday, all time slots available
  const allSlots: typeof NAIL_TECH_TIME_SLOTS[number][] = [...NAIL_TECH_TIME_SLOTS];
  return [
    { dayOfWeek: 0, enabled: false, availableSlots: [] }, // Sunday
    { dayOfWeek: 1, enabled: true, availableSlots: allSlots }, // Monday
    { dayOfWeek: 2, enabled: true, availableSlots: allSlots }, // Tuesday
    { dayOfWeek: 3, enabled: true, availableSlots: allSlots }, // Wednesday
    { dayOfWeek: 4, enabled: true, availableSlots: allSlots }, // Thursday
    { dayOfWeek: 5, enabled: true, availableSlots: allSlots }, // Friday
    { dayOfWeek: 6, enabled: true, availableSlots: allSlots }, // Saturday
  ];
}

