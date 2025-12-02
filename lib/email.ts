import { Resend } from 'resend';
import { Booking, Customer } from './types';
import { format } from 'date-fns';

const resend = new Resend(process.env.RESEND_API_KEY);

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY not set. Email notifications will be disabled.');
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'glammednailsbyjhen <noreply@glammednailsbyjhen.com>';
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'glammednailsbyjhen@gmail.com';
const PNB_QR_CODE_URL = process.env.PNB_QR_CODE_URL || '';
const GCASH_QR_CODE_URL = process.env.GCASH_QR_CODE_URL || '';

function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'EEEE, MMMM d, yyyy');
  } catch {
    return dateString;
  }
}

export async function sendBookingConfirmationEmail(booking: Booking, customer: Customer, slotDate: string, slotTime: string) {
  if (!process.env.RESEND_API_KEY || !customer.email) {
    return { success: false, error: 'Email not configured or customer email missing' };
  }

  try {
    const serviceType = booking.serviceType || 'Service';
    const serviceLocation = booking.serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio';
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      replyTo: REPLY_TO_EMAIL,
      subject: `Booking Confirmed - ${formatDate(slotDate)} at ${formatTime12Hour(slotTime)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✨ Booking Confirmed! ✨</h1>
            </div>
            <div class="content">
              <p>Hi ${customer.name},</p>
              <p>Great news! Your booking has been confirmed.</p>
              
              <div class="booking-details">
                <h2 style="margin-top: 0; color: #667eea;">Booking Details</h2>
                <div class="detail-row">
                  <span class="label">Booking ID:</span>
                  <span class="value">${booking.bookingId}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date:</span>
                  <span class="value">${formatDate(slotDate)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time:</span>
                  <span class="value">${formatTime12Hour(slotTime)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Service:</span>
                  <span class="value">${serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span class="value">${serviceLocation}</span>
                </div>
              </div>

              <p>We're looking forward to seeing you!</p>
              <p>If you have any questions or need to make changes, please don't hesitate to contact us.</p>
              
              <div class="footer">
                <p>Best regards,<br>Jhen</p>
                <p style="margin-top: 20px;">
                  <a href="mailto:${REPLY_TO_EMAIL}" style="color: #667eea;">${REPLY_TO_EMAIL}</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending confirmation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending confirmation email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendPaymentReminderEmail(booking: Booking, customer: Customer, slotDate: string, slotTime: string, depositAmount?: number, totalAmount?: number) {
  if (!process.env.RESEND_API_KEY || !customer.email) {
    return { success: false, error: 'Email not configured or customer email missing' };
  }

  try {
    const serviceType = booking.serviceType || 'Service';
    const serviceLocation = booking.serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio';
    const remainingAmount = totalAmount && depositAmount ? totalAmount - depositAmount : undefined;
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      replyTo: REPLY_TO_EMAIL,
      subject: `Payment Reminder - Booking ${booking.bookingId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .payment-info { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .amount { font-size: 18px; font-weight: bold; color: #f5576c; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💳 Payment Reminder</h1>
            </div>
            <div class="content">
              <p>Hi ${customer.name},</p>
              <p>This is a friendly reminder about your upcoming appointment.</p>
              
              <div class="booking-details">
                <h2 style="margin-top: 0; color: #f5576c;">Booking Details</h2>
                <div class="detail-row">
                  <span class="label">Booking ID:</span>
                  <span class="value">${booking.bookingId}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date:</span>
                  <span class="value">${formatDate(slotDate)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time:</span>
                  <span class="value">${formatTime12Hour(slotTime)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Service:</span>
                  <span class="value">${serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span class="value">${serviceLocation}</span>
                </div>
              </div>

              <div class="payment-info">
                <h3 style="margin-top: 0;">Payment Information</h3>
                ${depositAmount ? `<p><strong>Deposit Paid:</strong> ₱${depositAmount.toFixed(2)}</p>` : ''}
                ${totalAmount ? `<p><strong>Total Amount:</strong> <span class="amount">₱${totalAmount.toFixed(2)}</span></p>` : ''}
                ${remainingAmount ? `<p><strong>Remaining Balance:</strong> <span class="amount">₱${remainingAmount.toFixed(2)}</span></p>` : ''}
                ${!depositAmount && !totalAmount ? '<p>Please complete your payment to confirm your booking.</p>' : ''}
              </div>

              ${(PNB_QR_CODE_URL || GCASH_QR_CODE_URL) ? `
              <div style="text-align: center; margin: 30px 0;">
                <h3 style="color: #f5576c; margin-bottom: 20px;">💳 Payment Options</h3>
                <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
                  ${PNB_QR_CODE_URL ? `
                  <div style="text-align: center;">
                    <h4 style="color: #f5576c; margin-bottom: 10px; font-size: 16px;">PNB</h4>
                    <img src="${PNB_QR_CODE_URL}" alt="PNB QR Code" style="max-width: 200px; height: auto; border: 2px solid #f5576c; border-radius: 8px; padding: 10px; background: white;" />
                  </div>
                  ` : ''}
                  ${GCASH_QR_CODE_URL ? `
                  <div style="text-align: center;">
                    <h4 style="color: #f5576c; margin-bottom: 10px; font-size: 16px;">GCash</h4>
                    <img src="${GCASH_QR_CODE_URL}" alt="GCash QR Code" style="max-width: 200px; height: auto; border: 2px solid #f5576c; border-radius: 8px; padding: 10px; background: white;" />
                  </div>
                  ` : ''}
                </div>
                <p style="margin-top: 15px; color: #666; font-size: 14px;">Scan the QR code to make your payment</p>
              </div>
              ` : ''}

              <p>Please complete your payment at your earliest convenience to secure your appointment.</p>
              <p>If you have any questions, please contact us.</p>
              
              <div class="footer">
                <p>Best regards,<br>Jhen</p>
                <p style="margin-top: 20px;">
                  <a href="mailto:${REPLY_TO_EMAIL}" style="color: #f5576c;">${REPLY_TO_EMAIL}</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending payment reminder email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending payment reminder email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendBookingCancellationEmail(booking: Booking, customer: Customer, slotDate: string, slotTime: string) {
  if (!process.env.RESEND_API_KEY || !customer.email) {
    return { success: false, error: 'Email not configured or customer email missing' };
  }

  try {
    const serviceType = booking.serviceType || 'Service';
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      replyTo: REPLY_TO_EMAIL,
      subject: `Booking Cancelled - ${formatDate(slotDate)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6c757d; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Cancelled</h1>
            </div>
            <div class="content">
              <p>Hi ${customer.name},</p>
              <p>We're sorry to inform you that your booking has been cancelled.</p>
              
              <div class="booking-details">
                <h2 style="margin-top: 0; color: #6c757d;">Cancelled Booking Details</h2>
                <div class="detail-row">
                  <span class="label">Booking ID:</span>
                  <span class="value">${booking.bookingId}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date:</span>
                  <span class="value">${formatDate(slotDate)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time:</span>
                  <span class="value">${formatTime12Hour(slotTime)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Service:</span>
                  <span class="value">${serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
              </div>

              <p>If you'd like to reschedule or have any questions, please don't hesitate to contact us.</p>
              
              <div class="footer">
                <p>Best regards,<br>Jhen</p>
                <p style="margin-top: 20px;">
                  <a href="mailto:${REPLY_TO_EMAIL}" style="color: #6c757d;">${REPLY_TO_EMAIL}</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending cancellation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending cancellation email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendAwaitingDownpaymentEmail(booking: Booking, customer: Customer, slotDate: string, slotTime: string) {
  if (!process.env.RESEND_API_KEY || !customer.email) {
    return { success: false, error: 'Email not configured or customer email missing' };
  }

  try {
    const serviceType = booking.serviceType || 'Service';
    const serviceLocation = booking.serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio';
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      replyTo: REPLY_TO_EMAIL,
      subject: `Booking Received - Awaiting Downpayment - ${formatDate(slotDate)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .payment-notice { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffa726; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 Booking Received!</h1>
            </div>
            <div class="content">
              <p>Hi ${customer.name},</p>
              <p>Thank you for your booking! We've received your form submission and are processing your request.</p>
              
              <div class="booking-details">
                <h2 style="margin-top: 0; color: #fb8c00;">Booking Details</h2>
                <div class="detail-row">
                  <span class="label">Booking ID:</span>
                  <span class="value">${booking.bookingId}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date:</span>
                  <span class="value">${formatDate(slotDate)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time:</span>
                  <span class="value">${formatTime12Hour(slotTime)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Service:</span>
                  <span class="value">${serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span class="value">${serviceLocation}</span>
                </div>
              </div>

              <div class="payment-notice">
                <h3 style="margin-top: 0;">💳 Next Step: Downpayment Required</h3>
                <p>To secure your appointment, please complete your downpayment. We'll send you an invoice with payment details shortly.</p>
                <p>Once your downpayment is received, your booking will be confirmed!</p>
              </div>

              ${(PNB_QR_CODE_URL || GCASH_QR_CODE_URL) ? `
              <div style="text-align: center; margin: 30px 0;">
                <h3 style="color: #fb8c00; margin-bottom: 20px;">💳 Payment Options</h3>
                <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
                  ${PNB_QR_CODE_URL ? `
                  <div style="text-align: center;">
                    <h4 style="color: #fb8c00; margin-bottom: 10px; font-size: 16px;">PNB</h4>
                    <img src="${PNB_QR_CODE_URL}" alt="PNB QR Code" style="max-width: 200px; height: auto; border: 2px solid #fb8c00; border-radius: 8px; padding: 10px; background: white;" />
                  </div>
                  ` : ''}
                  ${GCASH_QR_CODE_URL ? `
                  <div style="text-align: center;">
                    <h4 style="color: #fb8c00; margin-bottom: 10px; font-size: 16px;">GCash</h4>
                    <img src="${GCASH_QR_CODE_URL}" alt="GCash QR Code" style="max-width: 200px; height: auto; border: 2px solid #fb8c00; border-radius: 8px; padding: 10px; background: white;" />
                  </div>
                  ` : ''}
                </div>
                <p style="margin-top: 15px; color: #666; font-size: 14px;">Scan the QR code to make your payment</p>
              </div>
              ` : ''}

              <p>If you have any questions, please don't hesitate to contact us.</p>
              
              <div class="footer">
                <p>Best regards,<br>Jhen</p>
                <p style="margin-top: 20px;">
                  <a href="mailto:${REPLY_TO_EMAIL}" style="color: #fb8c00;">${REPLY_TO_EMAIL}</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending awaiting downpayment email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending awaiting downpayment email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendInvoiceCreatedEmail(booking: Booking, customer: Customer, slotDate: string, slotTime: string, invoice: { items: Array<{ description: string; unitPrice: number; quantity: number }>; total: number; notes?: string }) {
  if (!process.env.RESEND_API_KEY || !customer.email) {
    return { success: false, error: 'Email not configured or customer email missing' };
  }

  try {
    const serviceType = booking.serviceType || 'Service';
    const serviceLocation = booking.serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio';
    
    const itemsHtml = invoice.items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₱${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₱${(item.unitPrice * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      replyTo: REPLY_TO_EMAIL,
      subject: `Invoice Created - Booking ${booking.bookingId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .invoice-table { width: 100%; background: white; border-collapse: collapse; margin: 20px 0; border-radius: 8px; overflow: hidden; }
            .invoice-table th { background: #1e88e5; color: white; padding: 12px; text-align: left; }
            .invoice-table td { padding: 10px; }
            .total-row { font-weight: bold; font-size: 18px; background: #e3f2fd; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📄 Invoice Created</h1>
            </div>
            <div class="content">
              <p>Hi ${customer.name},</p>
              <p>We've created an invoice for your booking. Please see the details below.</p>
              
              <div class="booking-details">
                <h2 style="margin-top: 0; color: #1e88e5;">Booking Details</h2>
                <div class="detail-row">
                  <span class="label">Booking ID:</span>
                  <span class="value">${booking.bookingId}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date:</span>
                  <span class="value">${formatDate(slotDate)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time:</span>
                  <span class="value">${formatTime12Hour(slotTime)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Service:</span>
                  <span class="value">${serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span class="value">${serviceLocation}</span>
                </div>
              </div>

              <table class="invoice-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                  <tr class="total-row">
                    <td colspan="3" style="text-align: right; padding: 15px;">Total:</td>
                    <td style="text-align: right; padding: 15px;">₱${invoice.total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}

              ${(PNB_QR_CODE_URL || GCASH_QR_CODE_URL) ? `
              <div style="text-align: center; margin: 30px 0;">
                <h3 style="color: #1e88e5; margin-bottom: 20px;">💳 Payment Options</h3>
                <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
                  ${PNB_QR_CODE_URL ? `
                  <div style="text-align: center;">
                    <h4 style="color: #1e88e5; margin-bottom: 10px; font-size: 16px;">PNB</h4>
                    <img src="${PNB_QR_CODE_URL}" alt="PNB QR Code" style="max-width: 200px; height: auto; border: 2px solid #1e88e5; border-radius: 8px; padding: 10px; background: white;" />
                  </div>
                  ` : ''}
                  ${GCASH_QR_CODE_URL ? `
                  <div style="text-align: center;">
                    <h4 style="color: #1e88e5; margin-bottom: 10px; font-size: 16px;">GCash</h4>
                    <img src="${GCASH_QR_CODE_URL}" alt="GCash QR Code" style="max-width: 200px; height: auto; border: 2px solid #1e88e5; border-radius: 8px; padding: 10px; background: white;" />
                  </div>
                  ` : ''}
                </div>
                <p style="margin-top: 15px; color: #666; font-size: 14px;">Scan the QR code to make your payment</p>
              </div>
              ` : ''}

              <p>Please complete your payment to confirm your appointment. If you have any questions, please contact us.</p>
              
              <div class="footer">
                <p>Best regards,<br>Jhen</p>
                <p style="margin-top: 20px;">
                  <a href="mailto:${REPLY_TO_EMAIL}" style="color: #1e88e5;">${REPLY_TO_EMAIL}</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending invoice created email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending invoice created email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendAppointmentReminderEmail(booking: Booking, customer: Customer, slotDate: string, slotTime: string) {
  if (!process.env.RESEND_API_KEY || !customer.email) {
    return { success: false, error: 'Email not configured or customer email missing' };
  }

  try {
    const serviceType = booking.serviceType || 'Service';
    const serviceLocation = booking.serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio';
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      replyTo: REPLY_TO_EMAIL,
      subject: `Reminder: Your Appointment Tomorrow - ${formatDate(slotDate)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ab47bc 0%, #8e24aa 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .reminder-notice { background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ab47bc; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; font-size: 18px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Appointment Reminder</h1>
            </div>
            <div class="content">
              <p>Hi ${customer.name},</p>
              <p>This is a friendly reminder that you have an appointment with us <strong>tomorrow</strong>!</p>
              
              <div class="reminder-notice">
                <h2 style="margin-top: 0; color: #8e24aa;">📅 Don't Forget!</h2>
                <p style="font-size: 16px; margin: 10px 0;">We're looking forward to seeing you!</p>
              </div>

              <div class="booking-details">
                <h2 style="margin-top: 0; color: #8e24aa;">Appointment Details</h2>
                <div class="detail-row">
                  <span class="label">Booking ID:</span>
                  <span class="value">${booking.bookingId}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Date:</span>
                  <span class="value">${formatDate(slotDate)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Time:</span>
                  <span class="value">${formatTime12Hour(slotTime)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Service:</span>
                  <span class="value">${serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span class="value">${serviceLocation}</span>
                </div>
              </div>

              <p>If you need to reschedule or have any questions, please contact us as soon as possible.</p>
              
              <div class="footer">
                <p>Best regards,<br>Jhen</p>
                <p style="margin-top: 20px;">
                  <a href="mailto:${REPLY_TO_EMAIL}" style="color: #8e24aa;">${REPLY_TO_EMAIL}</a>
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending appointment reminder email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending appointment reminder email:', error);
    return { success: false, error: error.message };
  }
}

