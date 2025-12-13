import { NextResponse } from 'next/server';
import { deleteSlotsByDate, getSlotsByDate } from '@/lib/services/slotService';

// Prevent caching in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required.' }, { status: 400 });
    }
    
    const slots = await getSlotsByDate(date);
    return NextResponse.json({ slots, count: slots.length });
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to get slots by date.';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const onlyAvailable = searchParams.get('onlyAvailable') === 'true';
    
    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required.' }, { status: 400 });
    }
    
    const result = await deleteSlotsByDate(date, { onlyAvailable });
    return NextResponse.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} slot(s) for ${date}.`
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to delete slots by date.';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
