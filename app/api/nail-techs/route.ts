import { NextResponse } from 'next/server';
import { listNailTechs, listActiveNailTechs, createNailTech } from '@/lib/services/nailTechService';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';
    
    const nailTechs = activeOnly ? await listActiveNailTechs() : await listNailTechs();
    
    return NextResponse.json({ nailTechs }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error listing nail techs:', error);
    return NextResponse.json({ error: error.message || 'Failed to list nail techs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nailTech = await createNailTech(body);
    return NextResponse.json({ nailTech }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating nail tech:', error);
    return NextResponse.json({ error: error.message || 'Failed to create nail tech' }, { status: 400 });
  }
}

