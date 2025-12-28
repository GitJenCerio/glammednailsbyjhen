/**
 * Script to add Ms. Jhen as the first nail tech
 * Run with: npx tsx scripts/add-ms-jhen-nail-tech.ts
 */

import { adminDb } from '../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

const nailTechsCollection = adminDb.collection('nail_techs');

async function addMsJhen() {
  try {
    // Check if Ms. Jhen already exists
    const existing = await nailTechsCollection
      .where('fullName', '==', 'Ms. Jhen')
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log('Ms. Jhen already exists as a nail tech.');
      const existingDoc = existing.docs[0];
      console.log(`ID: ${existingDoc.id}`);
      return;
    }

    // Create Ms. Jhen as the first nail tech
    const now = Timestamp.now().toDate().toISOString();
    const msJhenData = {
      fullName: 'Ms. Jhen',
      role: 'Senior',
      isActive: true,
      serviceLocationAvailability: 'both', // Both studio and home service
      availability: [
        { dayOfWeek: 0, enabled: false, availableSlots: [] }, // Sunday
        { dayOfWeek: 1, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] }, // Monday
        { dayOfWeek: 2, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] }, // Tuesday
        { dayOfWeek: 3, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] }, // Wednesday
        { dayOfWeek: 4, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] }, // Thursday
        { dayOfWeek: 5, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] }, // Friday
        { dayOfWeek: 6, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] }, // Saturday
      ],
      // No custom pricing rule - uses standard pricing
      pricingRule: undefined,
      notes: 'Primary nail technician and owner',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await nailTechsCollection.add(msJhenData);
    console.log(`✅ Successfully added Ms. Jhen as a nail tech!`);
    console.log(`   ID: ${docRef.id}`);
    console.log(`   Full Name: ${msJhenData.fullName}`);
    console.log(`   Role: ${msJhenData.role}`);
    console.log(`   Service Location: ${msJhenData.serviceLocationAvailability}`);
    console.log(`   Active: ${msJhenData.isActive}`);
  } catch (error) {
    console.error('❌ Failed to add Ms. Jhen:', error);
    process.exit(1);
  }
}

// Run the script
addMsJhen()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

