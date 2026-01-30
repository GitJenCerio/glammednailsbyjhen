/**
 * Firestore Backup Script
 * 
 * Exports all Firestore collections to JSON files for backup.
 * Creates timestamped backup directory with all collections.
 * 
 * Usage:
 *   npm run backup-firestore
 * 
 * Or directly:
 *   npx tsx scripts/backup-firestore.ts
 */

import { adminDb } from '../lib/firebaseAdmin';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

interface BackupStats {
  collections: string[];
  totalDocuments: number;
  backupPath: string;
}

async function exportCollection(collectionName: string): Promise<any[]> {
  console.log(`  Exporting ${collectionName}...`);
  const collectionRef = adminDb.collection(collectionName);
  const allDocs: any[] = [];
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

    snapshot.docs.forEach((doc) => {
      allDocs.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.docs.length < batchSize) {
      break;
    }

    // Safety limit to prevent quota exhaustion during backup
    if (allDocs.length >= 100000) {
      console.log(`    ⚠️  Collection has ${allDocs.length} documents (stopped at limit)`);
      break;
    }
  }

  console.log(`    ✅ Exported ${allDocs.length} document(s)`);
  return allDocs;
}

async function backupFirestore(): Promise<BackupStats> {
  console.log('🚀 Starting Firestore backup...\n');

  // Create backup directory with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                    new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  const backupPath = path.join(BACKUP_DIR, timestamp);
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  fs.mkdirSync(backupPath, { recursive: true });

  console.log(`📁 Backup directory: ${backupPath}\n`);

  // List of collections to backup
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

  const stats: BackupStats = {
    collections: [],
    totalDocuments: 0,
    backupPath,
  };

  try {
    for (const collectionName of collections) {
      try {
        const documents = await exportCollection(collectionName);
        
        if (documents.length > 0) {
          const filePath = path.join(backupPath, `${collectionName}.json`);
          fs.writeFileSync(
            filePath,
            JSON.stringify(documents, null, 2),
            'utf-8'
          );
          
          stats.collections.push(collectionName);
          stats.totalDocuments += documents.length;
          console.log(`  ✅ Saved ${collectionName}.json (${documents.length} documents)\n`);
        } else {
          console.log(`  ℹ️  ${collectionName} is empty, skipping\n`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error backing up ${collectionName}:`, error.message);
        console.log('');
      }
    }

    // Create backup metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      collections: stats.collections,
      totalDocuments: stats.totalDocuments,
      backupVersion: '1.0',
    };

    fs.writeFileSync(
      path.join(backupPath, '_metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    console.log('✨ Backup completed!\n');
    console.log('Summary:');
    console.log(`  - Collections backed up: ${stats.collections.length}`);
    console.log(`  - Total documents: ${stats.totalDocuments.toLocaleString()}`);
    console.log(`  - Backup location: ${backupPath}\n`);

    // Clean up old backups (keep last 10)
    cleanupOldBackups();

    return stats;
  } catch (error: any) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

function cleanupOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return;
    }

    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(item => {
        const itemPath = path.join(BACKUP_DIR, item);
        return fs.statSync(itemPath).isDirectory();
      })
      .sort()
      .reverse(); // Newest first

    // Keep only the last 10 backups
    if (backups.length > 10) {
      const toDelete = backups.slice(10);
      console.log(`🧹 Cleaning up ${toDelete.length} old backup(s)...`);
      
      toDelete.forEach(backup => {
        const backupPath = path.join(BACKUP_DIR, backup);
        fs.rmSync(backupPath, { recursive: true, force: true });
        console.log(`  ✅ Deleted old backup: ${backup}`);
      });
      console.log('');
    }
  } catch (error: any) {
    console.warn('⚠️  Could not clean up old backups:', error.message);
  }
}

// Run the backup
backupFirestore()
  .then(() => {
    console.log('✅ Backup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backup script failed:', error);
    process.exit(1);
  });
