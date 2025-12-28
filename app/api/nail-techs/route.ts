import { NextRequest, NextResponse } from 'next/server';
import { listNailTechs, createNailTech } from '@/lib/services/nailTechService';

export async function GET() {
  try {
    const nailTechs = await listNailTechs();
    return NextResponse.json({ nailTechs });
  } catch (error: any) {
    console.error('Failed to list nail techs:', error);
    return NextResponse.json({ error: error.message || 'Failed to list nail techs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nailTech = await createNailTech(body);
    return NextResponse.json({ nailTech });
  } catch (error: any) {
    console.error('Failed to create nail tech:', error);
    return NextResponse.json({ error: error.message || 'Failed to create nail tech' }, { status: 500 });
  }
}

