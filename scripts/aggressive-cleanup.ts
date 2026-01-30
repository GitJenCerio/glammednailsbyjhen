/**
 * Aggressive Database Cleanup Script
 * 
 * ⚠️ WARNING: This script is more aggressive and will delete:
 * - ALL cancelled bookings (regardless of age)
 * - ALL pending_form bookings older than 7 days
 * - ALL expired available slots (past dates)
 * - ALL analytics events older than 30 days
 * - ALL notifications older than 30 days
 * 
 * This is SAFER than full database wipe but more aggressive than the regular cleanup.
 * Use this if you need to free up quota immediately.
 * 
 * Usage:
 *   npx tsx scripts/aggressive-cleanup.ts
 */

import { adminDb } from '../lib/firebaseAdmin';

const BATCH_SIZE = 500; // Firestore batch limit

interface CleanupStats {
  cancelledBookings: number;
  expiredPendingBookings: number;
  expiredSlots: number;
  oldAnalytics: number;
  oldNotifications: number;
}

async function deleteAllCancelledBookings(): Promise<number> {
  console.log('🧹 Deleting ALL cancelled bookings...');
  let totalDeleted = 0;

  try {
    while (true) {
      const cancelledSnapshot = await adminDb
        .collection('bookings')
        .where('status', '==', 'cancelled')
        .limit(BATCH_SIZE)
        .get();

      if (cancelledSnapshot.empty) {
        break;
      }

      const batch = adminDb.batch();
      cancelledSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += cancelledSnapshot.docs.length;
      console.log(`  Deleted ${totalDeleted} cancelled booking(s)...`);

      if (cancelledSnapshot.docs.length < BATCH_SIZE) {
        break;
      }
    }

    console.log(`  ✅ Deleted ${totalDeleted} cancelled booking(s) total`);
    return totalDeleted;
  } catch (error: any) {
    console.warn('  ⚠️  Could not delete cancelled bookings:', error.message);
    return 0;
  }
}

async function deleteExpiredPendingBookings(daysOld: number = 7): Promise<number> {
  console.log(`🧹 Deleting pending_form bookings older than ${daysOld} days...`);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffISO = cutoffDate.toISOString();
  let totalDeleted = 0;

  try {
    while (true) {
      let pendingSnapshot;
      
      try {
        pendingSnapshot = await adminDb
          .collection('bookings')
          .where('status', '==', 'pending_form')
          .where('createdAt', '<', cutoffISO)
          .limit(BATCH_SIZE)
          .get();
      } catch (error: any) {
        // If index doesn't exist, fetch all and filter
        pendingSnapshot = await adminDb
          .collection('bookings')
          .where('status', '==', 'pending_form')
          .limit(BATCH_SIZE)
          .get();
        
        // Filter by date in memory
        const oldDocs = pendingSnapshot.docs.filter((doc) => {
          const createdAt = doc.data().createdAt;
          return createdAt && createdAt < cutoffISO;
        });
        
        if (oldDocs.length === 0) {
          break;
        }

        const batch = adminDb.batch();
        oldDocs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        totalDeleted += oldDocs.length;
        console.log(`  Deleted ${totalDeleted} expired pending booking(s)...`);

        if (pendingSnapshot.docs.length < BATCH_SIZE) {
          break;
        }
        continue;
      }

      if (pendingSnapshot.empty) {
        break;
      }

      const batch = adminDb.batch();
      pendingSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += pendingSnapshot.docs.length;
      console.log(`  Deleted ${totalDeleted} expired pending booking(s)...`);

      if (pendingSnapshot.docs.length < BATCH_SIZE) {
        break;
      }
    }

    console.log(`  ✅ Deleted ${totalDeleted} expired pending booking(s) total`);
    return totalDeleted;
  } catch (error: any) {
    console.warn('  ⚠️  Could not delete pending bookings:', error.message);
    return 0;
  }
}

async function deleteAllExpiredSlots(): Promise<number> {
  console.log('🧹 Deleting ALL expired available slots...');
  const today = new Date().toISOString().split('T')[0];
  let totalDeleted = 0;

  try {
    while (true) {
      const expiredSnapshot = await adminDb
        .collection('slots')
        .where('date', '<', today)
        .where('status', '==', 'available')
        .limit(BATCH_SIZE)
        .get();

      if (expiredSnapshot.empty) {
        break;
      }

      const batch = adminDb.batch();
      expiredSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += expiredSnapshot.docs.length;
      console.log(`  Deleted ${totalDeleted} expired slot(s)...`);

      if (expiredSnapshot.docs.length < BATCH_SIZE) {
        break;
      }
    }

    console.log(`  ✅ Deleted ${totalDeleted} expired slot(s) total`);
    return totalDeleted;
  } catch (error: any) {
    console.warn('  ⚠️  Could not delete expired slots:', error.message);
    return 0;
  }
}

