'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import type { Booking, Slot, BookingWithSlot } from '@/lib/types';

type FilterPeriod = 'day' | 'week' | 'month' | 'all';

interface BookingsViewProps {
  bookings: Booking[];
  slots: Slot[];
  selectedDate: string;
  onCancel?: (bookingId: string) => void;
  onReschedule?: (bookingId: string) => void;
  onMakeQuotation?: (bookingId: string) => void;
  onConfirm?: (bookingId: string) => void;
  onUpdatePayment?: (bookingId: string, paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded', paidAmount?: number, tipAmount?: number) => void;
}

const statusLabels: Record<string, string> = {
  pending_form: 'Awaiting Form',
  pending_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
};

const statusColors: Record<string, string> = {
  pending_form: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  pending_payment: 'bg-orange-100 text-orange-800 border-orange-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

export function BookingsView({ bookings, slots, selectedDate, onCancel, onReschedule, onMakeQuotation, onConfirm, onUpdatePayment }: BookingsViewProps) {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod | 'all'>('all');
  const [clientTypeMap, setClientTypeMap] = useState<Record<string, 'repeat' | 'new'>>({});
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Combine bookings with slots
  const bookingsWithSlots = useMemo<BookingWithSlot[]>(() => {
    const list: BookingWithSlot[] = [];
    bookings.forEach((booking) => {
      const slot = slots.find((candidate) => candidate.id === booking.slotId);
      if (!slot) return;
      const linkedSlots = (booking.linkedSlotIds ?? [])
        .map((linkedId) => slots.find((candidate) => candidate.id === linkedId))
        .filter((value): value is Slot => Boolean(value));
      const pairedSlot = linkedSlots[0];
      list.push({ ...booking, slot, pairedSlot, linkedSlots });
    });
    return list;
  }, [bookings, slots]);

  // Determine client type (repeat vs new) - prioritize booking record, then form data, then booking history
  useMemo(() => {
    const typeMap: Record<string, 'repeat' | 'new'> = {};
    const customerBookings: Record<string, BookingWithSlot[]> = {};

    bookingsWithSlots.forEach((booking) => {
      // First priority: Check if client type is stored in the booking record (from modal selection)
      if (booking.clientType) {
        typeMap[booking.id] = booking.clientType;
        return; // Skip other checks if booking record has it
      }

      // Second priority: Check if client type is specified in the form data
      if (booking.customerData) {
        const formClientType = getClientTypeFromForm(booking.customerData);
        if (formClientType) {
          typeMap[booking.id] = formClientType;
          return; // Skip booking history check if form data has it
        }

        // If not found in booking record or form, prepare for booking history check
        if (!typeMap[booking.id]) {
          // Try to find a unique identifier - phone is most reliable
          const phone = booking.customerData['Phone'] || booking.customerData['phone'] || booking.customerData['Contact Number'] || booking.customerData['contact'];
          const name = booking.customerData['Name'] || booking.customerData['name'] || booking.customerData['Full Name'] || booking.customerData['fullName'];
          const identifier = phone || name || booking.bookingId;

          if (!customerBookings[identifier]) {
            customerBookings[identifier] = [];
          }
          customerBookings[identifier].push(booking);
        }
      } else {
        // No customer data, use booking ID as identifier for history check
        if (!customerBookings[booking.bookingId]) {
          customerBookings[booking.bookingId] = [];
        }
        customerBookings[booking.bookingId].push(booking);
      }
    });

    // For bookings without form-specified client type, determine from booking history
    Object.keys(customerBookings).forEach((identifier) => {
      const customerBookingList = customerBookings[identifier];
      // Sort by creation date
      customerBookingList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      customerBookingList.forEach((booking, index) => {
        // Only set if not already set from form data
        if (!typeMap[booking.id]) {
          // If this is not the first booking for this customer, they're a repeat client
          typeMap[booking.id] = index === 0 ? 'new' : 'repeat';
        }
      });
    });

    setClientTypeMap(typeMap);
  }, [bookingsWithSlots]);

  // Filter bookings by period
  const filteredBookings = useMemo(() => {
    // If filter is 'all', show all bookings without date filtering
    if (filterPeriod === 'all') {
      return bookingsWithSlots.filter((booking) => {
        return booking.slot !== undefined; // Only filter out bookings without slots
      }).sort((a, b) => {
        // Sort by date and time (most recent first)
        if (!a.slot || !b.slot) return 0;
        const dateCompare = b.slot.date.localeCompare(a.slot.date); // Reverse for newest first
        if (dateCompare !== 0) return dateCompare;
        return b.slot.time.localeCompare(a.slot.time); // Reverse for newest first
      });
    }

    // Otherwise, filter by the selected period
    const baseDate = parseISO(selectedDate);
    let start: Date;
    let end: Date;

    switch (filterPeriod) {
      case 'day':
        start = startOfDay(baseDate);
        end = endOfDay(baseDate);
        break;
      case 'week':
        start = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday
        end = endOfWeek(baseDate, { weekStartsOn: 1 });
        break;
      case 'month':
        start = startOfMonth(baseDate);
        end = endOfMonth(baseDate);
        break;
      default:
        // Should not reach here, but handle gracefully
        return bookingsWithSlots.filter((booking) => booking.slot !== undefined);
    }

    return bookingsWithSlots.filter((booking) => {
      if (!booking.slot) return false;
      const bookingDate = parseISO(booking.slot.date);
      return isWithinInterval(bookingDate, { start, end });
    }).sort((a, b) => {
      // Sort by date and time
      if (!a.slot || !b.slot) return 0;
      const dateCompare = a.slot.date.localeCompare(b.slot.date);
      if (dateCompare !== 0) return dateCompare;
      return a.slot.time.localeCompare(b.slot.time);
    });
  }, [bookingsWithSlots, selectedDate, filterPeriod]);

  const getCustomerName = (booking: BookingWithSlot): string => {
    if (!booking.customerData) return booking.bookingId;
    const name = booking.customerData['Name'] || booking.customerData['name'] || booking.customerData['Full Name'] || booking.customerData['fullName'] || '';
    const surname = booking.customerData['Surname'] || booking.customerData['surname'] || booking.customerData['Last Name'] || booking.customerData['lastName'] || '';
    if (name || surname) {
      return `${name}${name && surname ? ' ' : ''}${surname}`.trim() || booking.bookingId;
    }
    return booking.bookingId;
  };

  const getCustomerPhone = (booking: BookingWithSlot): string => {
    if (!booking.customerData) return 'N/A';
    return booking.customerData['Phone'] || 
           booking.customerData['phone'] || 
           booking.customerData['Contact Number'] || 
           booking.customerData['contact'] || 
           'N/A';
  };

  const getClientTypeFromForm = (customerData: Record<string, string> | undefined): 'repeat' | 'new' | null => {
    if (!customerData) return null;

    // Check for client type in form data (various possible field names)
    const clientTypeField = 
      customerData['Client Type'] ||
      customerData['client type'] ||
      customerData['ClientType'] ||
      customerData['clientType'] ||
      customerData['Are you a new or returning client?'] ||
      customerData['New or Returning Client'] ||
      customerData['Customer Type'] ||
      customerData['customer type'] ||
      customerData['Type'] ||
      customerData['type'];

    if (clientTypeField) {
      // Normalize the value to 'repeat' or 'new'
      const normalizedValue = String(clientTypeField).toLowerCase().trim();
      if (normalizedValue.includes('repeat') || normalizedValue.includes('returning') || normalizedValue.includes('existing')) {
        return 'repeat';
      } else if (normalizedValue.includes('new') || normalizedValue.includes('first')) {
        return 'new';
      }
    }

    return null;
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId) {
        // Check both mobile and desktop dropdown refs
        const allRefs = Object.values(dropdownRefs.current);
        const clickedOutside = allRefs.every(
          (ref) => ref && !ref.contains(event.target as Node)
        );
        if (clickedOutside) {
          setOpenDropdownId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  const getTimeRange = (booking: BookingWithSlot): string => {
    if (!booking.slot) return 'N/A';
    if (booking.linkedSlots && booking.linkedSlots.length > 0) {
      const lastSlot = booking.linkedSlots[booking.linkedSlots.length - 1];
      return `${formatTime(booking.slot.time)} - ${formatTime(lastSlot.time)}`;
    }
    if (booking.pairedSlot) {
      return `${formatTime(booking.slot.time)} - ${formatTime(booking.pairedSlot.time)}`;
    }
    return formatTime(booking.slot.time);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-1 w-full sm:w-auto">
          <button
            onClick={() => setFilterPeriod('all')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition touch-manipulation ${
              filterPeriod === 'all'
                ? 'bg-black text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterPeriod('day')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition touch-manipulation ${
              filterPeriod === 'day'
                ? 'bg-black text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => setFilterPeriod('week')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition touch-manipulation ${
              filterPeriod === 'week'
                ? 'bg-black text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setFilterPeriod('month')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition touch-manipulation ${
              filterPeriod === 'month'
                ? 'bg-black text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Month
          </button>
        </div>
        <div className="text-xs sm:text-sm text-slate-600">
          {filterPeriod === 'all' 
            ? `Showing all ${filteredBookings.length} booking${filteredBookings.length !== 1 ? 's' : ''}`
            : `Showing ${filteredBookings.length} booking${filteredBookings.length !== 1 ? 's' : ''}`
          }
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs sm:text-sm text-slate-500">
            {filterPeriod === 'all' 
              ? 'No bookings found.'
              : `No bookings found for the selected ${filterPeriod}.`
            }
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const clientType = booking.clientType || clientTypeMap[booking.id];
            return (
              <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{booking.bookingId}</span>
                      {(booking.dateChanged || booking.timeChanged) && (
                        <span className="text-xs" title={booking.validationWarnings?.join('; ') || 'Date or time was changed'}>
                          ⚠️
                        </span>
                      )}
                    </div>
                    {booking.slot && (
                      <div className="text-xs text-slate-600">
                        {format(parseISO(booking.slot.date), 'MMM d, yyyy')} · {getTimeRange(booking)}
                      </div>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border flex-shrink-0 ${
                      statusColors[booking.status] || 'bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                  >
                    {statusLabels[booking.status] || booking.status}
                  </span>
                </div>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-medium text-slate-900 text-right break-words">{getCustomerName(booking)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service:</span>
                    <span className="font-medium text-slate-900">{booking.serviceType ? serviceLabels[booking.serviceType] || booking.serviceType : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-medium text-slate-600 break-all">{getCustomerPhone(booking)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Client Type:</span>
                    {clientType ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${
                          clientType === 'repeat'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {clientType === 'repeat' ? 'Repeat' : 'New'}
                      </span>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-2 items-center">
                  {onUpdatePayment && booking.invoice && booking.paymentStatus !== 'paid' && (
                    <>
                      <button
                        onClick={() => onUpdatePayment(booking.id, 'partial', booking.invoice?.total ? booking.invoice.total * 0.5 : 0)}
                        className="rounded-full border-2 border-yellow-300 bg-white px-3 py-1.5 text-xs font-semibold text-yellow-700 touch-manipulation active:scale-[0.98] hover:bg-yellow-50"
                      >
                        Partial
                      </button>
                      <button
                        onClick={async () => {
                          const total = booking.invoice?.total || 0;
                          const deposit = booking.depositAmount || 0;
                          const balance = total - deposit;
                          const paidAmount = booking.paidAmount || 0;
                          const remainingBalance = balance - paidAmount;
                          
                          const amountPaidStr = prompt(
                            `Enter amount paid (₱):\n\nBalance: ₱${remainingBalance.toLocaleString('en-PH')}\nDeposit: ₱${deposit.toLocaleString('en-PH')}\nTotal: ₱${total.toLocaleString('en-PH')}`
                          );
                          if (!amountPaidStr || isNaN(Number(amountPaidStr))) return;
                          
                          const amountPaid = Number(amountPaidStr);
                          const totalPaid = (booking.paidAmount || 0) + amountPaid;
                          const tipAmount = totalPaid > balance ? totalPaid - balance : 0;
                          
                          await onUpdatePayment(booking.id, 'paid', totalPaid, tipAmount);
                        }}
                        className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white touch-manipulation active:scale-[0.98] hover:bg-green-700"
                      >
                        Paid
                      </button>
                    </>
                  )}
                  {/* Mobile: Show buttons directly, Desktop: Use dropdown */}
                  <div className="lg:hidden flex flex-wrap gap-2">
                    {onMakeQuotation && (
                      <button
                        onClick={() => onMakeQuotation(booking.id)}
                        className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white touch-manipulation active:scale-[0.98] hover:bg-rose-700"
                      >
                        Quote
                      </button>
                    )}
                    {onReschedule && booking.status !== 'cancelled' && !booking.invoice && (
                      <button
                        onClick={() => onReschedule(booking.id)}
                        className="rounded-full border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 touch-manipulation active:scale-[0.98] hover:bg-slate-50"
                      >
                        Resched
                      </button>
                    )}
                    {onCancel && booking.status !== 'cancelled' && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to cancel this booking?')) {
                            onCancel(booking.id);
                          }
                        }}
                        className="rounded-full border-2 border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 touch-manipulation active:scale-[0.98] hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {/* Desktop: Actions Dropdown */}
                  {(onMakeQuotation || onReschedule || onCancel) && (
                    <div className="hidden lg:block relative" ref={(el) => (dropdownRefs.current[booking.id] = el)}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === booking.id ? null : booking.id);
                        }}
                        className="rounded-full border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1"
                      >
                        Actions
                        <svg className={`w-3 h-3 transition-transform ${openDropdownId === booking.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {openDropdownId === booking.id && (
                        <div 
                          className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-2xl z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="py-1">
                            {onMakeQuotation && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMakeQuotation(booking.id);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                <span className="text-rose-600">📄</span>
                                Quotation
                              </button>
                            )}
                            {onReschedule && booking.status !== 'cancelled' && !booking.invoice && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReschedule(booking.id);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                <span>🔄</span>
                                Reschedule
                              </button>
                            )}
                            {onCancel && booking.status !== 'cancelled' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Are you sure you want to cancel this booking?')) {
                                    onCancel(booking.id);
                                  }
                                  setOpenDropdownId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2"
                              >
                                <span>❌</span>
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Booking ID
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 w-8">
                  {/* Warning column */}
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Date & Time
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Customer Name
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Service
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Contact
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Client Type
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Status
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    {filterPeriod === 'all' 
                      ? 'No bookings found.'
                      : `No bookings found for the selected ${filterPeriod}.`
                    }
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => {
                  const clientType = booking.clientType || clientTypeMap[booking.id];
                  return (
                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        <span className="text-xs xl:text-sm font-semibold text-slate-900">{booking.bookingId}</span>
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        {(booking.dateChanged || booking.timeChanged) && (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"
                            title={booking.validationWarnings?.join('; ') || 'Date or time was changed'}
                          >
                            ⚠️
                          </span>
                        )}
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        {booking.slot ? (
                          <div className="text-xs xl:text-sm">
                            <div className="font-medium text-slate-900">
                              {format(parseISO(booking.slot.date), 'MMM d, yyyy')}
                            </div>
                            <div className="text-slate-500">{getTimeRange(booking)}</div>
                          </div>
                        ) : (
                          <span className="text-xs xl:text-sm text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4">
                        <span className="text-xs xl:text-sm text-slate-900 break-words">{getCustomerName(booking)}</span>
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        <span className="text-xs xl:text-sm text-slate-900">
                          {booking.serviceType ? serviceLabels[booking.serviceType] || booking.serviceType : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        <span className="text-xs xl:text-sm text-slate-600">{getCustomerPhone(booking)}</span>
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        {clientType ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              clientType === 'repeat'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {clientType === 'repeat' ? 'Repeat' : 'New'}
                          </span>
                        ) : (
                          <span className="text-xs xl:text-sm text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            statusColors[booking.status] || 'bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          {statusLabels[booking.status] || booking.status}
                        </span>
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-2 items-center">
                          {onUpdatePayment && booking.invoice && booking.paymentStatus !== 'paid' && (
                            <>
                              <button
                                onClick={() => onUpdatePayment(booking.id, 'partial', booking.invoice?.total ? booking.invoice.total * 0.5 : 0)}
                                className="rounded-full border-2 border-yellow-300 bg-white px-3 py-1.5 text-xs font-semibold text-yellow-700 hover:bg-yellow-50 transition-colors"
                              >
                                Partial
                              </button>
                              <button
                                onClick={async () => {
                                  const total = booking.invoice?.total || 0;
                                  const deposit = booking.depositAmount || 0;
                                  const balance = total - deposit;
                                  const paidAmount = booking.paidAmount || 0;
                                  const remainingBalance = balance - paidAmount;
                                  
                                  const amountPaidStr = prompt(
                                    `Enter amount paid (₱):\n\nBalance: ₱${remainingBalance.toLocaleString('en-PH')}\nDeposit: ₱${deposit.toLocaleString('en-PH')}\nTotal: ₱${total.toLocaleString('en-PH')}`
                                  );
                                  if (!amountPaidStr || isNaN(Number(amountPaidStr))) return;
                                  
                                  const amountPaid = Number(amountPaidStr);
                                  const totalPaid = (booking.paidAmount || 0) + amountPaid;
                                  const tipAmount = totalPaid > balance ? totalPaid - balance : 0;
                                  
                                  await onUpdatePayment(booking.id, 'paid', totalPaid, tipAmount);
                                }}
                                className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                              >
                                Paid
                              </button>
                            </>
                          )}
                          {/* Desktop: Actions Dropdown */}
                          {(onMakeQuotation || onReschedule || onCancel) && (
                            <div className="relative" ref={(el) => (dropdownRefs.current[`desktop-${booking.id}`] = el)}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(openDropdownId === `desktop-${booking.id}` ? null : `desktop-${booking.id}`);
                                }}
                                className="rounded-full border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1"
                              >
                                Actions
                                <svg className={`w-3 h-3 transition-transform ${openDropdownId === `desktop-${booking.id}` ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {openDropdownId === `desktop-${booking.id}` && (
                                <div 
                                  className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-2xl z-[9999]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="py-1">
                                    {onMakeQuotation && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onMakeQuotation(booking.id);
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                      >
                                        <span className="text-rose-600">📄</span>
                                        Quotation
                                      </button>
                                    )}
                                    {onReschedule && booking.status !== 'cancelled' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onReschedule(booking.id);
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                      >
                                        <span>🔄</span>
                                        Reschedule
                                      </button>
                                    )}
                                    {onCancel && booking.status !== 'cancelled' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Are you sure you want to cancel this booking?')) {
                                            onCancel(booking.id);
                                          }
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2"
                                      >
                                        <span>❌</span>
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

