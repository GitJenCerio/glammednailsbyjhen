import { NextResponse } from 'next/server';
import { releaseExpiredPendingBookings } from '@/lib/services/bookingService';

/**
 * Cron job endpoint to automatically release expired pending bookings
 * Runs every 5 minutes to check for bookings older than 30 minutes without form submission
 */
export async function GET(request: Request) {
  // Verify this is a cron request (optional security check)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Release bookings that are older than 30 minutes and still pending form submission
    await releaseExpiredPendingBookings(30);
    return NextResponse.json({ success: true, message: 'Expired pending bookings released' });
  } catch (error: any) {
    console.error('Error releasing expired bookings:', error);
    return NextResponse.json({ error: error.message ?? 'Failed to release expired bookings' }, { status: 500 });
  }
}

