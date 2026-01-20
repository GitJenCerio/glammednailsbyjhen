import { NextResponse } from 'next/server';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Use dynamic import to avoid loading Firebase Admin during build
    const { adminDb } = await import('@/lib/firebaseAdmin');
    
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

