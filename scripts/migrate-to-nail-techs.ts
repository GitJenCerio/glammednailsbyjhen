/**
 * Migration script to add nail tech support
 * 
 * This script:
 * 1. Creates the default nail tech (Ms. Jhen)
 * 2. Assigns all existing slots to Ms. Jhen
 * 3. Assigns all existing bookings to Ms. Jhen
 * 
 * Run with: npx ts-node scripts/migrate-to-nail-techs.ts
 */

import { adminDb } from '../lib/firebaseAdmin';
import { createDefaultNailTech, getDefaultNailTech } from '../lib/services/nailTechService';
import { Timestamp } from 'firebase-admin/firestore';

async function migrate() {
  console.log('Starting nail tech migration...');

  try {
    // Step 1: Create or get default nail tech (Ms. Jhen)
    console.log('Step 1: Creating/getting default nail tech...');
    let defaultNailTech = await getDefaultNailTech();
    
    if (!defaultNailTech) {
      console.log('Creating default nail tech (Ms. Jhen)...');
      defaultNailTech = await createDefaultNailTech();
    }
    
    console.log(`Default nail tech ID: ${defaultNailTech.id} (${defaultNailTech.fullName})`);

    // Step 2: Assign all existing slots to Ms. Jhen
    console.log('Step 2: Assigning existing slots to default nail tech...');
    const slotsCollection = adminDb.collection('slots');
    const slotsSnapshot = await slotsCollection.get();
    
    let slotsUpdated = 0;
    for (const doc of slotsSnapshot.docs) {
      const data = doc.data();
      if (!data.nailTechId) {
        await doc.ref.set({
          nailTechId: defaultNailTech.id,
          updatedAt: Timestamp.now().toDate().toISOString(),
        }, { merge: true });
        slotsUpdated++;
      }
    }
    console.log(`Updated ${slotsUpdated} slots`);

    // Step 3: Assign all existing bookings to Ms. Jhen
    console.log('Step 3: Assigning existing bookings to default nail tech...');
    const bookingsCollection = adminDb.collection('bookings');
    const bookingsSnapshot = await bookingsCollection.get();
    
    let bookingsUpdated = 0;
    for (const doc of bookingsSnapshot.docs) {
      const data = doc.data();
      if (!data.nailTechId) {
        await doc.ref.set({
          nailTechId: defaultNailTech.id,
          updatedAt: Timestamp.now().toDate().toISOString(),
        }, { merge: true });
        bookingsUpdated++;
      }
    }
    console.log(`Updated ${bookingsUpdated} bookings`);

    console.log('✅ Migration completed successfully!');
    console.log(`- Default nail tech: ${defaultNailTech.fullName} (${defaultNailTech.id})`);
    console.log(`- Slots updated: ${slotsUpdated}`);
    console.log(`- Bookings updated: ${bookingsUpdated}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

