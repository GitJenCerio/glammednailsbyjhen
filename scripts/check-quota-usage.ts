/**
 * Check Firestore Quota Usage
 * 
 * This script helps identify what's consuming your Firestore quota
 * by counting documents in each collection.
 * 
 * Usage:
 *   npx tsx scripts/check-quota-usage.ts
 */

import { adminDb } from '../lib/firebaseAdmin';

interface CollectionStats {
  name: string;
  count: number;
  estimatedSize: number; // Rough estimate in KB
}

async function countCollection(collectionName: string): Promise<number> {
  try {
    const collectionRef = adminDb.collection(collectionName);
    let count = 0;
    let lastDoc: any = null;
    const batchSize = 1000; // Max batch size for counting

    // Use pagination to count (more efficient than fetching all)
    while (true) {
      let query = collectionRef.limit(batchSize);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break;
      }

      count += snapshot.docs.length;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // If we got fewer docs than the limit, we're done
      if (snapshot.docs.length < batchSize) {
        break;
      }

      // Safety limit to avoid quota exhaustion
      if (count >= 100000) {
        console.log(`  ⚠️  Collection has at least ${count} documents (stopped counting at limit)`);
        return count;
      }
    }

    return count;
  } catch (error: any) {
    console.error(`  ❌ Error counting ${collectionName}:`, error.message);
    return -1;
  }
}

async function getCollectionStats(collectionName: string): Promise<CollectionStats> {
  console.log(`  Counting ${collectionName}...`);
  const count = await countCollection(collectionName);
  
  // Rough estimate: ~1KB per document on average
  const estimatedSize = count > 0 ? Math.round(count * 1) : 0;

  return {
    name: collectionName,
    count,
    estimatedSize,
  };
}

async function checkQuotaUsage() {
  console.log('📊 Checking Firestore Quota Usage...\n');
  console.log('This will count documents in each collection.\n');

  const collections = [
    'bookings',
    'slots',
    'customers',
    'analytics_events',
    'notifications',
    'blocks',
    'nail_techs',
    'users',
  ];

  const stats: CollectionStats[] = [];

  for (const collectionName of collections) {
    const stat = await getCollectionStats(collectionName);
    stats.push(stat);
    console.log(`  ✅ ${collectionName}: ${stat.count} documents (~${stat.estimatedSize} KB)\n`);
  }

  // Calculate totals
  const totalDocs = stats.reduce((sum, s) => sum + (s.count > 0 ? s.count : 0), 0);
  const totalSize = stats.reduce((sum, s) => sum + s.estimatedSize, 0);
  const totalSizeMB = (totalSize / 1024).toFixed(2);

  console.log('═══════════════════════════════════════');
  console.log('📈 SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total Documents: ${totalDocs.toLocaleString()}`);
  console.log(`Estimated Storage: ~${totalSizeMB} MB\n`);

  // Identify largest collections
  const sortedStats = [...stats].sort((a, b) => b.count - a.count);
  console.log('Top Collections by Document Count:');
  sortedStats.slice(0, 5).forEach((stat, index) => {
    if (stat.count > 0) {
      console.log(`  ${index + 1}. ${stat.name}: ${stat.count.toLocaleString()} documents`);
    }
  });

  console.log('\n💡 Recommendations:');
  
  if (totalSize > 1024 * 1024) { // > 1GB
    console.log('  ⚠️  Storage exceeds 1GB - consider deleting old data');
  }

  const largeCollections = stats.filter(s => s.count > 10000);
  if (largeCollections.length > 0) {
    console.log('  ⚠️  Large collections detected:');
    largeCollections.forEach(s => {
      console.log(`     - ${s.name}: ${s.count.toLocaleString()} documents`);
    });
    console.log('  💡 Consider cleaning up these collections');
  }

  // Check for potential issues
  const bookingsCount = stats.find(s => s.name === 'bookings')?.count || 0;
  const slotsCount = stats.find(s => s.name === 'slots')?.count || 0;
  const analyticsCount = stats.find(s => s.name === 'analytics_events')?.count || 0;

  if (bookingsCount > 50000) {
    console.log(`\n  ⚠️  You have ${bookingsCount.toLocaleString()} bookings`);
    console.log('  💡 Consider deleting old cancelled bookings');
  }

  if (slotsCount > 100000) {
    console.log(`\n  ⚠️  You have ${slotsCount.toLocaleString()} slots`);
    console.log('  💡 Consider deleting expired available slots');
  }

  if (analyticsCount > 100000) {
    console.log(`\n  ⚠️  You have ${analyticsCount.toLocaleString()} analytics events`);
    console.log('  💡 Consider deleting old analytics events');
  }

  console.log('\n✅ Analysis complete!');
}

checkQuotaUsage()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
