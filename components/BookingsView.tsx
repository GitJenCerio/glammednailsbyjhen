'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import type { Booking, Slot, BookingWithSlot } from '@/lib/types';
import { FormResponseModal } from '@/components/admin/modals/FormResponseModal';
import { PaymentModal } from '@/components/admin/modals/PaymentModal';
import { IoChevronDown, IoEyeOutline, IoDocumentTextOutline, IoCalendarOutline, IoTrashOutline, IoRefreshOutline, IoCloseCircleOutline } from 'react-icons/io5';

type FilterPeriod = 'day' | 'week' | 'month' | 'all';
type StatusFilter = 'all' | 'upcoming' | 'done';
type MonthFilter = 'all' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface BookingsViewProps {
  bookings: Booking[];
  slots: Slot[];
  selectedDate: string;
  customers?: Array<{ id: string; name?: string; phone?: string }>;
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
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

export function BookingsView({ bookings, slots, selectedDate, customers = [], onCancel, onReschedule, onMakeQuotation, onConfirm, onUpdatePayment }: BookingsViewProps) {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('all');
  const [clientTypeMap, setClientTypeMap] = useState<Record<string, 'repeat' | 'new'>>({});
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [responseModalBooking, setResponseModalBooking] = useState<BookingWithSlot | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<BookingWithSlot | null>(null);

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

  // Finance helpers for desktop + mobile views
  const getFinanceSummary = useCallback((booking: BookingWithSlot) => {
    const total = booking.invoice?.total || 0;
    const deposit = booking.depositAmount || 0;
    const paid = booking.paidAmount || 0;

    let balance = 0;
    if (booking.invoice) {
      const rawBalance = total - deposit - paid;
      balance = Math.max(0, rawBalance);
    } else if (deposit > 0) {
      // If there's only a deposit and no invoice, treat balance as 0 for display
      balance = 0;
    }

    return { total, deposit, paid, balance };
  }, []);

  // Map booking/payment status into friendly stage labels for the bookings table
  const getBookingStageLabel = useCallback((booking: BookingWithSlot): string => {
    const hasInvoice = !!booking.invoice;
    const { deposit, balance } = getFinanceSummary(booking);

    // Before invoice exists
    if (!hasInvoice) {
      if (booking.status === 'pending_form') return 'Awaiting Form';
      if (booking.status === 'pending_payment') return 'Awaiting DP';
      if (booking.status === 'confirmed') return 'Confirmed';
      return String(booking.status).replace('_', ' ');
    }

    // With invoice
    if (booking.paymentStatus === 'paid' || balance === 0) {
      return 'Done';
    }

    if (booking.paymentStatus === 'unpaid' && deposit === 0) {
      return 'Awaiting DP';
    }

    // Invoice exists and there is still balance to pay
    return 'Invoice generated';
  }, [getFinanceSummary]);

  // Filter bookings by period, status, and month
  const filteredBookings = useMemo(() => {
    let result: BookingWithSlot[];

    // Base date filtering (All / Day / Week / Month)
    if (filterPeriod === 'all') {
      result = bookingsWithSlots.filter((booking) => booking.slot !== undefined);
    } else {
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
          return bookingsWithSlots.filter((booking) => booking.slot !== undefined);
      }

      result = bookingsWithSlots.filter((booking) => {
        if (!booking.slot) return false;
        const bookingDate = parseISO(booking.slot.date);
        return isWithinInterval(bookingDate, { start, end });
      });
    }

    // Month filter (January, February, etc.)
    if (monthFilter !== 'all') {
      result = result.filter((booking) => {
        if (!booking.slot) return false;
        const monthIndex = parseISO(booking.slot.date).getMonth() + 1; // 1-12
        return monthIndex === monthFilter;
      });
    }

    // Status filter (Upcoming vs Done)
    if (statusFilter !== 'all') {
      result = result.filter((booking) => {
        const stage = getBookingStageLabel(booking);
        if (statusFilter === 'done') {
          return stage === 'Done';
        }
        // 'upcoming' = anything not done
        return stage !== 'Done';
      });
    }

    // Sort by date and time (most recent first for 'all', otherwise ascending)
    return result.sort((a, b) => {
      if (!a.slot || !b.slot) return 0;
      const dateCompare =
        filterPeriod === 'all'
          ? b.slot.date.localeCompare(a.slot.date)
          : a.slot.date.localeCompare(b.slot.date);
      if (dateCompare !== 0) return dateCompare;
      return filterPeriod === 'all'
        ? b.slot.time.localeCompare(a.slot.time)
        : a.slot.time.localeCompare(b.slot.time);
    });
  }, [bookingsWithSlots, selectedDate, filterPeriod, statusFilter, monthFilter, getBookingStageLabel]);

  const getCustomerName = (booking: BookingWithSlot): string => {
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
  };

  const getCustomerPhone = (booking: BookingWithSlot): string => {
    // Priority 1: Try to get phone from form data (for bookings with submitted forms)
    if (booking.customerData && Object.keys(booking.customerData).length > 0) {
      // Helper function to find field by fuzzy matching key names
      const findPhoneField = (keywords: string[]): string | null => {
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

      // Try various phone field name variations using fuzzy matching
      const phone = findPhoneField([
        'contact number',
        'phone number',
        'phone',
        'contact',
        'mobile',
        'cell',
        'telephone',
        'tel'
      ]);
      
      if (phone) return phone;
    }
    
    // Priority 2: Try to get phone from customer record if customerId exists
    if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
      const customer = customers.find(c => c.id === booking.customerId);
      if (customer?.phone) {
        return customer.phone;
      }
    }
    
    return 'N/A';
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
        // Check if click is outside all dropdown containers
        const allRefs = Object.values(dropdownRefs.current);
        const clickedInside = allRefs.some(
          (ref) => ref && ref.contains(event.target as Node)
        );
        // Also check if clicking on the dropdown menu itself
        const target = event.target as HTMLElement;
        const isDropdownMenu = target.closest('.dropdown-menu');
        if (!clickedInside && !isDropdownMenu) {
          setOpenDropdownId(null);
          setDropdownPosition(null);
        }
      }
    };
    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
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
      <div className="space-y-2 sm:space-y-3">
        {/* Date range filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white p-1 w-full sm:w-auto shadow-md">
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

        {/* Status + Month filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          {/* Status filter: All / Upcoming / Done */}
          <div className="flex gap-1.5 rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white p-1 w-full sm:w-auto shadow-md">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition touch-manipulation ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All statuses
            </button>
            <button
              onClick={() => setStatusFilter('upcoming')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition touch-manipulation ${
                statusFilter === 'upcoming'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setStatusFilter('done')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition touch-manipulation ${
                statusFilter === 'done'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Done
            </button>
          </div>

          {/* Month dropdown: All, Jan, Feb, ... */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] sm:text-xs text-slate-500">Month:</label>
            <select
              value={monthFilter}
              onChange={(e) =>
                setMonthFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as MonthFilter))
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            >
              <option value="all">All months</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Card View */}
      <div className="xl:hidden space-y-3 sm:space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center text-xs sm:text-sm text-slate-500 shadow-sm">
            {filterPeriod === 'all' 
              ? 'No bookings found.'
              : `No bookings found for the selected ${filterPeriod}.`
            }
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const clientType = booking.clientType || clientTypeMap[booking.id];
            const stageLabel = getBookingStageLabel(booking);
            const isDone = stageLabel === 'Done';
            return (
              <div key={booking.id} className="rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-5 md:p-6 shadow-lg hover:shadow-xl transition-all duration-200">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 sm:mb-1.5">
                      <span className="text-xs sm:text-sm md:text-base font-semibold text-slate-900 truncate">{booking.bookingId}</span>
                      {(booking.dateChanged || booking.timeChanged) && (
                        <span className="text-xs sm:text-sm" title={booking.validationWarnings?.join('; ') || 'Date or time was changed'}>
                          ⚠️
                        </span>
                      )}
                    </div>
                    {booking.slot && (
                      <div className="text-xs sm:text-sm md:text-base text-slate-600">
                        {format(parseISO(booking.slot.date), 'MMM d, yyyy')} · {getTimeRange(booking)}
                      </div>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs md:text-sm font-semibold border flex-shrink-0 ${
                      statusColors[booking.status] || 'bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                  >
                    {stageLabel}
                  </span>
                </div>
                <div className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm md:text-base">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Customer:</span>
                    <span className="font-medium text-slate-900 text-right break-words">{getCustomerName(booking)}</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Service:</span>
                    <span className="font-medium text-slate-900 text-right break-words">{booking.serviceType ? serviceLabels[booking.serviceType] || booking.serviceType : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Contact:</span>
                    <span className="font-medium text-slate-600 text-right break-all">{getCustomerPhone(booking)}</span>
                  </div>
                  {booking.invoice && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total:</span>
                        <span className="font-semibold text-slate-900">
                          ₱{getFinanceSummary(booking).total.toLocaleString('en-PH')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Deposit:</span>
                        <span className="font-medium text-emerald-700">
                          ₱{getFinanceSummary(booking).deposit.toLocaleString('en-PH')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Balance:</span>
                        <span
                          className={`font-semibold ${
                            getFinanceSummary(booking).balance > 0 ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          ₱{getFinanceSummary(booking).balance.toLocaleString('en-PH')}
                        </span>
                      </div>
                    </>
                  )}
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
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-200 flex flex-wrap gap-2 sm:gap-2.5 items-center">
                  {!isDone && onUpdatePayment && booking.invoice && booking.paymentStatus !== 'paid' && (
                    <>
                      <button
                        onClick={() => onUpdatePayment(booking.id, 'partial', booking.invoice?.total ? booking.invoice.total * 0.5 : 0)}
                        className="rounded-full border-2 border-yellow-300 bg-white px-3 py-1.5 text-xs font-semibold text-yellow-700 touch-manipulation active:scale-[0.98] hover:bg-yellow-50"
                      >
                        Partial
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBookingForPayment(booking);
                          setPaymentModalOpen(true);
                        }}
                        className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white touch-manipulation active:scale-[0.98] hover:bg-green-700"
                      >
                        Paid
                      </button>
                    </>
                  )}
                  {/* Mobile & Tablet: Show buttons directly */}
                  {!isDone && (
                    <div className="xl:hidden flex flex-wrap gap-2">
                      {booking.invoice ? (
                        // If invoice exists, show only Requote button
                        onMakeQuotation && (
                          <button
                            onClick={() => onMakeQuotation(booking.id)}
                            className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white touch-manipulation active:scale-[0.98] hover:bg-rose-700"
                          >
                            Requote
                          </button>
                        )
                      ) : (
                        // If no invoice, show all actions
                        <>
                          {booking.customerData && Object.keys(booking.customerData).length > 0 && (
                            <button
                              onClick={() => setResponseModalBooking(booking)}
                              className="inline-flex items-center gap-1 rounded-full border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 touch-manipulation active:scale-[0.98] hover:bg-slate-50"
                            >
                              <IoEyeOutline className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          )}
                          {onMakeQuotation && (
                            <button
                              onClick={() => onMakeQuotation(booking.id)}
                              className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white touch-manipulation active:scale-[0.98] hover:bg-rose-700"
                            >
                              Quote
                            </button>
                          )}
                          {onReschedule && (
                            <button
                              onClick={() => onReschedule(booking.id)}
                              className="rounded-full border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 touch-manipulation active:scale-[0.98] hover:bg-slate-50"
                            >
                              Resched
                            </button>
                          )}
                          {onCancel && (
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
                        </>
                      )}
                    </div>
                  )}
                  {/* Desktop: Actions - Requote button if invoice exists, dropdown if no invoice */}
                  {!isDone && (
                    <>
                      {booking.invoice ? (
                        // If invoice exists, show only Requote button (no dropdown)
                        onMakeQuotation && (
                          <button
                            onClick={() => onMakeQuotation(booking.id)}
                            className="hidden xl:inline-flex rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors"
                          >
                            Requote
                          </button>
                        )
                      ) : (
                        // If no invoice, show dropdown with all actions
                        (onMakeQuotation || onReschedule || onCancel || (booking.customerData && Object.keys(booking.customerData).length > 0)) && (
                          <div
                            className="hidden xl:block relative"
                            ref={(el: HTMLDivElement | null) => {
                              dropdownRefs.current[booking.id] = el;
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === booking.id ? null : booking.id);
                              }}
                              className="rounded-full border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1"
                            >
                              Actions
                              <IoChevronDown className={`w-3 h-3 transition-transform ${openDropdownId === booking.id ? 'rotate-180' : ''}`} />
                            </button>
                            {openDropdownId === booking.id && (
                              <div 
                                className="fixed w-40 rounded-lg border border-slate-200 bg-white shadow-2xl z-[100]"
                                style={{
                                  right: typeof window !== 'undefined' ? `${Math.max(20, window.innerWidth - (dropdownRefs.current[booking.id]?.getBoundingClientRect().right || 0) + 20)}px` : '20px',
                                  top: `${(dropdownRefs.current[booking.id]?.getBoundingClientRect().bottom || 0) + 4}px`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="py-1">
                                  {booking.customerData && Object.keys(booking.customerData).length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setResponseModalBooking(booking);
                                        setOpenDropdownId(null);
                                        setDropdownPosition(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                    >
                                      <IoEyeOutline className="w-4 h-4" />
                                      View Response
                                    </button>
                                  )}
                                  {onMakeQuotation && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMakeQuotation(booking.id);
                                        setOpenDropdownId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                    >
                                      <IoDocumentTextOutline className="w-4 h-4 text-rose-600" />
                                      Quotation
                                    </button>
                                  )}
                                  {onReschedule && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onReschedule(booking.id);
                                        setOpenDropdownId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                    >
                                      <IoCalendarOutline className="w-4 h-4" />
                                      Reschedule
                                    </button>
                                  )}
                                  {onCancel && (
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
                                      <IoCloseCircleOutline className="w-4 h-4" />
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden xl:block rounded-2xl sm:rounded-3xl border-2 border-slate-300 bg-white shadow-lg shadow-slate-200/50 relative">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-100 border-b-2 border-slate-300">
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
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Form
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Total
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Deposit
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Balance
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Status
                </th>
                <th className="px-4 xl:px-6 py-3 xl:py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-sm text-slate-500">
                    {filterPeriod === 'all' 
                      ? 'No bookings found.'
                      : `No bookings found for the selected ${filterPeriod}.`
                    }
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => {
                  const clientType = booking.clientType || clientTypeMap[booking.id];
                  const stageLabel = getBookingStageLabel(booking);
                  const isDone = stageLabel === 'Done';
                  return (
                    <tr key={booking.id} className="hover:bg-slate-100 transition-colors border-b border-slate-200">
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
                      {/* Form quick view icon */}
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        {booking.customerData && Object.keys(booking.customerData).length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setResponseModalBooking(booking)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                            title="View form response"
                          >
                            <IoEyeOutline className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] xl:text-xs text-slate-400">No form</span>
                        )}
                      </td>

                      {/* Finance columns */}
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        {booking.invoice ? (
                          <span className="text-xs xl:text-sm font-semibold text-slate-900">
                            ₱{getFinanceSummary(booking).total.toLocaleString('en-PH')}
                          </span>
                        ) : (
                          <span className="text-xs xl:text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        {booking.depositAmount ? (
                          <span className="text-xs xl:text-sm font-semibold text-emerald-700">
                            ₱{(booking.depositAmount || 0).toLocaleString('en-PH')}
                          </span>
                        ) : (
                          <span className="text-xs xl:text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        {booking.invoice || booking.depositAmount ? (
                          <span
                            className={`text-xs xl:text-sm font-semibold ${
                              getFinanceSummary(booking).balance > 0 ? 'text-red-700' : 'text-emerald-700'
                            }`}
                          >
                            ₱{getFinanceSummary(booking).balance.toLocaleString('en-PH')}
                          </span>
                        ) : (
                          <span className="text-xs xl:text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            statusColors[booking.status] || 'bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          {stageLabel}
                        </span>
                      </td>
                      <td className="px-4 xl:px-6 py-3 xl:py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-2 items-center">
                          {!isDone && onUpdatePayment && booking.invoice && booking.paymentStatus !== 'paid' && (
                            <>
                              <button
                                onClick={() => onUpdatePayment(booking.id, 'partial', booking.invoice?.total ? booking.invoice.total * 0.5 : 0)}
                                className="rounded-full border-2 border-yellow-300 bg-white px-3 py-1.5 text-xs font-semibold text-yellow-700 hover:bg-yellow-50 transition-colors"
                              >
                                Partial
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedBookingForPayment(booking);
                                  setPaymentModalOpen(true);
                                }}
                                className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                              >
                                Paid
                              </button>
                            </>
                          )}
                          {/* Desktop: Actions - Requote button if invoice exists, dropdown if no invoice */}
                          {!isDone && (
                            <>
                              {booking.invoice ? (
                                // If invoice exists, show only Requote button (no dropdown)
                                onMakeQuotation && (
                                  <button
                                    type="button"
                                    onClick={() => onMakeQuotation(booking.id)}
                                    className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors"
                                  >
                                    Requote
                                  </button>
                                )
                              ) : (
                                // If no invoice, show dropdown with all actions
                                (onMakeQuotation || onReschedule || onCancel || (booking.customerData && Object.keys(booking.customerData).length > 0)) && (
                                  <div
                                    className="relative"
                                    ref={(el: HTMLDivElement | null) => {
                                      dropdownRefs.current[`desktop-${booking.id}`] = el;
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        const button = e.currentTarget;
                                        const rect = button.getBoundingClientRect();
                                        if (openDropdownId === `desktop-${booking.id}`) {
                                          setOpenDropdownId(null);
                                          setDropdownPosition(null);
                                        } else {
                                          setOpenDropdownId(`desktop-${booking.id}`);
                                          setDropdownPosition({
                                            top: rect.bottom + 4,
                                            right: window.innerWidth - rect.right,
                                          });
                                        }
                                      }}
                                      className="rounded-full border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1"
                                    >
                                      Actions
                                      <IoChevronDown className={`w-3 h-3 transition-transform ${openDropdownId === `desktop-${booking.id}` ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openDropdownId === `desktop-${booking.id}` && dropdownPosition && typeof window !== 'undefined' && createPortal(
                                      <div 
                                        className="dropdown-menu fixed w-40 rounded-lg border border-slate-200 bg-white shadow-2xl z-[9999]"
                                        style={{
                                          top: `${Math.min(window.innerHeight - 150, dropdownPosition.top)}px`,
                                          right: `${Math.max(20, dropdownPosition.right)}px`,
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                      >
                                        <div className="py-1">
                                          {booking.customerData && Object.keys(booking.customerData).length > 0 && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setResponseModalBooking(booking);
                                                setOpenDropdownId(null);
                                                setDropdownPosition(null);
                                              }}
                                              className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                            >
                                              <IoEyeOutline className="w-4 h-4" />
                                              View Response
                                            </button>
                                          )}
                                          {onMakeQuotation && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onMakeQuotation(booking.id);
                                                setOpenDropdownId(null);
                                                setDropdownPosition(null);
                                              }}
                                              className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                            >
                                              <IoDocumentTextOutline className="w-4 h-4 text-rose-600" />
                                              Quotation
                                            </button>
                                          )}
                                          {onReschedule && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onReschedule(booking.id);
                                                setOpenDropdownId(null);
                                                setDropdownPosition(null);
                                              }}
                                              className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                            >
                                              <IoCalendarOutline className="w-4 h-4" />
                                              Reschedule
                                            </button>
                                          )}
                                          {onCancel && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('Are you sure you want to cancel this booking?')) {
                                                  onCancel(booking.id);
                                                }
                                                setOpenDropdownId(null);
                                                setDropdownPosition(null);
                                              }}
                                              className="w-full text-left px-4 py-2 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2"
                                            >
                                              <IoCloseCircleOutline className="w-4 h-4" />
                                              Cancel
                                            </button>
                                          )}
                                        </div>
                                      </div>,
                                      document.body
                                    )}
                                  </div>
                                )
                              )}
                            </>
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

      {/* Form Response Modal */}
      <FormResponseModal
        open={!!responseModalBooking}
        booking={responseModalBooking ?? null}
        onClose={() => setResponseModalBooking(null)}
      />

      {/* Payment Modal for bookings view */}
      {onUpdatePayment && (
        <PaymentModal
          open={paymentModalOpen}
          booking={selectedBookingForPayment}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedBookingForPayment(null);
          }}
          onSubmit={async (amountPaid) => {
            if (!selectedBookingForPayment) return;

            const total = selectedBookingForPayment.invoice?.total || 0;
            const deposit = selectedBookingForPayment.depositAmount || 0;
            const balance = total - deposit;
            const totalPaid = (selectedBookingForPayment.paidAmount || 0) + amountPaid;
            const tipAmount = totalPaid > balance ? totalPaid - balance : 0;
            const paymentStatus = totalPaid >= balance ? 'paid' : 'partial';

            await onUpdatePayment(
              selectedBookingForPayment.id,
              paymentStatus,
              totalPaid,
              tipAmount,
            );
          }}
        />
      )}
    </div>
  );
}

