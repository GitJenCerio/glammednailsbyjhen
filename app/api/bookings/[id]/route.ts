import { NextResponse } from 'next/server';
import { confirmBooking, getBookingById, updateBookingStatus } from '@/lib/services/bookingService';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const booking = await getBookingById(params.id);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }
  return NextResponse.json({ booking });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();

  if (body?.action === 'confirm') {
    await confirmBooking(params.id);
    return NextResponse.json({ success: true });
  }

  if (!body?.status) {
    return NextResponse.json({ error: 'No status provided.' }, { status: 400 });
  }

  await updateBookingStatus(params.id, body.status);
  return NextResponse.json({ success: true });
}

