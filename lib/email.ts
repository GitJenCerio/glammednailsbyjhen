import { Booking, Customer } from './types';

// Email functionality is disabled - all functions are no-ops
// To re-enable, install resend and implement email sending

export async function sendBookingConfirmationEmail(
  booking: Booking,
  customer: Customer,
  slotDate: string,
  slotTime: string
) {
  // Email functionality disabled
  return { success: false, error: 'Email functionality disabled' };
}

export async function sendPaymentReminderEmail(
  booking: Booking,
  customer: Customer,
  slotDate: string,
  slotTime: string,
  depositAmount?: number,
  totalAmount?: number
) {
  // Email functionality disabled
  return { success: false, error: 'Email functionality disabled' };
}

export async function sendBookingCancellationEmail(
  booking: Booking,
  customer: Customer,
  slotDate: string,
  slotTime: string
) {
  // Email functionality disabled
  return { success: false, error: 'Email functionality disabled' };
}

export async function sendAwaitingDownpaymentEmail(
  booking: Booking,
  customer: Customer,
  slotDate: string,
  slotTime: string
) {
  // Email functionality disabled
  return { success: false, error: 'Email functionality disabled' };
}

export async function sendInvoiceCreatedEmail(
  booking: Booking,
  customer: Customer,
  slotDate: string,
  slotTime: string,
  invoice: { items: Array<{ description: string; unitPrice: number; quantity: number }>; total: number; notes?: string }
) {
  // Email functionality disabled
  return { success: false, error: 'Email functionality disabled' };
}

export async function sendAppointmentReminderEmail(
  booking: Booking,
  customer: Customer,
  slotDate: string,
  slotTime: string
) {
  // Email functionality disabled
  return { success: false, error: 'Email functionality disabled' };
}
