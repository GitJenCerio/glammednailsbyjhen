import { NextResponse } from 'next/server';
import { confirmBooking, getBookingById, updateBookingStatus, saveInvoice, updatePaymentStatus, updateDepositAmount, rescheduleBooking, getBookingFormUrl, splitRescheduleBooking, updateServiceType } from '@/lib/services/bookingService';
import type { Invoice, PaymentStatus, ServiceType } from '@/lib/types';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  // If action is 'formUrl', return the form URL instead of the booking
  if (action === 'formUrl') {
    try {
      const formUrl = await getBookingFormUrl(params.id);
      return NextResponse.json({ formUrl });
    } catch (error: any) {
      console.error('Error getting form URL:', error);
      return NextResponse.json({ error: error.message ?? 'Failed to get form URL' }, { status: 500 });
    }
  }
  
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
    const depositPaymentMethod: 'PNB' | 'CASH' | 'GCASH' | undefined = body.depositPaymentMethod;
    await confirmBooking(params.id, depositAmount, depositPaymentMethod);
    return NextResponse.json({ success: true });
  }

  if (body?.action === 'cancel') {
    const releaseSlot = body.releaseSlot !== false; // Default to true if not specified
    await updateBookingStatus(params.id, 'cancelled', releaseSlot);
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
    const paidPaymentMethod: 'PNB' | 'CASH' | 'GCASH' | undefined = body.paidPaymentMethod;
    if (!paymentStatus) {
      return NextResponse.json({ error: 'Payment status required.' }, { status: 400 });
    }
    await updatePaymentStatus(params.id, paymentStatus, paidAmount, tipAmount, paidPaymentMethod);
    return NextResponse.json({ success: true });
  }

  if (body?.action === 'update_deposit') {
    const depositAmount = body.depositAmount !== undefined ? Number(body.depositAmount) : undefined;
    const depositPaymentMethod: 'PNB' | 'CASH' | 'GCASH' | undefined = body.depositPaymentMethod;
    if (depositAmount === undefined || isNaN(depositAmount)) {
      return NextResponse.json({ error: 'Valid deposit amount required.' }, { status: 400 });
    }
    await updateDepositAmount(params.id, depositAmount, depositPaymentMethod);
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

  if (body?.action === 'split_reschedule') {
    const { slot1Id, slot2Id, nailTech1Id, nailTech2Id } = body;
    if (!slot1Id || !slot2Id || !nailTech1Id || !nailTech2Id) {
      return NextResponse.json({ error: 'All slot IDs and nail tech IDs are required.' }, { status: 400 });
    }
    await splitRescheduleBooking(params.id, slot1Id, slot2Id, nailTech1Id, nailTech2Id);
    return NextResponse.json({ success: true });
  }

  if (body?.action === 'update_service_type') {
    const newServiceType: ServiceType = body.serviceType;
    if (!newServiceType) {
      return NextResponse.json({ error: 'Service type is required.' }, { status: 400 });
    }
    try {
      await updateServiceType(params.id, newServiceType);
      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error('Error updating service type:', error);
      return NextResponse.json({ error: error.message ?? 'Failed to update service type' }, { status: 500 });
    }
  }

  if (!body?.status) {
    return NextResponse.json({ error: 'No status provided.' }, { status: 400 });
  }

  await updateBookingStatus(params.id, body.status);
  return NextResponse.json({ success: true });
}