async function deleteOldAnalytics(daysOld: number = 30): Promise<number> {
  console.log(`🧹 Deleting analytics events older than ${daysOld} days...`);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffISO = cutoffDate.toISOString();
  let totalDeleted = 0;

  try {
    while (true) {
      const analyticsSnapshot = await adminDb
        .collection('analytics_events')
        .where('timestamp', '<', cutoffISO)
        .limit(BATCH_SIZE)
        .get();

      if (analyticsSnapshot.empty) {
        break;
      }

      const batch = adminDb.batch();
      analyticsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += analyticsSnapshot.docs.length;
      console.log(`  Deleted ${totalDeleted} analytics event(s)...`);

      if (analyticsSnapshot.docs.length < BATCH_SIZE) {
        break;
      }
    }

    console.log(`  ✅ Deleted ${totalDeleted} analytics event(s) total`);
    return totalDeleted;
  } catch (error: any) {
    console.warn('  ⚠️  Could not delete analytics events:', error.message);
    return 0;
  }
}

async function deleteOldNotifications(daysOld: number = 30): Promise<number> {
  console.log(`🧹 Deleting notifications older than ${daysOld} days...`);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffISO = cutoffDate.toISOString();
  let totalDeleted = 0;

  try {
    while (true) {
      const notificationsSnapshot = await adminDb
        .collection('notifications')
        .where('createdAt', '<', cutoffISO)
        .limit(BATCH_SIZE)
        .get();

      if (notificationsSnapshot.empty) {
        break;
      }

      const batch = adminDb.batch();
      notificationsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += notificationsSnapshot.docs.length;
      console.log(`  Deleted ${totalDeleted} notification(s)...`);

      if (notificationsSnapshot.docs.length < BATCH_SIZE) {
        break;
      }
    }

    console.log(`  ✅ Deleted ${totalDeleted} notification(s) total`);
    return totalDeleted;
  } catch (error: any) {
    console.warn('  ⚠️  Could not delete notifications:', error.message);
    return 0;
  }
}

async function aggressiveCleanup(): Promise<CleanupStats> {
  console.log('🚀 Starting AGGRESSIVE database cleanup...\n');
  console.log('⚠️  WARNING: This will delete:');
  console.log('   - ALL cancelled bookings');
  console.log('   - ALL pending_form bookings older than 7 days');
  console.log('   - ALL expired available slots');
  console.log('   - ALL analytics events older than 30 days');
  console.log('   - ALL notifications older than 30 days\n');
  console.log('This is SAFER than full wipe but more aggressive than regular cleanup.\n');

  const stats: CleanupStats = {
    cancelledBookings: 0,
    expiredPendingBookings: 0,
    expiredSlots: 0,
    oldAnalytics: 0,
    oldNotifications: 0,
  };

  try {
    // Delete all cancelled bookings
    stats.cancelledBookings = await deleteAllCancelledBookings();
    console.log('');

    // Delete expired pending bookings (7 days)
    stats.expiredPendingBookings = await deleteExpiredPendingBookings(7);
    console.log('');

    // Delete all expired slots
    stats.expiredSlots = await deleteAllExpiredSlots();
    console.log('');

    // Delete old analytics
    stats.oldAnalytics = await deleteOldAnalytics(30);
    console.log('');

    // Delete old notifications
    stats.oldNotifications = await deleteOldNotifications(30);
    console.log('');

    const totalDeleted = 
      stats.cancelledBookings + 
      stats.expiredPendingBookings + 
      stats.expiredSlots + 
      stats.oldAnalytics + 
      stats.oldNotifications;

    console.log('✨ Aggressive cleanup completed!\n');
    console.log('Summary:');
    console.log(`  - Cancelled bookings: ${stats.cancelledBookings}`);
    console.log(`  - Expired pending bookings: ${stats.expiredPendingBookings}`);
    console.log(`  - Expired slots: ${stats.expiredSlots}`);
    console.log(`  - Old analytics events: ${stats.oldAnalytics}`);
    console.log(`  - Old notifications: ${stats.oldNotifications}`);
    console.log(`  - Total deleted: ${totalDeleted} document(s)\n`);

    if (totalDeleted > 0) {
      console.log('✅ Quota should be significantly freed up.');
      console.log('💡 Try accessing Firestore console again.');
    } else {
      console.log('ℹ️  No data found to delete.');
      console.log('💡 Your quota issue may be from read/write operations, not storage.');
      console.log('💡 Consider upgrading to Blaze plan or wait for quota reset.');
    }

    return stats;
  } catch (error: any) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
aggressiveCleanup()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
