import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Automated Backup Endpoint
 * 
 * This endpoint can be called by a cron job to automatically backup Firestore.
 * Set up a Vercel Cron Job to call this endpoint daily/weekly.
 * 
 * Security: Add CRON_SECRET check if needed
 */
export async function GET(request: Request) {
  // Optional: Verify this is a cron request
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Import and run backup script
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    console.log('Starting automated backup...');
    
    // Run backup script
    const { stdout, stderr } = await execAsync('npx tsx scripts/backup-firestore.ts');
    
    return NextResponse.json({
      success: true,
      message: 'Backup completed',
      output: stdout,
      error: stderr || null,
    });
  } catch (error: any) {
    console.error('Backup error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Backup failed',
    }, { status: 500 });
  }
}
