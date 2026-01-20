import { NextResponse } from 'next/server';
import { getNailTechById, updateNailTech, deleteNailTech } from '@/lib/services/nailTechService';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const nailTech = await getNailTechById(params.id);
    if (!nailTech) {
      return NextResponse.json({ error: 'Nail tech not found' }, { status: 404 });
    }
    return NextResponse.json({ nailTech });
  } catch (error: any) {
    console.error('Error getting nail tech:', error);
    return NextResponse.json({ error: error.message || 'Failed to get nail tech' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const nailTech = await updateNailTech(params.id, body);
    return NextResponse.json({ nailTech });
  } catch (error: any) {
    console.error('Error updating nail tech:', error);
    return NextResponse.json({ error: error.message || 'Failed to update nail tech' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteNailTech(params.id);
    return NextResponse.json({ message: 'Nail tech deactivated' });
  } catch (error: any) {
    console.error('Error deleting nail tech:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete nail tech' }, { status: 400 });
  }
}

