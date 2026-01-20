/**
 * Database Cleanup Script
 * 
 * WARNING: This script will DELETE ALL bookings and customers from your database.
 * This is IRREVERSIBLE. Use only when you want to start fresh for production.
 * 
 * Usage:
 *   npm run clean-database
 * 
 * Or directly:
 *   npx tsx scripts/clean-database.ts
 */

import { adminDb } from '../lib/firebaseAdmin';

async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = adminDb.collection(collectionName);
  const batchSize = 500; // Firestore batch limit
  let totalDeleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    
    if (snapshot.empty) {
      break;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.docs.length;
    console.log(`  Deleted ${totalDeleted} ${collectionName}...`);

    // If we got fewer docs than the limit, we're done
    if (snapshot.docs.length < batchSize) {
      break;
    }
  }

  return totalDeleted;
}

async function cleanDatabase() {
  console.log('🚨 WARNING: This will delete ALL bookings and customers!');
  console.log('Starting database cleanup...\n');

  try {
    // Delete all bookings
    console.log('Deleting all bookings...');
    const bookingCount = await deleteCollection('bookings');
    if (bookingCount > 0) {
      console.log(`✅ Deleted ${bookingCount} booking(s)`);
    } else {
      console.log('ℹ️  No bookings found to delete');
    }

    // Delete all customers
    console.log('\nDeleting all customers...');
    const customerCount = await deleteCollection('customers');
    if (customerCount > 0) {
      console.log(`✅ Deleted ${customerCount} customer(s)`);
    } else {
      console.log('ℹ️  No customers found to delete');
    }

    console.log('\n✨ Database cleanup completed successfully!');
    console.log('Your database is now clean and ready for production.');
    
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanDatabase()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

