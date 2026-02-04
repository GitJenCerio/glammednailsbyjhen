'use client';

import { useState, useEffect } from 'react';
import { IoCopyOutline, IoCalendarOutline, IoPersonOutline, IoSparklesOutline, IoLocationOutline, IoWarningOutline, IoImageOutline, IoCashOutline, IoPhonePortraitOutline, IoBusinessOutline, IoEyeOutline } from 'react-icons/io5';
import type { Booking } from '@/lib/types';

type BookingDetailPanelProps = {
  booking: Booking | null;
  slotLabel?: string;
  pairedSlotLabel?: string;
  nailTechName?: string;
  onConfirm: (bookingId: string, depositAmount?: number, depositPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') => Promise<void>;
  onCancel?: (bookingId: string) => Promise<void>;
  onReschedule?: (bookingId: string) => Promise<void>;
  onMakeQuotation?: (bookingId: string) => void;
  onView?: (booking: Booking) => void;
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

export function BookingDetailPanel({ booking, slotLabel, pairedSlotLabel, nailTechName, onConfirm, onCancel, onReschedule, onMakeQuotation, onView }: BookingDetailPanelProps) {
  const [showDepositInput, setShowDepositInput] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<'PNB' | 'CASH' | 'GCASH'>('CASH');
  const [isConfirming, setIsConfirming] = useState(false);
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [isLoadingFormUrl, setIsLoadingFormUrl] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Reset deposit input and confirming state when booking changes or status changes to confirmed
  useEffect(() => {
    if (booking?.status === 'confirmed' || !booking) {
      setShowDepositInput(false);
      setDepositAmount('');
      setDepositPaymentMethod('CASH');
      setIsConfirming(false);
      setFormUrl(null);
    }
  }, [booking]);

  // Load form URL when booking is pending_form or pending_payment
  useEffect(() => {
    const loadFormUrl = async () => {
      if (!booking || (booking.status !== 'pending_form' && booking.status !== 'pending_payment')) {
        setFormUrl(null);
        return;
      }

      setIsLoadingFormUrl(true);
      try {
        const response = await fetch(`/api/bookings/${booking.id}?action=formUrl`);
        if (response.ok) {
          const data = await response.json();
          setFormUrl(data.formUrl);
        } else {
          console.error('Failed to load form URL');
          setFormUrl(null);
        }
      } catch (error) {
        console.error('Error loading form URL:', error);
        setFormUrl(null);
      } finally {
        setIsLoadingFormUrl(false);
      }
    };

    loadFormUrl();
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
    
    // For both pending_payment and pending_form, show deposit input
    if (booking.status === 'pending_payment' || booking.status === 'pending_form') {
      setShowDepositInput(true);
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
      await onConfirm(booking.id, amount, paymentMethod);
      // Reset form fields after successful confirmation
      setDepositAmount('');
      setDepositPaymentMethod('CASH');
    } catch (error) {
      console.error('Failed to confirm booking:', error);
      // Reopen deposit input on error so user can retry
      if (booking.status === 'pending_payment' || booking.status === 'pending_form') {
        setShowDepositInput(true);
        setDepositAmount(amount?.toString() || '');
      }
      throw error; // Re-throw to let parent handle error display
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCopyFormLink = async () => {
    if (!formUrl) return;
    
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopySuccess(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Error copying form link:', error);
      alert('Failed to copy form link. Please try again.');
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
              <IoImageOutline className="w-4 h-4" />
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
                      <IoImageOutline className="w-4 h-4" />
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
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-3 sm:p-4 shadow-md shadow-slate-900/5">
      <header className="mb-2 sm:mb-3 space-y-1">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-0.5">Booking</p>
            <h2 className="text-base sm:text-lg md:text-xl font-semibold break-words leading-tight">{getCustomerName()}</h2>
            <p className="text-[10px] sm:text-xs text-slate-400 break-words mt-0.5">{booking.bookingId}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {booking.status && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold ${
                    booking.status === 'confirmed'
                      ? 'bg-emerald-500 text-white'
                      : booking.status === 'pending_payment'
                        ? 'bg-blue-500 text-white'
                        : booking.status === 'pending_form'
                          ? 'bg-amber-500 text-white'
                          : 'bg-red-500 text-white'
                  }`}
                >
                  {booking.status.replace('_', ' ').toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
          {slotLabel && (
            <div className="flex items-center gap-1.5">
              <IoCalendarOutline className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 break-words">{slotLabel}</span>
              {pairedSlotLabel && <span className="text-slate-500">→ {pairedSlotLabel}</span>}
            </div>
          )}
          {nailTechName && (
            <div className="flex items-center gap-1.5">
              <IoPersonOutline className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 break-words font-medium">{nailTechName}</span>
            </div>
          )}
          {booking.serviceType && (
            <div className="flex items-center gap-1.5">
              <IoSparklesOutline className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 break-words">{serviceLabels[booking.serviceType] ?? booking.serviceType}</span>
            </div>
          )}
          {booking.serviceLocation && (
            <div className="flex items-center gap-1.5">
              <IoLocationOutline className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 break-words">{booking.serviceLocation === 'home_service' ? 'Home Service (+₱1,000)' : 'Homebased Studio'}</span>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-2 sm:space-y-2.5">
        {(booking.dateChanged || booking.timeChanged || booking.validationWarnings) && (
          <div className="rounded-lg sm:rounded-xl border-2 border-amber-200 bg-amber-50 p-2 sm:p-3 text-[10px] sm:text-xs">
            <p className="font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
              <IoWarningOutline className="w-3.5 h-3.5" />
              <span>Warning: Date/Time Changed</span>
            </p>
            {booking.validationWarnings && booking.validationWarnings.length > 0 ? (
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
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

        {/* Form Link - Only visible for pending bookings without form response */}
        {(booking.status === 'pending_form' || booking.status === 'pending_payment') && !booking.formResponseId && (
          <div className="rounded-lg sm:rounded-xl border-2 border-blue-200 bg-blue-50 p-2 sm:p-3 text-[10px] sm:text-xs shadow-sm shadow-slate-900/5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="font-semibold text-blue-900">Form Link</p>
              {formUrl && (
                <button
                  type="button"
                  onClick={handleCopyFormLink}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold transition-all touch-manipulation active:scale-[0.98] ${
                    copySuccess
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
                  }`}
                  title="Copy link to clipboard"
                >
                  <IoCopyOutline className="w-3 h-3" />
                  <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                </button>
              )}
            </div>
            {isLoadingFormUrl ? (
              <p className="text-blue-700 text-[9px] sm:text-[10px]">Loading form link...</p>
            ) : formUrl ? (
              <div className="space-y-1">
                <a
                  href={formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-700 hover:text-blue-900 underline break-all font-medium text-[9px] sm:text-[10px]"
                >
                  {formUrl}
                </a>
                <p className="text-blue-600 text-[9px]">Click the link above to open the form, or use the Copy button to copy it.</p>
              </div>
            ) : (
              <p className="text-blue-700 text-[9px] sm:text-[10px]">Unable to load form link. Please refresh the page.</p>
            )}
          </div>
        )}

        {/* View Response Button - Only show if there are customer responses */}
        {entries.length > 0 && onView && (
          <div className="rounded-lg sm:rounded-xl border-2 border-blue-300 bg-blue-50 p-2 sm:p-3 text-[10px] sm:text-xs shadow-sm shadow-slate-900/5">
            <button
              type="button"
              onClick={() => onView(booking)}
              className="flex items-center gap-2 text-blue-700 hover:text-blue-900 transition-colors touch-manipulation font-semibold"
            >
              <IoEyeOutline className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="font-semibold text-[10px] sm:text-xs">View Response</span>
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
        {(booking.status === 'pending_payment' || booking.status === 'pending_form') && !showDepositInput && !isConfirming && (
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isConfirming}
            className="w-full rounded-full bg-emerald-600 px-3 py-2 text-[10px] sm:text-xs font-semibold text-white touch-manipulation active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming ? 'Confirming...' : 'Confirm booking'}
          </button>
        )}
        {(booking.status === 'pending_payment' || booking.status === 'pending_form') && showDepositInput && (
          <div className="rounded-lg sm:rounded-xl border-2 border-emerald-200 bg-emerald-50 p-2 sm:p-3 space-y-2">
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-emerald-900 mb-1">
                Deposit Amount (₱)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="500"
                className="w-full rounded-lg border-2 border-emerald-300 bg-white px-2 py-1.5 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[9px] sm:text-[10px] text-emerald-700 mt-0.5">Leave empty if no deposit received</p>
            </div>
            {depositAmount && Number(depositAmount) > 0 && (
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-emerald-900 mb-1">
                  Payment Method
                </label>
                <select
                  value={depositPaymentMethod}
                  onChange={(e) => setDepositPaymentMethod(e.target.value as 'PNB' | 'CASH' | 'GCASH')}
                  className="w-full rounded-lg border-2 border-emerald-300 bg-white px-2 py-1.5 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="GCASH">GCash</option>
                  <option value="PNB">PNB</option>
                </select>
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowDepositInput(false);
                  setDepositAmount('');
                  setDepositPaymentMethod('CASH');
                }}
                className="flex-1 rounded-full border-2 border-emerald-300 bg-white px-3 py-1.5 text-[10px] sm:text-xs font-semibold text-emerald-700 touch-manipulation active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWithDeposit}
                disabled={isConfirming}
                className="flex-1 rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] sm:text-xs font-semibold text-white touch-manipulation active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirming ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-1.5">
          {onMakeQuotation && (
            <button
              type="button"
              onClick={() => onMakeQuotation(booking.id)}
              className="flex-1 rounded-full bg-rose-600 px-3 py-2 text-[10px] sm:text-xs font-semibold text-white touch-manipulation active:scale-[0.98]"
            >
              Make Quotation
            </button>
          )}
          {onReschedule && booking.status !== 'confirmed' && (
            <button
              type="button"
              onClick={() => onReschedule(booking.id)}
              className="flex-1 rounded-full border-2 border-slate-300 bg-white px-3 py-2 text-[10px] sm:text-xs font-semibold text-slate-700 touch-manipulation active:scale-[0.98] hover:bg-slate-50"
            >
              Reschedule
            </button>
          )}
          {onCancel && booking.status !== 'confirmed' && (
            <button
              type="button"
              onClick={() => onCancel(booking.id)}
              className="flex-1 rounded-full border-2 border-red-300 bg-white px-3 py-2 text-[10px] sm:text-xs font-semibold text-red-700 touch-manipulation active:scale-[0.98] hover:bg-red-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

