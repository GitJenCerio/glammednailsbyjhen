/**
 * Firestore Restore Script
 * 
 * Restores Firestore collections from JSON backup files.
 * 
 * ⚠️ WARNING: This will overwrite existing data in Firestore!
 * 
 * Usage:
 *   npx tsx scripts/restore-firestore.ts <backup-directory-name>
 * 
 * Example:
 *   npx tsx scripts/restore-firestore.ts 2024-01-30_14-30-00
 */

import { adminDb } from '../lib/firebaseAdmin';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

interface RestoreStats {
  collections: string[];
  totalDocuments: number;
}

async function restoreCollection(collectionName: string, documents: any[]): Promise<number> {
  console.log(`  Restoring ${collectionName}...`);
  
  if (documents.length === 0) {
    console.log(`    ℹ️  No documents to restore`);
    return 0;
  }

  const collectionRef = adminDb.collection(collectionName);
  let restored = 0;
  const batchSize = 500; // Firestore batch limit

  // Process in batches
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = adminDb.batch();
    const batchDocs = documents.slice(i, i + batchSize);

    batchDocs.forEach((docData) => {
      const { id, ...data } = docData;
      const docRef = collectionRef.doc(id);
      batch.set(docRef, data);
    });

    await batch.commit();
    restored += batchDocs.length;
    console.log(`    Restored ${restored}/${documents.length} documents...`);
  }

  console.log(`    ✅ Restored ${restored} document(s)`);
  return restored;
}

async function restoreFirestore(backupName: string): Promise<RestoreStats> {
  const backupPath = path.join(BACKUP_DIR, backupName);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup directory not found: ${backupPath}`);
  }

  // Read metadata
  const metadataPath = path.join(backupPath, '_metadata.json');
  let metadata: any = null;
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    console.log('📋 Backup metadata:');
    console.log(`   Date: ${metadata.timestamp}`);
    console.log(`   Collections: ${metadata.collections.length}`);
    console.log(`   Documents: ${metadata.totalDocuments.toLocaleString()}\n`);
  }

  console.log('🚀 Starting Firestore restore...\n');
  console.log(`📁 Restoring from: ${backupPath}\n`);
  console.log('⚠️  WARNING: This will overwrite existing data!\n');

  const stats: RestoreStats = {
    collections: [],
    totalDocuments: 0,
  };

  try {
    // Get all JSON files (excluding metadata)
    const files = fs.readdirSync(backupPath)
      .filter(file => file.endsWith('.json') && file !== '_metadata.json');

    for (const file of files) {
      const collectionName = file.replace('.json', '');
      const filePath = path.join(backupPath, file);
      
      console.log(`📄 Reading ${file}...`);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const documents = JSON.parse(fileContent);

      const restored = await restoreCollection(collectionName, documents);
      
      if (restored > 0) {
        stats.collections.push(collectionName);
        stats.totalDocuments += restored;
      }
      console.log('');
    }

    console.log('✨ Restore completed!\n');
    console.log('Summary:');
    console.log(`  - Collections restored: ${stats.collections.length}`);
    console.log(`  - Total documents: ${stats.totalDocuments.toLocaleString()}\n`);

    return stats;
  } catch (error: any) {
    console.error('❌ Restore failed:', error);
    throw error;
  }
}

// Get backup name from command line
const backupName = process.argv[2];

if (!backupName) {
  console.error('❌ Error: Backup directory name required');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/restore-firestore.ts <backup-directory-name>');
  console.log('\nExample:');
  console.log('  npx tsx scripts/restore-firestore.ts 2024-01-30_14-30-00');
  console.log('\nAvailable backups:');
  
  if (fs.existsSync(BACKUP_DIR)) {
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(item => {
        const itemPath = path.join(BACKUP_DIR, item);
        return fs.statSync(itemPath).isDirectory();
      })
      .sort()
      .reverse();
    
    backups.forEach(backup => {
      console.log(`  - ${backup}`);
    });
  } else {
    console.log('  (No backups found)');
  }
  
  process.exit(1);
}

// Run the restore
restoreFirestore(backupName)
  .then(() => {
    console.log('✅ Restore script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Restore script failed:', error);
    process.exit(1);
  });
