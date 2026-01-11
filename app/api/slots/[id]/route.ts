import { NextResponse } from 'next/server';
import { listBlockedDates } from '@/lib/services/blockService';
import { deleteSlot, updateSlot, getSlotById } from '@/lib/services/slotService';

// Prevent caching in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const slot = await getSlotById(params.id);
    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }
    return NextResponse.json({ slot });
  } catch (error: any) {
    console.error('Error fetching slot:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch slot' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const blocks = await listBlockedDates();
    const slot = await updateSlot(params.id, body, blocks);
    return NextResponse.json({ slot });
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to update slot.';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteSlot(params.id);
    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('Error deleting slot:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete slot' },
      { status: 500 }
    );
  }
}

