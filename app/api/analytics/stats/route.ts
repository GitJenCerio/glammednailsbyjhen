import { NextResponse } from 'next/server';
import { getWebAnalyticsStats } from '@/lib/services/analyticsService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') as 'today' | 'week' | 'month' | 'year') || 'today';
    
    const stats = await getWebAnalyticsStats(range);
    
    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('Analytics stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics stats' }, { status: 500 });
  }
}

