 'use client';

import { useState } from 'react';
import type { Booking, BookingStatus, Slot } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';

type BookingRow = Booking & { slot?: Slot; pairedSlot?: Slot; linkedSlots?: Slot[] };

type BookingListProps = {
  bookings: BookingRow[];
  onSelect: (booking: BookingRow) => void;
  selectedId: string | null;
};

const statusLabels: Record<BookingStatus, string> = {
  pending_form: 'Awaiting Form',
  pending_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 slots)',
  home_service_3slots: 'Home Service (3 slots)',
};

export function BookingList({ bookings, onSelect, selectedId }: BookingListProps) {
  const [openSections, setOpenSections] = useState<Record<BookingStatus, boolean>>({
    pending_form: true,
    pending_payment: true,
    confirmed: true,
  });

  const grouped = bookings.reduce<Record<BookingStatus, BookingRow[]>>(
    (acc, booking) => {
      // Safety check: ensure the status exists in the accumulator
      if (booking.status && acc[booking.status]) {
        acc[booking.status].push(booking);
      }
      return acc;
    },
    { pending_form: [], pending_payment: [], confirmed: [] },
  );

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md shadow-slate-900/5">
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
                    'w-full rounded-xl sm:rounded-2xl border bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-all duration-200 touch-manipulation',
                    selectedId === booking.id
                      ? 'border-slate-900 shadow-lg shadow-slate-900/10 ring-2 ring-slate-900/5'
                      : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5 active:scale-[0.98]',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate">
                        {(() => {
                          // Get customer name from form data
                          if (booking.customerData) {
                            const name = booking.customerData['Name'] || booking.customerData['name'] || booking.customerData['Full Name'] || booking.customerData['fullName'] || '';
                            const surname = booking.customerData['Surname'] || booking.customerData['surname'] || booking.customerData['Last Name'] || booking.customerData['lastName'] || '';
                            if (name || surname) {
                              return `${name}${name && surname ? ' ' : ''}${surname}`.trim() || booking.bookingId;
                            }
                          }
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
    </div>
  );
}

