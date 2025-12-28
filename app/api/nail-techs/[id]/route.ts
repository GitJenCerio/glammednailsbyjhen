import { NextRequest, NextResponse } from 'next/server';
import { getNailTechById, updateNailTech, deleteNailTech } from '@/lib/services/nailTechService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nailTech = await getNailTechById(params.id);
    if (!nailTech) {
      return NextResponse.json({ error: 'Nail tech not found' }, { status: 404 });
    }
    return NextResponse.json({ nailTech });
  } catch (error: any) {
    console.error('Failed to get nail tech:', error);
    return NextResponse.json({ error: error.message || 'Failed to get nail tech' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const nailTech = await updateNailTech(params.id, body);
    return NextResponse.json({ nailTech });
  } catch (error: any) {
    console.error('Failed to update nail tech:', error);
    return NextResponse.json({ error: error.message || 'Failed to update nail tech' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteNailTech(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete nail tech:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete nail tech' }, { status: 500 });
  }
}

