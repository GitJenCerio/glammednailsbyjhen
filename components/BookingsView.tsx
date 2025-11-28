'use client';

import { useMemo, useState } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import type { Booking, Slot, BookingWithSlot } from '@/lib/types';

type FilterPeriod = 'day' | 'week' | 'month';

interface BookingsViewProps {
  bookings: Booking[];
  slots: Slot[];
  selectedDate: string;
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

export function BookingsView({ bookings, slots, selectedDate }: BookingsViewProps) {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('week');
  const [clientTypeMap, setClientTypeMap] = useState<Record<string, 'repeat' | 'new'>>({});

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
    if (!booking.customerData) return 'N/A';
    return booking.customerData['Name'] || 
           booking.customerData['name'] || 
           booking.customerData['Full Name'] || 
           booking.customerData['fullName'] || 
           'N/A';
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
          Showing {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs sm:text-sm text-slate-500">
            No bookings found for the selected {filterPeriod}.
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
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    No bookings found for the selected {filterPeriod}.
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

