import { NextResponse } from 'next/server';
import { createBooking, listBookings } from '@/lib/services/bookingService';

export async function GET() {
  const bookings = await listBookings();
  return NextResponse.json({ bookings });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { slotId, serviceType, pairedSlotId, clientType, serviceLocation } = body ?? {};

  if (!slotId) {
    return NextResponse.json({ error: 'Missing slotId.' }, { status: 400 });
  }

  try {
    const result = await createBooking(slotId, { serviceType, pairedSlotId, clientType, serviceLocation });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to create booking.' }, { status: 400 });
  }
}

