'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { IoClose, IoCalendarOutline, IoPersonOutline, IoSparklesOutline, IoWarningOutline } from 'react-icons/io5';
import type { Booking, Slot, Customer } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';

type CancelBookingModalProps = {
  open: boolean;
  booking: Booking | null;
  slot: Slot | null;
  customer: Customer | null;
  customers?: Customer[]; // Add customers array for better name lookup
  onClose: () => void;
  onConfirm: (releaseSlot: boolean) => Promise<void>;
  isCancelling?: boolean;
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

export function CancelBookingModal({ 
  open, 
  booking, 
  slot, 
  customer, 
  customers = [],
  onClose, 
  onConfirm, 
  isCancelling = false 
}: CancelBookingModalProps) {
  const [releaseSlot, setReleaseSlot] = useState(true); // Default to releasing slot

  // Reset checkbox when modal opens
  useEffect(() => {
    if (open) {
      setReleaseSlot(true);
    }
  }, [open]);

  if (!open || !booking || !slot) return null;

  const getCustomerName = () => {
    // 1) Always prefer the name the client typed in the form (per booking)
    if (booking.customerData && Object.keys(booking.customerData).length > 0) {
      // Helper function to find field by fuzzy matching key names
      const findField = (keywords: string[]): string | null => {
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        for (const [key, value] of Object.entries(booking.customerData!)) {
          const lowerKey = key.toLowerCase();
          // Check if key matches any keyword (partial match or exact match)
          if (lowerKeywords.some(kw => lowerKey.includes(kw) || lowerKey === kw) && value && String(value).trim()) {
            return String(value).trim();
          }
        }
        return null;
      };

      // Try to find full name field first (various formats)
      const fullName = findField(['full name', 'fullname']);
      if (fullName) return fullName;

      // Helper function to find first name (excluding surname/last name fields and social media names)
      const findFirstName = (): string | null => {
        const keywords = ['first name', 'firstname', 'fname', 'given name'];
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        for (const [key, value] of Object.entries(booking.customerData!)) {
          const lowerKey = key.toLowerCase();
          // Check for explicit first name keywords
          if (lowerKeywords.some(kw => lowerKey.includes(kw) || lowerKey === kw) && value && String(value).trim()) {
            return String(value).trim();
          }
        }
        // Now try "name" but EXCLUDE social media names, surname, last name, etc.
        for (const [key, value] of Object.entries(booking.customerData!)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('name') && 
              !lowerKey.includes('surname') && 
              !lowerKey.includes('last name') && 
              !lowerKey.includes('lastname') &&
              !lowerKey.includes('full name') && 
              !lowerKey.includes('fullname') &&
              !lowerKey.includes('instagram') &&
              !lowerKey.includes('facebook') &&
              !lowerKey.includes('social') &&
              !lowerKey.includes('inquire') &&
              value && String(value).trim()) {
            return String(value).trim();
          }
        }
        return null;
      };

      // Try to find last name/surname first
      const lastName = findField(['surname', 'last name', 'lastname', 'lname', 'family name']);
      
      // Try to find first name (excluding surname fields)
      const firstName = findFirstName();
      
      // If we found both, combine them
      if (firstName && lastName) {
        return `${firstName} ${lastName}`.trim();
      }
      
      // If we found only first name or only last name, use it
      if (firstName) return firstName;
      if (lastName) return lastName;
      
      // Last resort: look for any field that might be a name (not email, phone, social media, etc.)
      for (const [key, value] of Object.entries(booking.customerData)) {
        const lowerKey = key.toLowerCase();
        // Skip non-name fields including social media names
        if (lowerKey.includes('email') || lowerKey.includes('phone') || lowerKey.includes('contact') || 
            lowerKey.includes('booking') || lowerKey.includes('date') || lowerKey.includes('time') ||
            lowerKey.includes('service') || lowerKey.includes('location') || lowerKey.includes('referral') ||
            lowerKey.includes('instagram') || lowerKey.includes('facebook') || lowerKey.includes('social') ||
            lowerKey.includes('inquire') || lowerKey.includes('surname') || lowerKey.includes('last name')) {
          continue;
        }
        // If it's a reasonable length and looks like a name, use it
        const strValue = String(value).trim();
        if (strValue.length > 0 && strValue.length < 100) {
          return strValue;
        }
      }
    }

    // 2) If no form data, fall back to Customer record (shared by email/phone)
    if (customer?.name) return customer.name;
    if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
      const foundCustomer = customers.find((c) => c.id === booking.customerId);
      if (foundCustomer?.name) return foundCustomer.name;
    }

    // 3) Last fallback: bookingId
    return booking.bookingId;
  };

  const customerName = getCustomerName();
  const serviceType = booking.serviceType ? serviceLabels[booking.serviceType] || booking.serviceType : 'N/A';
  const hasDeposit = (booking.depositAmount || 0) > 0;
  const hasPayment = (booking.paidAmount || 0) > 0;
  const hasQuote = booking.invoice && booking.invoice.total > 0;
  const quoteTotal = booking.invoice?.total || 0;

  const handleConfirm = async () => {
    try {
      await onConfirm(releaseSlot);
    } catch (error) {
      // Error handling is done in parent component
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm rounded-xl sm:rounded-2xl bg-white p-4 sm:p-5 shadow-xl border-2 border-slate-300">
        {/* Header */}
        <div className="flex items-start justify-between gap-2.5 sm:gap-3 mb-4">
          <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-rose-100 flex items-center justify-center border border-rose-200">
                <IoWarningOutline className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                Cancel Booking
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-600 leading-relaxed">
                This will mark the booking as cancelled.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors touch-manipulation"
            aria-label="Close"
          >
            <IoClose className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700" />
          </button>
        </div>

        {/* Booking Details */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 space-y-2 border border-slate-300">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
            <IoPersonOutline className="w-3 h-3 text-purple-500 flex-shrink-0" />
            <span className="text-slate-600 font-medium">Customer:</span>
            <span className="font-semibold text-slate-900 truncate">{customerName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
            <span className="text-slate-600 font-medium">ID:</span>
            <span className="font-mono text-slate-900 font-semibold text-[9px] sm:text-[10px]">{booking.bookingId}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
            <IoCalendarOutline className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            <span className="text-slate-600 font-medium">Date:</span>
            <span className="font-semibold text-slate-900">
              {format(parseISO(slot.date), 'MMM d')} · {formatTime12Hour(slot.time)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
            <IoSparklesOutline className="w-3 h-3 text-pink-500 flex-shrink-0" />
            <span className="text-slate-600 font-medium">Service:</span>
            <span className="font-semibold text-slate-900">{serviceType}</span>
          </div>
          {hasQuote && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs pt-1.5 border-t border-slate-300">
              <span className="text-slate-600 font-medium">Quote:</span>
              <span className="font-semibold text-blue-600">₱{quoteTotal.toLocaleString('en-PH')}</span>
            </div>
          )}
          {hasDeposit && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
              <span className="text-slate-600 font-medium">Deposit:</span>
              <span className="font-semibold text-amber-600">₱{booking.depositAmount?.toLocaleString('en-PH') || '0'}</span>
            </div>
          )}
        </div>

        {/* Warnings */}
        <div className="space-y-2 mb-4">
          {hasQuote && (
            <div className="flex items-start gap-1.5 p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <IoWarningOutline className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-blue-900 mb-0.5">Quote Will Be Removed</p>
                <p className="text-[9px] sm:text-[10px] text-blue-700">
                  Quote (₱{quoteTotal.toLocaleString('en-PH')}) will be removed.
                  {hasDeposit && ` Deposit (₱${booking.depositAmount?.toLocaleString('en-PH') || '0'}) forfeited.`}
                </p>
              </div>
            </div>
          )}
          {hasDeposit && !hasQuote && (
            <div className="flex items-start gap-1.5 p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <IoWarningOutline className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-amber-900 mb-0.5">Deposit Forfeited</p>
                <p className="text-[9px] sm:text-[10px] text-amber-700">
                  Deposit (₱{booking.depositAmount?.toLocaleString('en-PH') || '0'}) will be forfeited.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Release Slot Option */}
        <div className="mb-4 p-2.5 sm:p-3 bg-slate-50 border border-slate-300 rounded-lg">
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={releaseSlot}
              onChange={(e) => setReleaseSlot(e.target.checked)}
              className="mt-0.5 w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-900 border-slate-400 rounded focus:ring-slate-900 focus:ring-2 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-900 mb-0.5">
                Release Slot{booking.linkedSlotIds && booking.linkedSlotIds.length > 0 ? 's' : ''}
              </p>
              <p className="text-[9px] sm:text-[10px] text-slate-600">
                {releaseSlot 
                  ? 'Slot(s) will be released and available for other bookings.'
                  : 'Slot(s) will remain blocked. You can manually release them later.'}
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="w-full sm:w-auto rounded-lg sm:rounded-full border border-slate-300 px-4 sm:px-5 py-2 text-[10px] sm:text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            Keep Booking
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isCancelling}
            className="w-full sm:w-auto rounded-lg sm:rounded-full bg-slate-900 px-4 sm:px-5 py-2 text-[10px] sm:text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation flex items-center justify-center gap-1.5 shadow-sm"
          >
            {isCancelling ? (
              <>
                <svg className="animate-spin h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cancelling...</span>
              </>
            ) : (
              'Cancel Booking'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
