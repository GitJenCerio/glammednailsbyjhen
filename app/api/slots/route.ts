import { NextResponse } from 'next/server';
import { listSlots, listSlotsByDateRange, createSlot } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';

// Prevent caching in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const nailTechId = searchParams.get('nailTechId') || undefined;

  if ((startDate && !endDate) || (!startDate && endDate)) {
    return NextResponse.json({ error: 'Both startDate and endDate are required.' }, { status: 400 });
  }

  // OPTIMIZED: Require date range to prevent unbounded queries
  // This prevents accidental quota exhaustion from fetching all slots
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Both startDate and endDate query parameters are required.' },
      { status: 400 }
    );
  }

  const slots = await listSlotsByDateRange(startDate, endDate, nailTechId);
  
  // OPTIMIZED: Use stale-while-revalidate caching (20 seconds fresh, 40 seconds stale)
  // Slots change moderately frequently, but short cache significantly reduces reads
  return NextResponse.json({ slots }, {
    headers: {
      'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
      'CDN-Cache-Control': 'public, s-maxage=20',
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
        isHidden: body.isHidden ?? false,
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

