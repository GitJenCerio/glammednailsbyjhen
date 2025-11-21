import { NextResponse } from 'next/server';
import { listBlockedDates } from '@/lib/services/blockService';
import { deleteSlot, updateSlot } from '@/lib/services/slotService';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const blocks = await listBlockedDates();
  const slot = await updateSlot(params.id, body, blocks);
  return NextResponse.json({ slot });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await deleteSlot(params.id);
  return NextResponse.json({ success: true });
}

