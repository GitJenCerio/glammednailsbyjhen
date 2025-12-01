import { NextResponse } from 'next/server';
import { listSlots, createSlot, deleteExpiredSlots } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';
import { releaseExpiredPendingBookings } from '@/lib/services/bookingService';

export async function GET() {
  await releaseExpiredPendingBookings(30);
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
  return NextResponse.json({ slots });
}

export async function POST(request: Request) {
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
    },
    blocks,
  );
  return NextResponse.json({ slot }, { status: 201 });
}

