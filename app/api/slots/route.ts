import { NextResponse } from 'next/server';
import { listSlots, createSlot, deleteExpiredSlots } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';

// Prevent caching in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // Automatic slot release is disabled - use manual release from admin dashboard instead
  // Try to delete expired slots, but don't fail if index is missing
  try {
    const deletedCount = await deleteExpiredSlots();
    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} expired slot(s)`);
    }
  } catch (error) {
    console.warn('Expired slot cleanup skipped:', error);
  }
  const slots = await listSlots();
  
  // Prevent caching to ensure fresh data, especially after deletions
  return NextResponse.json({ slots }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.date || !body?.time) {
      return NextResponse.json({ error: 'Missing slot fields.' }, { status: 400 });
    }

    const blocks = await listBlockedDates();
    const slot = await createSlot(
      {
        date: body.date,
        time: body.time,
        status: body.status ?? 'available',
        slotType: body.slotType ?? 'regular',
        notes: body.notes ?? null,
        nailTechId: body.nailTechId || '', // Will default to Ms. Jhen if not provided
      },
      blocks,
    );
    return NextResponse.json({ slot }, { status: 201 });
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to create slot.';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

