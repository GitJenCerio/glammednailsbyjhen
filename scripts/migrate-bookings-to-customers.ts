/**
 * Migration script to create customers from existing bookings
 * Run this once to link all existing bookings to customer records
 * 
 * Usage: npx ts-node scripts/migrate-bookings-to-customers.ts
 */

import { adminDb } from '../lib/firebaseAdmin';
import { findOrCreateCustomer } from '../lib/services/customerService';

async function migrateBookingsToCustomers() {
  console.log('Starting migration...');
  
  const bookingsCollection = adminDb.collection('bookings');
  const snapshot = await bookingsCollection.get();
  
  let processed = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const bookingData = doc.data();
      
      // Skip if already has a valid customerId
      if (bookingData.customerId && 
          bookingData.customerId !== 'MIGRATION_NEEDED' && 
          bookingData.customerId !== 'PENDING_FORM_SUBMISSION') {
        console.log(`Skipping booking ${doc.id} - already has customerId: ${bookingData.customerId}`);
        continue;
      }

      // Skip if no customerData
      if (!bookingData.customerData) {
        console.log(`Skipping booking ${doc.id} - no customerData`);
        continue;
      }

      // Find or create customer
      const customer = await findOrCreateCustomer(bookingData.customerData);
      
      // Update booking with customerId
      await doc.ref.set({
        customerId: customer.id,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (bookingData.customerId === 'MIGRATION_NEEDED' || !bookingData.customerId) {
        created++;
      } else {
        updated++;
      }
      
      processed++;
      
      if (processed % 10 === 0) {
        console.log(`Processed ${processed} bookings...`);
      }
    } catch (error: any) {
      console.error(`Error processing booking ${doc.id}:`, error.message);
      errors++;
    }
  }

  console.log('\nMigration complete!');
  console.log(`Total processed: ${processed}`);
  console.log(`Created customers: ${created}`);
  console.log(`Updated bookings: ${updated}`);
  console.log(`Errors: ${errors}`);
}

// Run migration
migrateBookingsToCustomers()
  .then(() => {
    console.log('Migration finished successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

