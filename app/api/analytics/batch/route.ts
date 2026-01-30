import { NextResponse } from 'next/server';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

/**
 * Batch analytics events endpoint.
 * 
 * Receives multiple analytics events and writes them using Firestore batch writes.
 * This reduces individual writes from potentially hundreds to just a few batch operations.
 * 
 * Firestore batch limit is 500 operations, so we split into multiple batches if needed.
 */
export async function POST(request: Request) {
  try {
    // Use dynamic import to avoid loading Firebase Admin during build
    const { adminDb } = await import('@/lib/firebaseAdmin');
    
    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Events array is required' }, { status: 400 });
    }

    // Firestore batch limit is 500 operations
    const BATCH_LIMIT = 500;
    const batches: any[] = [];
    let currentBatch = adminDb.batch();
    let operationCount = 0;

    for (const event of events) {
      // Add timestamp if not provided
      const eventData = {
        ...event,
        createdAt: event.createdAt || new Date().toISOString(),
      };

      const docRef = adminDb.collection('analytics_events').doc();
      currentBatch.set(docRef, eventData);
      operationCount++;

      // If we've reached the batch limit, commit this batch and start a new one
      if (operationCount >= BATCH_LIMIT) {
        batches.push(currentBatch);
        currentBatch = adminDb.batch();
        operationCount = 0;
      }
    }

    // Add the last batch if it has operations
    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Execute all batches in parallel
    await Promise.all(batches.map(batch => batch.commit()));

    return NextResponse.json({ 
      success: true, 
      eventsProcessed: events.length,
      batchesUsed: batches.length 
    });
  } catch (error: any) {
    console.error('Analytics batch tracking error:', error);
    return NextResponse.json({ error: 'Failed to track events' }, { status: 500 });
  }
}
