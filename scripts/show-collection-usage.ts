/**
 * Show Per-Collection Firestore Usage
 * 
 * Displays detailed breakdown of reads/writes per collection.
 * This helps identify which collections are consuming the most quota.
 * 
 * Usage:
 *   npx tsx scripts/show-collection-usage.ts
 */

import { adminDb } from '../lib/firebaseAdmin';

interface CollectionUsage {
  name: string;
  documentCount: number;
  sampleQueries: string[];
  estimatedReadsPerQuery: number;
  estimatedWritesPerDay: number;
}

async function countDocuments(collectionName: string): Promise<number> {
  try {
    const collectionRef = adminDb.collection(collectionName);
    let count = 0;
    let lastDoc: any = null;
    const batchSize = 1000;

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

      if (snapshot.docs.length < batchSize) {
        break;
      }

      // Safety limit
      if (count >= 100000) {
        return count;
      }
    }

    return count;
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    return -1;
  }
}

async function analyzeCollectionUsage(collectionName: string): Promise<CollectionUsage> {
  console.log(`\n📊 Analyzing: ${collectionName}`);
  console.log('   Counting documents...');
  
  const documentCount = await countDocuments(collectionName);
  
  if (documentCount < 0) {
    return {
      name: collectionName,
      documentCount: 0,
      sampleQueries: [],
      estimatedReadsPerQuery: 0,
      estimatedWritesPerDay: 0,
    };
  }

  console.log(`   ✅ Found ${documentCount.toLocaleString()} documents`);

  // Estimate based on collection type and document count
  let estimatedReadsPerQuery = 0;
  let estimatedWritesPerDay = 0;
  const sampleQueries: string[] = [];

  switch (collectionName) {
    case 'bookings':
      // listBookings() with limit 5000
      estimatedReadsPerQuery = Math.min(5000, documentCount);
      sampleQueries.push('listBookings() - fetches up to 5000 most recent');
      sampleQueries.push('Called every 5 minutes in admin dashboard');
      estimatedWritesPerDay = Math.max(10, documentCount * 0.02); // ~2% updated daily
      break;

    case 'slots':
      // listSlots() or listSlotsByDateRange()
      estimatedReadsPerQuery = documentCount; // Could fetch all if no date range
      sampleQueries.push('listSlots() - fetches ALL slots (if no date range)');
      sampleQueries.push('listSlotsByDateRange() - fetches date range only');
      sampleQueries.push('Called on booking page every 60 seconds');
      sampleQueries.push('Called in admin dashboard on load');
      estimatedWritesPerDay = Math.max(5, documentCount * 0.01); // ~1% updated daily
      break;

    case 'customers':
      // listCustomers() - fetches all
      estimatedReadsPerQuery = documentCount;
      sampleQueries.push('listCustomers() - fetches ALL customers');
      sampleQueries.push('Called in admin dashboard on load');
      estimatedWritesPerDay = Math.max(5, documentCount * 0.01); // ~1% created/updated daily
      break;

    case 'nail_techs':
      // listNailTechs() - small collection
      estimatedReadsPerQuery = documentCount;
      sampleQueries.push('listNailTechs() - fetches all (small collection)');
      sampleQueries.push('Called on booking page load');
      sampleQueries.push('Called in admin dashboard');
      estimatedWritesPerDay = 1; // Rarely changes
      break;

    case 'blocks':
      // listBlockedDates() - small collection
      estimatedReadsPerQuery = documentCount;
      sampleQueries.push('listBlockedDates() - fetches all (small collection)');
      sampleQueries.push('Called on booking page load');
      estimatedWritesPerDay = 1; // Rarely changes
      break;

    case 'notifications':
      // subscribeToNotifications() with limit 50
      estimatedReadsPerQuery = 50;
      sampleQueries.push('subscribeToNotifications() - real-time listener, limit 50');
      sampleQueries.push('Active in admin dashboard');
      estimatedWritesPerDay = Math.max(10, documentCount * 0.1); // ~10% created daily
      break;

    case 'analytics_events':
      // listAnalyticsEvents() with date range
      estimatedReadsPerQuery = Math.min(1000, documentCount);
      sampleQueries.push('listAnalyticsEvents() - fetches with date range');
      estimatedWritesPerDay = Math.max(50, documentCount * 0.2); // ~20% created daily
      break;

    case 'users':
      // getUsers() - small collection
      estimatedReadsPerQuery = documentCount;
      sampleQueries.push('getUsers() - fetches all (small collection)');
      estimatedWritesPerDay = 1; // Rarely changes
      break;

    default:
      estimatedReadsPerQuery = documentCount;
      estimatedWritesPerDay = Math.max(1, documentCount * 0.01);
  }

  return {
    name: collectionName,
    documentCount,
    sampleQueries,
    estimatedReadsPerQuery,
    estimatedWritesPerDay,
  };
}

