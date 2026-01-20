 'use client';

import { useState, useEffect } from 'react';
import type { Booking, BookingStatus, Slot } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';

type BookingRow = Booking & { slot?: Slot; pairedSlot?: Slot; linkedSlots?: Slot[] };

type BookingListProps = {
  bookings: BookingRow[];
  onSelect: (booking: BookingRow) => void;
  selectedId: string | null;
  customers?: Array<{ id: string; name?: string }>;
};

const statusLabels: Record<BookingStatus, string> = {
  pending_form: 'Awaiting Form',
  pending_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 slots)',
  home_service_3slots: 'Home Service (3 slots)',
};

export function BookingList({ bookings, onSelect, selectedId, customers = [] }: BookingListProps) {
  const grouped = bookings.reduce<Record<BookingStatus, BookingRow[]>>(
    (acc, booking) => {
      // Safety check: ensure the status exists in the accumulator
      if (booking.status && acc[booking.status]) {
        acc[booking.status].push(booking);
      }
      return acc;
    },
    { pending_form: [], pending_payment: [], confirmed: [], cancelled: [] },
  );

  // Initialize sections: only open sections that have bookings (count > 0)
  const [openSections, setOpenSections] = useState<Record<BookingStatus, boolean>>(() => {
    return {
      pending_form: grouped.pending_form.length > 0,
      pending_payment: grouped.pending_payment.length > 0,
      confirmed: grouped.confirmed.length > 0,
      cancelled: grouped.cancelled.length > 0,
    };
  });

  // Update open sections when bookings change: auto-open sections that get bookings
  useEffect(() => {
    setOpenSections((prev) => {
      const updated = { ...prev };
      // Auto-open sections that now have bookings (if they were closed)
      if (grouped.pending_form.length > 0 && !prev.pending_form) {
        updated.pending_form = true;
      }
      if (grouped.pending_payment.length > 0 && !prev.pending_payment) {
        updated.pending_payment = true;
      }
      if (grouped.confirmed.length > 0 && !prev.confirmed) {
        updated.confirmed = true;
      }
      if (grouped.cancelled.length > 0 && !prev.cancelled) {
        updated.cancelled = true;
      }
      return updated;
    });
  }, [grouped.pending_form.length, grouped.pending_payment.length, grouped.confirmed.length, grouped.cancelled.length]);

  return (
    <>
      <header className="mb-3 sm:mb-4">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">Bookings</p>
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold">Status overview</h2>
      </header>

      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        {(Object.keys(grouped) as BookingStatus[]).map((status) => (
          <div key={status}>
            <button
              type="button"
              onClick={() =>
                setOpenSections((prev) => ({
                  ...prev,
                  [status]: !prev[status],
                }))
              }
              className="mb-2 flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-xs sm:text-sm hover:bg-slate-50"
            >
              <span className="font-semibold capitalize flex items-center gap-1">
                <span
                  className={`inline-block transition-transform ${
                    openSections[status] ? 'rotate-90' : ''
                  }`}
                >
                  ▶
                </span>
                {statusLabels[status]}
              </span>
              <span className="text-slate-500">{grouped[status].length} bookings</span>
            </button>

            {openSections[status] && (
              <div className="space-y-2">
              {grouped[status].length === 0 && (
                <div className="rounded-xl sm:rounded-2xl border border-dashed border-slate-200 p-3 sm:p-4 text-xs sm:text-sm text-slate-500">No bookings.</div>
              )}
              {grouped[status].map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onSelect(booking)}
                  className={[
                    'w-full rounded-xl sm:rounded-2xl border-2 bg-white px-3 sm:px-4 py-3 sm:py-4 text-left transition-all duration-200 touch-manipulation',
                    selectedId === booking.id
                      ? 'border-slate-900 shadow-xl shadow-slate-900/20 ring-2 ring-slate-900/10 bg-slate-50'
                      : 'border-slate-300 shadow-md hover:border-slate-400 hover:shadow-lg hover:shadow-slate-300/50 active:scale-[0.98]',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate">
                        {(() => {
                          // Priority 1: Get customer name from form data (for bookings with submitted forms)
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
                          }
                          
                          // Priority 2: Try to get name from customer record if customerId exists
                          if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
                            const customer = customers.find(c => c.id === booking.customerId);
                            if (customer?.name) {
                              return customer.name;
                            }
                          }
                          
                          // Priority 3: For pending_form bookings, check clientType
                          if (booking.status === 'pending_form') {
                            // If it's a repeat client and we have customerId, try to show name
                            if (booking.clientType === 'repeat') {
                              if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
                                // Try to find customer name from customers list
                                const customer = customers.find(c => c.id === booking.customerId);
                                if (customer?.name) {
                                  return customer.name;
                                }
                              }
                              return 'Repeat Client';
                            } else if (booking.clientType === 'new') {
                              return 'New Client';
                            } else {
                              // clientType not set - check if customerId exists to determine
                              if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
                                const customer = customers.find(c => c.id === booking.customerId);
                                if (customer?.name) {
                                  return customer.name;
                                }
                                return 'Repeat Client'; // Has customerId but no clientType set
                              }
                              return 'New Client'; // Default for pending_form without customerId
                            }
                          }
                          
                          // Last resort: return bookingId
                          return booking.bookingId;
                        })()}
                      </p>
                      <p className="text-[10px] sm:text-xs text-slate-400 truncate">{booking.bookingId}</p>
                      {booking.slot && (
                        <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                          {booking.slot.date} · {formatTime12Hour(booking.slot.time)}
                        </p>
                      )}
                      {booking.serviceType && (
                        <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                          {serviceLabels[booking.serviceType] ?? booking.serviceType}
                          {booking.slot && (
                            <>
                              {' '}
                              ({formatTime12Hour(booking.slot.time)}
                              {(() => {
                                const endSlot =
                                  booking.linkedSlots && booking.linkedSlots.length > 0
                                    ? booking.linkedSlots[booking.linkedSlots.length - 1]
                                    : booking.pairedSlot;
                                return endSlot ? ` - ${formatTime12Hour(endSlot.time)}` : '';
                              })()}
                              )
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500 flex-shrink-0">{booking.status}</span>
                  </div>
                </button>
              ))}
            </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

