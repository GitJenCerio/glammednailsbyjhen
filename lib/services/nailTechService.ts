import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { NailTech, NailTechInput, ServiceAvailability } from '../types';

// Use a getter to avoid touching Firebase at module load time
const getNailTechsCollection = () => adminDb.collection('nailTechs');
// Keep direct reference for existing logic that expects a const collection
const nailTechsCollection = adminDb.collection('nailTechs');

// Helper function to ensure name doesn't have "Ms." prefix (store without prefix)
function normalizeName(name: string): string {
  const trimmed = name.trim();
  // Remove "Ms." prefix if present (case insensitive)
  if (trimmed.toLowerCase().startsWith('ms.')) {
    return trimmed.substring(3).trim();
  }
  return trimmed;
}

export async function listNailTechs(): Promise<NailTech[]> {
  const snapshot = await getNailTechsCollection().get();
  const allTechs = snapshot.docs.map((doc) => docToNailTech(doc.id, doc.data()));
  return allTechs.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listActiveNailTechs(): Promise<NailTech[]> {
  // Fetch all nail techs and filter/sort in memory to avoid requiring a composite index
  const snapshot = await getNailTechsCollection().get();
  const allTechs = snapshot.docs.map((doc) => docToNailTech(doc.id, doc.data()));
  return allTechs
    .filter((tech) => tech.status === 'Active')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getNailTechById(id: string): Promise<NailTech | null> {
  const snapshot = await getNailTechsCollection().doc(id).get();
  if (!snapshot.exists) return null;
  return docToNailTech(snapshot.id, snapshot.data()!);
}

export async function getDefaultNailTech(): Promise<NailTech | null> {
  // Find the default nail tech (Ms. Jhen - Owner)
  const snapshot = await getNailTechsCollection()
    .where('role', '==', 'Owner')
    .where('status', '==', 'Active')
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    // If no owner found, get the first active tech
    const activeSnapshot = await nailTechsCollection
      .where('status', '==', 'Active')
      .limit(1)
      .get();
    if (activeSnapshot.empty) return null;
    return docToNailTech(activeSnapshot.docs[0].id, activeSnapshot.docs[0].data());
  }
  
  return docToNailTech(snapshot.docs[0].id, snapshot.docs[0].data());
}

export async function createNailTech(payload: NailTechInput): Promise<NailTech> {
  const now = Timestamp.now().toDate().toISOString();
  // Normalize name to remove "Ms." prefix if present (we'll add it on display)
  const normalizedName = normalizeName(payload.name);
  // Convert "Both" to "Studio and Home Service" for backward compatibility
  const serviceAvailability = (payload.serviceAvailability as string) === 'Both' 
    ? 'Studio and Home Service' 
    : payload.serviceAvailability;
  const data = {
    ...payload,
    name: normalizedName,
    serviceAvailability: serviceAvailability as ServiceAvailability,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await nailTechsCollection.add(data);
  return { ...(data as NailTech), id: ref.id };
}

export async function updateNailTech(id: string, updates: Partial<NailTechInput>): Promise<NailTech> {
  const ref = nailTechsCollection.doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('Nail tech not found.');

  const updateData: any = {
    ...updates,
    updatedAt: Timestamp.now().toDate().toISOString(),
  };
  
  // Normalize name if provided
  if (updateData.name) {
    updateData.name = normalizeName(updateData.name);
  }
  
  // Convert "Both" to "Studio and Home Service" if present
  if ((updateData.serviceAvailability as string) === 'Both') {
    updateData.serviceAvailability = 'Studio and Home Service' as ServiceAvailability;
  }
  
  await ref.set(updateData, { merge: true });
  
  const updatedSnapshot = await ref.get();
  return docToNailTech(updatedSnapshot.id, updatedSnapshot.data()!);
}

export async function deleteNailTech(id: string): Promise<void> {
  // Don't actually delete - just deactivate
  await updateNailTech(id, { status: 'Inactive' });
}

export async function createDefaultNailTech(): Promise<NailTech> {
  // Check if default already exists
  const existing = await getDefaultNailTech();
  if (existing && existing.name.toLowerCase().includes('jhen')) {
    return existing;
  }

  const defaultTech: NailTechInput = {
    name: 'Jhen', // Store without "Ms." prefix
    role: 'Owner',
    serviceAvailability: 'Studio and Home Service',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    status: 'Active',
  };

  return createNailTech(defaultTech);
}

function docToNailTech(id: string, data: FirebaseFirestore.DocumentData): NailTech {
  // Handle backward compatibility: support both 'name' and 'fullName' fields
  let name = data.name || data.fullName || '';
  // Normalize name to remove "Ms." prefix if present
  name = normalizeName(name);
  
  // Handle backward compatibility: convert "Both" to "Studio and Home Service"
  let serviceAvailability = data.serviceAvailability;
  if ((serviceAvailability as string) === 'Both') {
    serviceAvailability = 'Studio and Home Service' as ServiceAvailability;
  }
  
  return {
    id,
    name,
    role: data.role,
    serviceAvailability: serviceAvailability as ServiceAvailability,
    workingDays: data.workingDays || [],
    discount: data.discount ?? undefined,
    commissionRate: data.commissionRate ?? undefined,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

