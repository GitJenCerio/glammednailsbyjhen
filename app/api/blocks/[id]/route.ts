import { NextResponse } from 'next/server';
import { deleteBlockedDate, updateBlockedDate } from '@/lib/services/blockService';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const block = await updateBlockedDate(params.id, body);
  return NextResponse.json({ block });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await deleteBlockedDate(params.id);
  return NextResponse.json({ success: true });
}

