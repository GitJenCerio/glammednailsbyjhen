import { NextResponse } from 'next/server';
import { createBlockedDate, listBlockedDates } from '@/lib/services/blockService';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function GET() {
  const blockedDates = await listBlockedDates();
  
  // Add caching headers (blocks don't change frequently)
  return NextResponse.json({ blockedDates }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'CDN-Cache-Control': 'public, s-maxage=300',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=300',
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.startDate || !body?.endDate) {
    return NextResponse.json({ error: 'Missing block fields.' }, { status: 400 });
  }

  const block = await createBlockedDate({
    startDate: body.startDate,
    endDate: body.endDate,
    reason: body.reason ?? null,
    scope: body.scope ?? 'range',
  });

  return NextResponse.json({ block }, { status: 201 });
}

