import { deleteExpiredSlots } from '@/lib/services/slotService';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const deletedCount = await deleteExpiredSlots();
    return NextResponse.json({ 
      message: `Deleted ${deletedCount} expired slot(s).`,
      deletedCount 
    });
  } catch (error: any) {
    console.error('Error deleting expired slots:', error);
    return NextResponse.json({ error: error.message ?? 'Failed to delete expired slots.' }, { status: 500 });
  }
}

