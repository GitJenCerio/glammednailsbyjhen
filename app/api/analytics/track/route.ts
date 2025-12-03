import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const eventData = await request.json();
    
    // Add timestamp if not provided
    const event = {
      ...eventData,
      createdAt: new Date().toISOString(),
    };
    
    await adminDb.collection('analytics_events').add(event);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}

