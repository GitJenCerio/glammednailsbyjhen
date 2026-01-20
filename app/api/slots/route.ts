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

  // Automatic slot release is disabled - use manual release from admin dashboard instead
  // Don't run expired slot cleanup on every request - it's slow and not critical
  // Run it in a background cron job or manually from admin dashboard instead
  const slots = startDate && endDate
    ? await listSlotsByDateRange(startDate, endDate, nailTechId)
    : await listSlots(nailTechId);
  
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

