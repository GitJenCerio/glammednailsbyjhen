/**
 * Firestore Usage Monitor
 * 
 * Tracks and reports which collections and operations are consuming the most reads/writes.
 * Helps identify problematic queries that need optimization.
 * 
 * Usage:
 *   npx tsx scripts/monitor-firestore-usage.ts
 */

import { adminDb } from '../lib/firebaseAdmin';
import * as fs from 'fs';
import * as path from 'path';

interface QueryStats {
  collection: string;
  operation: 'read' | 'write' | 'delete';
  count: number;
  queries: Array<{
    query: string;
    count: number;
  }>;
}

interface CollectionStats {
  name: string;
  totalReads: number;
  totalWrites: number;
  totalDeletes: number;
  documentCount: number;
  estimatedDailyReads: number;
  estimatedDailyWrites: number;
}

async function countCollection(collectionName: string): Promise<number> {
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
    console.error(`  ❌ Error counting ${collectionName}:`, error.message);
    return -1;
  }
}

async function analyzeCollection(collectionName: string): Promise<CollectionStats> {
  console.log(`  Analyzing ${collectionName}...`);
  
  const documentCount = await countCollection(collectionName);
  
  // Estimate reads/writes based on document count and typical usage patterns
  // These are rough estimates - actual usage depends on query patterns
  const estimatedDailyReads = documentCount > 0 
    ? Math.max(100, documentCount * 0.1) // Rough estimate: 10% of docs read daily
    : 0;
  
  const estimatedDailyWrites = documentCount > 0
    ? Math.max(10, documentCount * 0.01) // Rough estimate: 1% of docs written daily
    : 0;

  return {
    name: collectionName,
    totalReads: 0, // Would need actual monitoring to get real numbers
    totalWrites: 0,
    totalDeletes: 0,
    documentCount,
    estimatedDailyReads,
    estimatedDailyWrites,
  };
}

async function monitorFirestoreUsage() {
  console.log('📊 Firestore Usage Monitor\n');
  console.log('Analyzing collections and estimating usage...\n');

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

  const stats: CollectionStats[] = [];

  for (const collectionName of collections) {
    const stat = await analyzeCollection(collectionName);
    stats.push(stat);
    console.log(`  ✅ ${collectionName}: ${stat.documentCount.toLocaleString()} documents`);
    console.log(`     Estimated daily reads: ~${stat.estimatedDailyReads.toLocaleString()}`);
    console.log(`     Estimated daily writes: ~${stat.estimatedDailyWrites.toLocaleString()}\n`);
  }

  // Calculate totals
  const totalDocs = stats.reduce((sum, s) => sum + (s.documentCount > 0 ? s.documentCount : 0), 0);
  const totalEstimatedReads = stats.reduce((sum, s) => sum + s.estimatedDailyReads, 0);
  const totalEstimatedWrites = stats.reduce((sum, s) => sum + s.estimatedDailyWrites, 0);

  console.log('═══════════════════════════════════════');
  console.log('📈 SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total Documents: ${totalDocs.toLocaleString()}`);
  console.log(`Estimated Daily Reads: ~${totalEstimatedReads.toLocaleString()}`);
  console.log(`Estimated Daily Writes: ~${totalEstimatedWrites.toLocaleString()}\n`);

  // Identify potential issues
  console.log('🔍 POTENTIAL ISSUES:\n');
  
  const largeCollections = stats.filter(s => s.documentCount > 10000);
  if (largeCollections.length > 0) {
    console.log('⚠️  Large Collections (>10K documents):');
    largeCollections.forEach(s => {
      console.log(`   - ${s.name}: ${s.documentCount.toLocaleString()} documents`);
      console.log(`     💡 Consider: Pagination, date filtering, or archiving old data`);
    });
    console.log('');
  }

  const highReadCollections = stats.filter(s => s.estimatedDailyReads > 10000);
  if (highReadCollections.length > 0) {
    console.log('⚠️  High Read Collections (>10K estimated daily reads):');
    highReadCollections.forEach(s => {
      console.log(`   - ${s.name}: ~${s.estimatedDailyReads.toLocaleString()} reads/day`);
      console.log(`     💡 Consider: Add caching, reduce query frequency, add limits`);
    });
    console.log('');
  }

  const highWriteCollections = stats.filter(s => s.estimatedDailyWrites > 1000);
  if (highWriteCollections.length > 0) {
    console.log('⚠️  High Write Collections (>1K estimated daily writes):');
    highWriteCollections.forEach(s => {
      console.log(`   - ${s.name}: ~${s.estimatedDailyWrites.toLocaleString()} writes/day`);
      console.log(`     💡 Consider: Batch writes, reduce update frequency`);
    });
    console.log('');
  }

  // Recommendations
  console.log('💡 RECOMMENDATIONS:\n');
  
  if (totalEstimatedReads > 40000) {
    console.log('⚠️  Estimated reads exceed 40K/day (80% of 50K limit)');
    console.log('   - Review and optimize high-read collections');
    console.log('   - Add more aggressive caching');
    console.log('   - Reduce query frequency');
    console.log('');
  }

  if (totalEstimatedWrites > 16000) {
    console.log('⚠️  Estimated writes exceed 16K/day (80% of 20K limit)');
    console.log('   - Batch write operations');
    console.log('   - Reduce update frequency');
    console.log('   - Review write-heavy operations');
    console.log('');
  }

  // Save report
  const reportPath = path.join(process.cwd(), 'firestore-usage-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    collections: stats,
    totals: {
      documents: totalDocs,
      estimatedDailyReads: totalEstimatedReads,
      estimatedDailyWrites: totalEstimatedWrites,
    },
    recommendations: {
      largeCollections: largeCollections.map(s => s.name),
      highReadCollections: highReadCollections.map(s => s.name),
      highWriteCollections: highWriteCollections.map(s => s.name),
    },
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);

  console.log('✅ Analysis complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Check Firebase Console → Usage and Billing for actual numbers');
  console.log('2. Review the detailed report: firestore-usage-report.json');
  console.log('3. Optimize collections flagged above');
  console.log('4. Set up billing alerts in Google Cloud Console');
}

monitorFirestoreUsage()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
