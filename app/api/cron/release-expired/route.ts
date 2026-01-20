import { NextResponse } from 'next/server';

/**
 * Cron job endpoint to automatically release expired pending bookings
 * DISABLED: Manual release is now used instead
 * This endpoint is kept for backward compatibility but does nothing
 */
export async function GET(request: Request) {
  // Verify this is a cron request (optional security check)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Automatic release is disabled - use manual release from admin dashboard instead
  return NextResponse.json({ success: true, message: 'Automatic release disabled - use manual release from admin dashboard' });
}

