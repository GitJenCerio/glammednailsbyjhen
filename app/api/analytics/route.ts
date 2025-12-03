import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import type { AnalyticsEvent } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'today';
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (range) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }
    
    const snapshot = await adminDb
      .collection('analytics_events')
      .where('timestamp', '>=', startDate.toISOString())
      .orderBy('timestamp', 'desc')
      .get();
    
    const events: AnalyticsEvent[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as AnalyticsEvent));
    
    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Analytics fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

