/**
 * Safe Database Cleanup Script - Removes Old/Expired Data Only
 * 
 * This script safely removes old data to free up Firestore quota:
 * - Old expired slots (available slots with past dates)
 * - Old cancelled bookings (older than 90 days)
 * - Old expired pending_form bookings (older than 30 days)
 * - Old analytics events (older than 90 days)
 * 
 * This does NOT delete:
 * - Confirmed bookings
 * - Active customers
 * - Current or future slots
 * 
 * Usage:
 *   npx tsx scripts/cleanup-old-data.ts
 */

import { adminDb } from '../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

const BATCH_SIZE = 500; // Firestore batch limit

interface CleanupStats {
  expiredSlots: number;
  cancelledBookings: number;
  expiredPendingBookings: number;
  oldAnalytics: number;
}

async function deleteExpiredSlots(): Promise<number> {
  console.log('🧹 Cleaning up expired slots...');
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  let totalDeleted = 0;

  try {
    // Query expired slots (date < today) that are available
    const expiredSnapshot = await adminDb
      .collection('slots')
      .where('date', '<', today)
      .where('status', '==', 'available')
      .limit(BATCH_SIZE)
      .get();

    if (expiredSnapshot.empty) {
      console.log('  ✅ No expired slots to delete');
      return 0;
    }

    const batch = adminDb.batch();
    expiredSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted = expiredSnapshot.docs.length;
    console.log(`  ✅ Deleted ${totalDeleted} expired slot(s)`);

    // If we hit the limit, there might be more - but we'll stop here to avoid quota issues
    if (expiredSnapshot.docs.length === BATCH_SIZE) {
      console.log('  ⚠️  More expired slots may exist. Run this script again if needed.');
    }

    return totalDeleted;
  } catch (error: any) {
    console.warn('  ⚠️  Could not delete expired slots (index may be missing):', error.message);
    return 0;
  }
}

async function deleteOldCancelledBookings(daysOld: number = 90): Promise<number> {
  console.log(`🧹 Cleaning up cancelled bookings older than ${daysOld} days...`);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffISO = cutoffDate.toISOString();
  let totalDeleted = 0;

  try {
    // Query cancelled bookings older than cutoff
    const cancelledSnapshot = await adminDb
      .collection('bookings')
      .where('status', '==', 'cancelled')
      .where('updatedAt', '<', cutoffISO)
      .limit(BATCH_SIZE)
      .get();

    if (cancelledSnapshot.empty) {
      console.log('  ✅ No old cancelled bookings to delete');
      return 0;
    }

    const batch = adminDb.batch();
    cancelledSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted = cancelledSnapshot.docs.length;
    console.log(`  ✅ Deleted ${totalDeleted} old cancelled booking(s)`);

    if (cancelledSnapshot.docs.length === BATCH_SIZE) {
      console.log('  ⚠️  More cancelled bookings may exist. Run this script again if needed.');
    }

    return totalDeleted;
  } catch (error: any) {
    // If index doesn't exist, try without the date filter
    console.log('  ⚠️  Trying alternative query (without date filter)...');
    try {
      const cancelledSnapshot = await adminDb
        .collection('bookings')
        .where('status', '==', 'cancelled')
        .limit(BATCH_SIZE)
        .get();

      if (cancelledSnapshot.empty) {
        return 0;
      }

      // Filter by date in memory
      const oldBookings = cancelledSnapshot.docs.filter((doc) => {
        const updatedAt = doc.data().updatedAt;
        return updatedAt && updatedAt < cutoffISO;
      });

      if (oldBookings.length === 0) {
        console.log('  ✅ No old cancelled bookings to delete');
        return 0;
      }

      const batch = adminDb.batch();
      oldBookings.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted = oldBookings.length;
      console.log(`  ✅ Deleted ${totalDeleted} old cancelled booking(s)`);
      return totalDeleted;
    } catch (error2: any) {
      console.warn('  ⚠️  Could not delete cancelled bookings:', error2.message);
      return 0;
    }
  }
}

