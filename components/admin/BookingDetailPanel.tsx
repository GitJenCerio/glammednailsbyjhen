'use client';

import { useState, useEffect } from 'react';
import type { Booking } from '@/lib/types';

type BookingDetailPanelProps = {
  booking: Booking | null;
  slotLabel?: string;
  pairedSlotLabel?: string;
  onConfirm: (bookingId: string, depositAmount?: number, withAssistantCommission?: boolean, depositPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') => Promise<void>;
  onCancel?: (bookingId: string) => Promise<void>;
  onReschedule?: (bookingId: string) => Promise<void>;
  onMakeQuotation?: (bookingId: string) => void;
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

export function BookingDetailPanel({ booking, slotLabel, pairedSlotLabel, onConfirm, onCancel, onReschedule, onMakeQuotation }: BookingDetailPanelProps) {
  const [showDepositInput, setShowDepositInput] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<'PNB' | 'CASH' | 'GCASH'>('CASH');
  const [withAssistantCommission, setWithAssistantCommission] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset deposit input and confirming state when booking changes or status changes to confirmed
  useEffect(() => {
    if (booking?.status === 'confirmed' || !booking) {
      setShowDepositInput(false);
      setDepositAmount('');
      setDepositPaymentMethod('CASH');
      setIsConfirming(false);
    }
  }, [booking]);

  if (!booking) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md shadow-slate-900/5">
        <p className="text-xs sm:text-sm text-slate-500">Select a booking to see details.</p>
      </div>
    );
  }

  // Use the stored field order if available, otherwise fall back to object entries
  // This ensures fields appear in the exact order as they appear in the Google Form
  const customerData = booking.customerData ?? {};
  const fieldOrder = booking.customerDataOrder;
  
  let entries: [string, string][];
  if (fieldOrder && fieldOrder.length > 0) {
    // Use the stored order to display fields in the exact form order
    entries = fieldOrder
      .filter((key) => key in customerData) // Only include keys that exist in customerData
      .map((key) => [key, customerData[key]] as [string, string]);
  } else {
    // Fallback to object entries if no order is stored (for backwards compatibility)
    entries = Object.entries(customerData);
  }

  const handleConfirmClick = async () => {
    // Prevent confirming already confirmed bookings
    if (booking.status === 'confirmed' || isConfirming) {
      return;
    }
    
    if (booking.status === 'pending_payment') {
      setShowDepositInput(true);
    } else if (booking.status === 'pending_form') {
      // For pending_form bookings, confirm without deposit
      setIsConfirming(true);
      try {
        await onConfirm(booking.id, undefined, withAssistantCommission, undefined);
      } finally {
        setIsConfirming(false);
      }
    }
  };

  const handleConfirmWithDeposit = async () => {
    // Prevent confirming already confirmed bookings or if already confirming
    if (booking.status === 'confirmed' || isConfirming) {
      setShowDepositInput(false);
      setDepositAmount('');
      setDepositPaymentMethod('CASH');
      return;
    }
    
    const amount = depositAmount ? Number(depositAmount) : undefined;
    const paymentMethod = amount && amount > 0 ? depositPaymentMethod : undefined;
    
    // Set confirming state and close the deposit input immediately to prevent multiple clicks
    setIsConfirming(true);
    setShowDepositInput(false);
    
    try {
      await onConfirm(booking.id, amount, withAssistantCommission, paymentMethod);
      // Reset form fields after successful confirmation
      setDepositAmount('');
      setDepositPaymentMethod('CASH');
    } catch (error) {
      console.error('Failed to confirm booking:', error);
      // Reopen deposit input on error so user can retry
      if (booking.status === 'pending_payment') {
        setShowDepositInput(true);
        setDepositAmount(amount?.toString() || '');
      }
      throw error; // Re-throw to let parent handle error display
    } finally {
      setIsConfirming(false);
    }
  };
  
  // Get customer name (Name + Surname)
  const getCustomerName = () => {
    if (!booking.customerData || Object.keys(booking.customerData).length === 0) {
      // Try customer record if available
      return booking.bookingId;
    }
    
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

    // Try to find last name/surname first (including the exact Google Form field name with autofill text)
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
    
    // If we found only first name or only last name, use it
    if (firstName) return firstName;
    if (lastName) return lastName;
    
    // Last resort: look for any field that might be a name (not email, phone, etc.)
    for (const [key, value] of Object.entries(booking.customerData)) {
      const lowerKey = key.toLowerCase();
      // Skip non-name fields
      if (lowerKey.includes('email') || lowerKey.includes('phone') || lowerKey.includes('contact') || 
          lowerKey.includes('booking') || lowerKey.includes('date') || lowerKey.includes('time') ||
          lowerKey.includes('service') || lowerKey.includes('location') || lowerKey.includes('referral')) {
        continue;
      }
      // If it's a reasonable length and looks like a name, use it
      const strValue = String(value).trim();
      if (strValue.length > 0 && strValue.length < 100) {
        return strValue;
      }
    }
    
    return booking.bookingId;
  };

  // Check if a value is a URL (including image URLs)
  const isUrl = (value: string): boolean => {
    if (!value || typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      // Check if it looks like a URL even without protocol
      return /^(https?:\/\/|www\.)/i.test(value.trim());
    }
  };

  // Check if a URL is an image
  const isImageUrl = (url: string): boolean => {
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i;
    return imageExtensions.test(url) || /drive\.google\.com|dropbox\.com|imgur\.com/i.test(url);
  };

  // Render value - make URLs clickable
  const renderValue = (value: string) => {
    if (!value) return value;
    
    // Check if the entire value is a URL
    if (isUrl(value)) {
      const url = value.startsWith('http') ? value : `https://${value}`;
      const isImage = isImageUrl(url);
      
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
        >
          {isImage ? (
            <span className="flex items-center gap-1">
              <span>🖼️</span>
              <span>View Image</span>
            </span>
          ) : (
            value
          )}
        </a>
      );
    }
    
    // Check if value contains URLs (for cases where there's text + URL)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const parts = value.split(urlRegex);
    
    if (parts.length > 1) {
      return (
        <>
          {parts.map((part, index) => {
            if (isUrl(part)) {
              const url = part.startsWith('http') ? part : `https://${part}`;
              const isImage = isImageUrl(url);
              return (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                >
                  {isImage ? (
                    <span className="flex items-center gap-1">
                      <span>🖼️</span>
                      <span>View Image</span>
                    </span>
                  ) : (
                    part
                  )}
                </a>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </>
      );
    }
    
    return value;
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md shadow-slate-900/5">
      <header className="mb-3 sm:mb-4">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">Booking</p>
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold break-words">{getCustomerName()}</h2>
        <p className="text-xs sm:text-sm text-slate-400 break-words">{booking.bookingId}</p>
        {slotLabel && <p className="text-xs sm:text-sm text-slate-500 break-words">{slotLabel}</p>}
        {pairedSlotLabel && <p className="text-xs sm:text-sm text-slate-500 break-words">+ {pairedSlotLabel}</p>}
        {booking.serviceType && (
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">
            {serviceLabels[booking.serviceType] ?? booking.serviceType}
          </p>
        )}
        {booking.serviceLocation && (
          <p className="text-xs sm:text-sm text-slate-600 break-words">
            📍 {booking.serviceLocation === 'home_service' ? 'Home Service (+₱1,000)' : 'Homebased Studio'}
          </p>
        )}
      </header>

      <div className="space-y-2.5 sm:space-y-3">
        {(booking.dateChanged || booking.timeChanged || booking.validationWarnings) && (
          <div className="rounded-xl sm:rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 sm:p-4 text-xs sm:text-sm">
            <p className="font-semibold text-amber-900 mb-1.5 sm:mb-2">⚠️ Warning: Date/Time Changed</p>
            {booking.validationWarnings && booking.validationWarnings.length > 0 ? (
              <ul className="list-disc list-inside space-y-0.5 sm:space-y-1 text-amber-800">
                {booking.validationWarnings.map((warning, index) => (
                  <li key={index} className="break-words">{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="text-amber-800 break-words">
                {booking.dateChanged && 'Date was changed from the original booking.'}
                {booking.timeChanged && 'Time was changed from the original booking.'}
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-xs sm:text-sm shadow-sm shadow-slate-900/5 space-y-2">
          <div>
            <p className="font-semibold">Status</p>
            <p className="capitalize text-slate-600">{booking.status.replace('_', ' ')}</p>
          </div>

          {/* Only show the \"Include 10% commission\" toggle before confirmation */}
          {booking.status !== 'confirmed' && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={withAssistantCommission}
                  onChange={(e) => setWithAssistantCommission(e.target.checked)}
                  className="h-3 w-3 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Include 10% commission for sister</span>
              </label>
            </div>
          )}
        </div>

        {/* In Calendar & Slots tab, hide the full form responses once booking is confirmed.
            Admins can still view the complete form in the View Bookings tab via the eye icon. */}
        {booking.status !== 'confirmed' && (
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-xs sm:text-sm shadow-sm shadow-slate-900/5">
            <p className="font-semibold mb-1.5 sm:mb-2">Customer responses</p>
            {entries.length === 0 && <p className="text-slate-500">Waiting for form submission.</p>}
            {entries.length > 0 && (
              <dl className="space-y-1.5 sm:space-y-2">
                {entries.map(([key, value]) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-3">
                    <dt className="text-slate-500 break-words">{key}</dt>
                    <dd className="font-medium break-words sm:text-right">{renderValue(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 sm:mt-6 space-y-2">
        {booking.status === 'pending_payment' && !showDepositInput && !isConfirming && (
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isConfirming}
            className="w-full rounded-full bg-emerald-600 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white touch-manipulation active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming ? 'Confirming...' : 'Confirm booking'}
          </button>
        )}
        {booking.status === 'pending_form' && !isConfirming && (
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isConfirming}
            className="w-full rounded-full bg-emerald-600 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white touch-manipulation active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming ? 'Confirming...' : 'Confirm booking'}
          </button>
        )}
        {booking.status === 'pending_payment' && showDepositInput && (
          <div className="rounded-xl sm:rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-3 sm:p-4 space-y-3">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-emerald-900 mb-2">
                Deposit Amount (₱)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="500"
                className="w-full rounded-xl border-2 border-emerald-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-emerald-700 mt-1">Leave empty if no deposit received</p>
            </div>
            {depositAmount && Number(depositAmount) > 0 && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-emerald-900 mb-2">
                  Payment Method
                </label>
                <select
                  value={depositPaymentMethod}
                  onChange={(e) => setDepositPaymentMethod(e.target.value as 'PNB' | 'CASH' | 'GCASH')}
                  className="w-full rounded-xl border-2 border-emerald-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="GCASH">📱 GCash</option>
                  <option value="PNB">🏦 PNB</option>
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDepositInput(false);
                  setDepositAmount('');
                  setDepositPaymentMethod('CASH');
                }}
                className="flex-1 rounded-full border-2 border-emerald-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-emerald-700 touch-manipulation active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWithDeposit}
                disabled={isConfirming}
                className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white touch-manipulation active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirming ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-2">
          {onMakeQuotation && (
            <button
              type="button"
              onClick={() => onMakeQuotation(booking.id)}
              className="flex-1 rounded-full bg-rose-600 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white touch-manipulation active:scale-[0.98]"
            >
              Make Quotation
            </button>
          )}
          {onReschedule && booking.status !== 'confirmed' && (
            <button
              type="button"
              onClick={() => onReschedule(booking.id)}
              className="flex-1 rounded-full border-2 border-slate-300 bg-white px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-slate-700 touch-manipulation active:scale-[0.98] hover:bg-slate-50"
            >
              Reschedule
            </button>
          )}
          {onCancel && booking.status !== 'confirmed' && (
            <button
              type="button"
              onClick={() => onCancel(booking.id)}
              className="flex-1 rounded-full border-2 border-red-300 bg-white px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-red-700 touch-manipulation active:scale-[0.98] hover:bg-red-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

