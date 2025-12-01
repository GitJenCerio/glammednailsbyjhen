import { NextResponse } from 'next/server';
import { confirmBooking, getBookingById, updateBookingStatus, saveInvoice, updatePaymentStatus, updateDepositAmount, rescheduleBooking } from '@/lib/services/bookingService';
import type { Invoice, PaymentStatus } from '@/lib/types';

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
    const depositAmount = body.depositAmount !== undefined && body.depositAmount !== null ? Number(body.depositAmount) : undefined;
    const withAssistantCommission = Boolean(body.withAssistantCommission);
    await confirmBooking(params.id, depositAmount, withAssistantCommission);
    return NextResponse.json({ success: true });
  }

  if (body?.action === 'cancel') {
    await updateBookingStatus(params.id, 'cancelled');
    return NextResponse.json({ success: true });
  }

  if (body?.action === 'save_invoice') {
    const invoice: Invoice = body.invoice;
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice data required.' }, { status: 400 });
    }
    await saveInvoice(params.id, invoice);
    return NextResponse.json({ success: true });
  }

  if (body?.action === 'update_payment') {
    const paymentStatus: PaymentStatus = body.paymentStatus;
    const paidAmount: number | undefined = body.paidAmount;
    const tipAmount: number | undefined = body.tipAmount;
    if (!paymentStatus) {
      return NextResponse.json({ error: 'Payment status required.' }, { status: 400 });
    }
    await updatePaymentStatus(params.id, paymentStatus, paidAmount, tipAmount);
    return NextResponse.json({ success: true });
  }

  if (body?.action === 'update_deposit') {
    const depositAmount = body.depositAmount !== undefined ? Number(body.depositAmount) : undefined;
    if (depositAmount === undefined || isNaN(depositAmount)) {
      return NextResponse.json({ error: 'Valid deposit amount required.' }, { status: 400 });
    }
    await updateDepositAmount(params.id, depositAmount);
    return NextResponse.json({ success: true });
  }

  if (body?.action === 'reschedule') {
    const { newSlotId, linkedSlotIds } = body;
    if (!newSlotId) {
      return NextResponse.json({ error: 'New slot ID required.' }, { status: 400 });
    }
    await rescheduleBooking(params.id, newSlotId, linkedSlotIds);
    return NextResponse.json({ success: true });
  }

  if (!body?.status) {
    return NextResponse.json({ error: 'No status provided.' }, { status: 400 });
  }

  await updateBookingStatus(params.id, body.status);
  return NextResponse.json({ success: true });
}