async function showCollectionUsage() {
  console.log('🔍 Firestore Per-Collection Usage Analysis\n');
  console.log('This shows which collections are consuming the most reads/writes.\n');

  const collections = [
    'bookings',
    'slots',
    'customers',
    'nail_techs',
    'users',
    'blocks',
    'notifications',
    'analytics_events',
  ];

  const usage: CollectionUsage[] = [];

  for (const collectionName of collections) {
    const collectionUsage = await analyzeCollectionUsage(collectionName);
    usage.push(collectionUsage);
  }

  // Calculate estimated daily usage
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📈 PER-COLLECTION USAGE BREAKDOWN');
  console.log('═══════════════════════════════════════════════════════════\n');

  usage.forEach((col) => {
    if (col.documentCount === 0) {
      console.log(`📦 ${col.name}:`);
      console.log(`   Documents: 0 (empty or inaccessible)`);
      console.log(`   ⚠️  Cannot analyze - collection may be empty or access denied\n`);
      return;
    }

    // Estimate daily reads based on query frequency
    let estimatedDailyReads = 0;
    
    switch (col.name) {
      case 'bookings':
        // Admin dashboard: every 5 minutes = 288 times/day
        // Each query reads up to 5000
        estimatedDailyReads = 288 * col.estimatedReadsPerQuery;
        break;
      case 'slots':
        // Booking page: every 60 seconds when open = ~60 times/hour
        // Admin dashboard: on load and when month changes
        estimatedDailyReads = (60 * 8) * col.estimatedReadsPerQuery; // 8 hours open
        break;
      case 'customers':
        // Admin dashboard: on load
        estimatedDailyReads = 10 * col.estimatedReadsPerQuery; // ~10 loads/day
        break;
      case 'nail_techs':
        // Booking page: on load
        // Admin dashboard: on load
        estimatedDailyReads = 50 * col.estimatedReadsPerQuery; // ~50 loads/day
        break;
      case 'blocks':
        // Booking page: on load
        estimatedDailyReads = 30 * col.estimatedReadsPerQuery; // ~30 loads/day
        break;
      case 'notifications':
        // Real-time listener: 1 read per change
        estimatedDailyReads = col.estimatedWritesPerDay; // Reads = writes for real-time
        break;
      case 'analytics_events':
        // Analytics dashboard: occasional queries
        estimatedDailyReads = 10 * col.estimatedReadsPerQuery; // ~10 queries/day
        break;
      default:
        estimatedDailyReads = 10 * col.estimatedReadsPerQuery;
    }

    console.log(`📦 ${col.name.toUpperCase()}:`);
    console.log(`   Documents: ${col.documentCount.toLocaleString()}`);
    console.log(`   Estimated reads per query: ${col.estimatedReadsPerQuery.toLocaleString()}`);
    console.log(`   Estimated daily reads: ~${estimatedDailyReads.toLocaleString()}`);
    console.log(`   Estimated daily writes: ~${col.estimatedWritesPerDay.toLocaleString()}`);
    
    if (col.sampleQueries.length > 0) {
      console.log(`   Common queries:`);
      col.sampleQueries.forEach(q => {
        console.log(`     • ${q}`);
      });
    }

    // Flag issues
    if (col.documentCount > 10000 && col.estimatedReadsPerQuery === col.documentCount) {
      console.log(`   ⚠️  WARNING: Queries fetch ALL documents (no limit/date range)`);
    }
    if (estimatedDailyReads > 10000) {
      console.log(`   ⚠️  WARNING: High daily reads (>10K)`);
    }
    if (col.estimatedWritesPerDay > 1000) {
      console.log(`   ⚠️  WARNING: High daily writes (>1K)`);
    }

    console.log('');
  });

  // Summary
  const totalDocs = usage.reduce((sum, u) => sum + (u.documentCount > 0 ? u.documentCount : 0), 0);
  const totalDailyReads = usage.reduce((sum, u) => {
    const reads = u.name === 'bookings' ? 288 * u.estimatedReadsPerQuery :
                  u.name === 'slots' ? (60 * 8) * u.estimatedReadsPerQuery :
                  u.name === 'customers' ? 10 * u.estimatedReadsPerQuery :
                  u.name === 'nail_techs' ? 50 * u.estimatedReadsPerQuery :
                  u.name === 'blocks' ? 30 * u.estimatedReadsPerQuery :
                  u.name === 'notifications' ? u.estimatedWritesPerDay :
                  u.name === 'analytics_events' ? 10 * u.estimatedReadsPerQuery :
                  10 * u.estimatedReadsPerQuery;
    return sum + reads;
  }, 0);
  const totalDailyWrites = usage.reduce((sum, u) => sum + u.estimatedWritesPerDay, 0);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total Documents: ${totalDocs.toLocaleString()}`);
  console.log(`Estimated Daily Reads: ~${totalDailyReads.toLocaleString()}`);
  console.log(`Estimated Daily Writes: ~${totalDailyWrites.toLocaleString()}\n`);

  // Top collections
  const sortedByReads = [...usage]
    .filter(u => u.documentCount > 0)
    .map(u => ({
      name: u.name,
      reads: u.name === 'bookings' ? 288 * u.estimatedReadsPerQuery :
             u.name === 'slots' ? (60 * 8) * u.estimatedReadsPerQuery :
             u.name === 'customers' ? 10 * u.estimatedReadsPerQuery :
             u.name === 'nail_techs' ? 50 * u.estimatedReadsPerQuery :
             u.name === 'blocks' ? 30 * u.estimatedReadsPerQuery :
             u.name === 'notifications' ? u.estimatedWritesPerDay :
             u.name === 'analytics_events' ? 10 * u.estimatedReadsPerQuery :
             10 * u.estimatedReadsPerQuery,
    }))
    .sort((a, b) => b.reads - a.reads);

  if (sortedByReads.length > 0) {
    console.log('🔝 TOP COLLECTIONS BY ESTIMATED DAILY READS:');
    sortedByReads.slice(0, 5).forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}: ~${col.reads.toLocaleString()} reads/day`);
    });
    console.log('');
  }

  console.log('💡 TIP: For actual usage numbers, check Firebase Console:');
  console.log('   https://console.firebase.google.com/');
  console.log('   → Your Project → Usage and Billing → Firestore\n');
}

showCollectionUsage()
  .then(() => {
    console.log('✅ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