async function deleteExpiredPendingBookings(daysOld: number = 30): Promise<number> {
  console.log(`🧹 Cleaning up expired pending_form bookings older than ${daysOld} days...`);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffISO = cutoffDate.toISOString();
  let totalDeleted = 0;

  try {
    // Query pending_form bookings older than cutoff
    const pendingSnapshot = await adminDb
      .collection('bookings')
      .where('status', '==', 'pending_form')
      .where('createdAt', '<', cutoffISO)
      .limit(BATCH_SIZE)
      .get();

    if (pendingSnapshot.empty) {
      console.log('  ✅ No expired pending bookings to delete');
      return 0;
    }

    const batch = adminDb.batch();
    pendingSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted = pendingSnapshot.docs.length;
    console.log(`  ✅ Deleted ${totalDeleted} expired pending booking(s)`);

    if (pendingSnapshot.docs.length === BATCH_SIZE) {
      console.log('  ⚠️  More pending bookings may exist. Run this script again if needed.');
    }

    return totalDeleted;
  } catch (error: any) {
    // If index doesn't exist, try without the date filter
    console.log('  ⚠️  Trying alternative query (without date filter)...');
    try {
      const pendingSnapshot = await adminDb
        .collection('bookings')
        .where('status', '==', 'pending_form')
        .limit(BATCH_SIZE)
        .get();

      if (pendingSnapshot.empty) {
        return 0;
      }

      // Filter by date in memory
      const oldBookings = pendingSnapshot.docs.filter((doc) => {
        const createdAt = doc.data().createdAt;
        return createdAt && createdAt < cutoffISO;
      });

      if (oldBookings.length === 0) {
        console.log('  ✅ No expired pending bookings to delete');
        return 0;
      }

      const batch = adminDb.batch();
      oldBookings.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted = oldBookings.length;
      console.log(`  ✅ Deleted ${totalDeleted} expired pending booking(s)`);
      return totalDeleted;
    } catch (error2: any) {
      console.warn('  ⚠️  Could not delete pending bookings:', error2.message);
      return 0;
    }
  }
}

async function deleteOldAnalyticsEvents(daysOld: number = 90): Promise<number> {
  console.log(`🧹 Cleaning up analytics events older than ${daysOld} days...`);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffISO = cutoffDate.toISOString();
  let totalDeleted = 0;

  try {
    // Query old analytics events
    const analyticsSnapshot = await adminDb
      .collection('analytics_events')
      .where('timestamp', '<', cutoffISO)
      .limit(BATCH_SIZE)
      .get();

    if (analyticsSnapshot.empty) {
      console.log('  ✅ No old analytics events to delete');
      return 0;
    }

    const batch = adminDb.batch();
    analyticsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted = analyticsSnapshot.docs.length;
    console.log(`  ✅ Deleted ${totalDeleted} old analytics event(s)`);

    if (analyticsSnapshot.docs.length === BATCH_SIZE) {
      console.log('  ⚠️  More analytics events may exist. Run this script again if needed.');
    }

    return totalDeleted;
  } catch (error: any) {
    console.warn('  ⚠️  Could not delete analytics events:', error.message);
    return 0;
  }
}

async function cleanupOldData(): Promise<CleanupStats> {
  console.log('🚀 Starting safe database cleanup...\n');
  console.log('This will remove only old/expired data to free up quota.\n');

  const stats: CleanupStats = {
    expiredSlots: 0,
    cancelledBookings: 0,
    expiredPendingBookings: 0,
    oldAnalytics: 0,
  };

  try {
    // Clean up expired slots
    stats.expiredSlots = await deleteExpiredSlots();
    console.log('');

    // Clean up old cancelled bookings
    stats.cancelledBookings = await deleteOldCancelledBookings(90);
    console.log('');

    // Clean up expired pending bookings
    stats.expiredPendingBookings = await deleteExpiredPendingBookings(30);
    console.log('');

    // Clean up old analytics events
    stats.oldAnalytics = await deleteOldAnalyticsEvents(90);
    console.log('');

    const totalDeleted = 
      stats.expiredSlots + 
      stats.cancelledBookings + 
      stats.expiredPendingBookings + 
      stats.oldAnalytics;

    console.log('✨ Cleanup completed!\n');
    console.log('Summary:');
    console.log(`  - Expired slots: ${stats.expiredSlots}`);
    console.log(`  - Old cancelled bookings: ${stats.cancelledBookings}`);
    console.log(`  - Expired pending bookings: ${stats.expiredPendingBookings}`);
    console.log(`  - Old analytics events: ${stats.oldAnalytics}`);
    console.log(`  - Total deleted: ${totalDeleted} document(s)\n`);

    if (totalDeleted > 0) {
      console.log('✅ Quota should be freed up. Try accessing Firestore console again.');
      console.log('💡 If quota is still exceeded, run this script again or wait for quota reset.');
    } else {
      console.log('ℹ️  No old data found to clean up.');
      console.log('💡 You may need to upgrade your Firestore plan or wait for quota reset.');
    }

    return stats;
  } catch (error: any) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupOldData()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
