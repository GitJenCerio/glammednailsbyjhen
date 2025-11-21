import { NextResponse } from 'next/server';
import { createBlockedDate, listBlockedDates } from '@/lib/services/blockService';

export async function GET() {
  const blockedDates = await listBlockedDates();
  return NextResponse.json({ blockedDates });
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

