'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import type { Booking, BookingWithSlot, PaymentStatus, Customer } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';
import { PaymentModal } from './modals/PaymentModal';
import { IoEllipsisVertical } from 'react-icons/io5';

type FinanceViewProps = {
  bookings: Booking[];
  slots: any[];
  customers?: Customer[];
};

type MonthFilter = 'all' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial Paid',
  paid: 'Fully Paid',
  refunded: 'Refunded',
};

const paymentStatusColors: Record<PaymentStatus, string> = {
  unpaid: 'bg-red-100 text-red-800 border-red-200',
  partial: 'bg-orange-100 text-orange-800 border-orange-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  refunded: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function FinanceView({ bookings, slots, customers = [] }: FinanceViewProps) {
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'all'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'week' | 'month'>('all');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('all');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [useDateRange, setUseDateRange] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<Booking | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<Record<string, 'up' | 'down'>>({});
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const bookingsWithSlots = useMemo<BookingWithSlot[]>(() => {
    const list: BookingWithSlot[] = [];
    bookings.forEach((booking) => {
      const slot = slots.find((candidate) => candidate.id === booking.slotId);
      if (!slot) return;
      const linkedSlots = (booking.linkedSlotIds ?? [])
        .map((linkedId) => slots.find((candidate) => candidate.id === linkedId))
        .filter((value): value is any => Boolean(value));
      const pairedSlot = linkedSlots[0];
      list.push({ ...booking, slot, pairedSlot, linkedSlots });
    });
    return list;
  }, [bookings, slots]);

  const getCustomerName = (booking: Booking) => {
    // 1) Always prefer the name the client typed in the form (per booking)
    if (booking.customerData) {
      const name =
        booking.customerData['Name'] ||
        booking.customerData['name'] ||
        booking.customerData['Full Name'] ||
        booking.customerData['fullName'] ||
        '';
      const surname =
        booking.customerData['Surname'] ||
        booking.customerData['surname'] ||
        booking.customerData['Last Name'] ||
        booking.customerData['lastName'] ||
        '';

      const fullName = `${name}${name && surname ? ' ' : ''}${surname}`.trim();
      if (fullName) return fullName;
    }

    // 2) If no form data, fall back to Customer record (shared by email/phone)
    if (booking.customerId && customers.length > 0) {
      const customer = customers.find((c) => c.id === booking.customerId);
      if (customer?.name) return customer.name;
    }

    // 3) Last fallback: bookingId
    return booking.bookingId;
  };

  const filteredBookings = useMemo(() => {
    let filtered = bookingsWithSlots.filter((booking) => {
      if (filterStatus !== 'all' && booking.paymentStatus !== filterStatus) return false;
      // Include bookings with invoices OR bookings with deposits (partial payments)
      if (!booking.invoice && !booking.depositAmount) return false;
      return true;
    });

    if (filterPeriod !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (filterPeriod === 'week') {
        cutoff.setDate(now.getDate() - 7);
      } else if (filterPeriod === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
      }
      filtered = filtered.filter((booking) => {
        // Use invoice date if available, otherwise use booking updated date
        const bookingDate = booking.invoice?.createdAt 
          ? new Date(booking.invoice.createdAt)
          : new Date(booking.updatedAt);
        return bookingDate >= cutoff;
      });
    }

    // Month filter (by invoice/updated date month)
    if (monthFilter !== 'all') {
      filtered = filtered.filter((booking) => {
        const bookingDate = booking.invoice?.createdAt
          ? new Date(booking.invoice.createdAt)
          : new Date(booking.updatedAt);
        const monthIndex = bookingDate.getMonth() + 1; // 1-12
        return monthIndex === monthFilter;
      });
    }

    // Date range filter
    if (useDateRange && dateRangeStart && dateRangeEnd) {
      const startDate = new Date(dateRangeStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRangeEnd);
      endDate.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter((booking) => {
        const bookingDate = booking.invoice?.createdAt
          ? new Date(booking.invoice.createdAt)
          : new Date(booking.updatedAt);
        return bookingDate >= startDate && bookingDate <= endDate;
      });
    }

    return filtered.sort((a, b) => {
      // Sort by invoice date if available, otherwise by booking updated date
      const dateA = a.invoice?.createdAt 
        ? new Date(a.invoice.createdAt).getTime() 
        : new Date(a.updatedAt).getTime();
      const dateB = b.invoice?.createdAt 
        ? new Date(b.invoice.createdAt).getTime() 
        : new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });
  }, [bookingsWithSlots, filterStatus, filterPeriod, monthFilter, dateRangeStart, dateRangeEnd, useDateRange]);

  const totals = useMemo(() => {
    // Unpaid: Count the remaining balance (total - deposit - paidAmount) for bookings with invoice
    const unpaid = filteredBookings
      .filter((b) => {
        if (!b.invoice) return false; // Only count bookings with invoice
        const total = b.invoice.total || 0;
        const deposit = b.depositAmount || 0;
        const paid = b.paidAmount || 0;
        const balance = total - deposit - paid;
        return balance > 0; // Only count if there's a remaining balance
      })
      .reduce((sum, b) => {
        const total = b.invoice?.total || 0;
        const deposit = b.depositAmount || 0;
        const paid = b.paidAmount || 0;
        const balance = total - deposit - paid;
        return sum + balance; // Count the remaining balance as unpaid
      }, 0);
    
    // Partial: Only count the deposit (DP) amount when there's a deposit but invoice isn't fully paid
    const partial = filteredBookings
      .filter((b) => {
        const deposit = b.depositAmount || 0;
        if (deposit === 0) return false; // No deposit, not partial
        
        if (!b.invoice) {
          // Booking with deposit but no invoice yet = partial (DP only)
          return true;
        }
        
        // Booking with invoice: check if there's still balance remaining
        const total = b.invoice.total || 0;
        const paid = b.paidAmount || 0;
        const balance = total - deposit - paid;
        return balance > 0; // Still has balance, so deposit counts as partial
      })
      .reduce((sum, b) => {
        const deposit = b.depositAmount || 0;
        return sum + deposit; // Only count the deposit amount as partial
      }, 0);
    
    const paid = filteredBookings
      .filter((b) => b.paymentStatus === 'paid')
      .reduce((sum, b) => {
        const invoiceTotal = b.invoice?.total || 0;
        const tip = b.tipAmount || 0;
        return sum + invoiceTotal + tip; // Include tips in paid revenue
      }, 0);
    // Total Revenue = Total amount actually received (deposits + payments + tips)
    const total = filteredBookings.reduce((sum, b) => {
      const deposit = b.depositAmount || 0;
      const paid = b.paidAmount || 0;
      const tip = b.tipAmount || 0;
      // Sum all amounts actually received
      return sum + deposit + paid + tip;
    }, 0);
    const tips = filteredBookings.reduce((sum, b) => sum + (b.tipAmount || 0), 0);

    // Sister commission: 10% of invoice total for bookings marked with assistant commission
    const sisterCommissionTotal = filteredBookings.reduce((sum, b) => {
      if (b.assistantName === 'Sister' && b.assistantCommissionRate && b.invoice?.total) {
        return sum + b.invoice.total * b.assistantCommissionRate;
      }
      return sum;
    }, 0);

    return { unpaid, partial, paid, total, tips, sisterCommissionTotal };
  }, [filteredBookings]);

  const handleUpdatePayment = async (bookingId: string, paymentStatus: PaymentStatus, paidAmount?: number, tipAmount?: number) => {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_payment',
        paymentStatus,
        paidAmount,
        tipAmount,
      }),
    });
    if (!res.ok) {
      alert('Failed to update payment status');
      return;
    }
    setOpenDropdownId(null);
    window.location.reload();
  };

  // Close dropdown when clicking outside and calculate position
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId) {
        const dropdown = dropdownRefs.current[openDropdownId];
        if (dropdown && !dropdown.contains(event.target as Node)) {
          setOpenDropdownId(null);
        }
      }
    };

    // Calculate dropdown position when it opens
    if (openDropdownId) {
      const dropdown = dropdownRefs.current[openDropdownId];
      if (dropdown) {
        const rect = dropdown.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 120; // Approximate dropdown height
        
        // If not enough space below but enough space above, open upward
        if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
          setDropdownPosition(prev => ({ ...prev, [openDropdownId]: 'up' }));
        } else {
          setDropdownPosition(prev => ({ ...prev, [openDropdownId]: 'down' }));
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
        {/* First row: Total Revenue, Total Tips, Sister Commission */}
        <div className="rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-slate-500 mb-1 sm:mb-2 truncate">Total Revenue</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-slate-900 leading-tight break-words">₱{totals.total.toLocaleString('en-PH')}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border-2 border-purple-300 bg-purple-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-purple-200/50 hover:shadow-xl hover:shadow-purple-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-purple-600 mb-1 sm:mb-2 truncate">Total Tips</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-purple-700 leading-tight break-words">₱{totals.tips.toLocaleString('en-PH')}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border-2 border-amber-300 bg-amber-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-amber-200/50 hover:shadow-xl hover:shadow-amber-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-amber-600 mb-1 sm:mb-2 line-clamp-2">Sister Commission (10%)</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-amber-700 leading-tight break-words">₱{totals.sisterCommissionTotal.toLocaleString('en-PH')}</p>
        </div>
        {/* Second row: Paid, Partial, Unpaid */}
        <div className="rounded-xl sm:rounded-2xl border-2 border-green-300 bg-green-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-green-200/50 hover:shadow-xl hover:shadow-green-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-green-600 mb-1 sm:mb-2 truncate">Paid</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-green-700 leading-tight break-words">₱{totals.paid.toLocaleString('en-PH')}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border-2 border-orange-300 bg-orange-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-orange-200/50 hover:shadow-xl hover:shadow-orange-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-orange-600 mb-1 sm:mb-2 truncate">Partial</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-orange-700 leading-tight break-words">₱{totals.partial.toLocaleString('en-PH')}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border-2 border-red-300 bg-red-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-red-200/50 hover:shadow-xl hover:shadow-red-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-red-600 mb-1 sm:mb-2 truncate">Unpaid</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-red-700 leading-tight break-words">₱{totals.unpaid.toLocaleString('en-PH')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-start sm:items-center justify-between">
        {/* Status filter */}
        <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              filterStatus === 'all' ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('unpaid')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              filterStatus === 'unpaid' ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Unpaid
          </button>
          <button
            onClick={() => setFilterStatus('partial')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              filterStatus === 'partial' ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Partial
          </button>
          <button
            onClick={() => setFilterStatus('paid')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              filterStatus === 'paid' ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Paid
          </button>
        </div>

        {/* Period filter */}
        <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
          <button
            onClick={() => {
              setFilterPeriod('all');
              setUseDateRange(false); // Disable date range when using period filter
            }}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              filterPeriod === 'all' ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => {
              setFilterPeriod('week');
              setUseDateRange(false); // Disable date range when using period filter
            }}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              filterPeriod === 'week' ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => {
              setFilterPeriod('month');
              setUseDateRange(false); // Disable date range when using period filter
            }}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              filterPeriod === 'month' ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            This Month
          </button>
        </div>

            {/* Month filter */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] sm:text-xs text-slate-500">Month:</label>
              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as MonthFilter));
                  setUseDateRange(false); // Disable date range when using month filter
                }}
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

          {/* Date Range Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-3 sm:mt-0">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useDateRange"
                checked={useDateRange}
                onChange={(e) => {
                  setUseDateRange(e.target.checked);
                  if (!e.target.checked) {
                    setDateRangeStart('');
                    setDateRangeEnd('');
                  } else {
                    // Disable period and month filters when using date range
                    setFilterPeriod('all');
                    setMonthFilter('all');
                  }
                }}
                className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
              />
              <label htmlFor="useDateRange" className="text-[11px] sm:text-xs text-slate-700 font-medium">
                Custom Date Range
              </label>
            </div>
            {useDateRange && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] sm:text-xs text-slate-500 whitespace-nowrap">From:</label>
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    max={dateRangeEnd || undefined}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] sm:text-xs text-slate-500 whitespace-nowrap">To:</label>
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    min={dateRangeStart || undefined}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
                {(dateRangeStart || dateRangeEnd) && (
                  <button
                    onClick={() => {
                      setDateRangeStart('');
                      setDateRangeEnd('');
                    }}
                    className="text-[11px] sm:text-xs text-slate-500 hover:text-slate-700 underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs sm:text-sm text-slate-500">
            No invoices found.
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{booking.bookingId}</span>
                  </div>
                  <div className="text-xs text-slate-600">{getCustomerName(booking)}</div>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border flex-shrink-0 ${
                    paymentStatusColors[booking.paymentStatus || 'unpaid']
                  }`}
                >
                  {paymentStatusLabels[booking.paymentStatus || 'unpaid']}
                </span>
              </div>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-medium text-slate-900 text-right">
                    {booking.invoice?.createdAt
                      ? format(parseISO(booking.invoice.createdAt), 'MMM d, yyyy')
                      : booking.updatedAt
                        ? format(parseISO(booking.updatedAt), 'MMM d, yyyy')
                        : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Amount:</span>
                  <span className="font-semibold text-slate-900">
                    ₱{booking.invoice?.total.toLocaleString('en-PH') || '0'}
                  </span>
                </div>
                {!booking.invoice && booking.depositAmount && (
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400 italic">No invoice yet</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Deposit (DP):</span>
                  {booking.depositAmount ? (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-700">
                        ₱{booking.depositAmount.toLocaleString('en-PH')}
                      </span>
                      <button
                        onClick={async () => {
                          const amount = prompt('Update deposit amount (₱):', String(booking.depositAmount || 0));
                          if (!amount || isNaN(Number(amount))) return;
                          const res = await fetch(`/api/bookings/${booking.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'update_deposit',
                              depositAmount: Number(amount),
                            }),
                          });
                          if (res.ok) window.location.reload();
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600 underline"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        const amount = prompt('Enter deposit amount (₱):');
                        if (!amount || isNaN(Number(amount))) return;
                        const res = await fetch(`/api/bookings/${booking.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'update_deposit',
                            depositAmount: Number(amount),
                          }),
                        });
                        if (res.ok) window.location.reload();
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 underline"
                    >
                      Add DP
                    </button>
                  )}
                </div>
                {booking.invoice && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Balance:</span>
                    <span className={`font-bold ${(() => {
                      const total = booking.invoice?.total || 0;
                      const deposit = booking.depositAmount || 0;
                      const paid = booking.paidAmount || 0;
                      const balance = total - deposit - paid;
                      return balance > 0 ? 'text-red-700' : 'text-emerald-700';
                    })()}`}>
                      ₱{(() => {
                        const total = booking.invoice?.total || 0;
                        const deposit = booking.depositAmount || 0;
                        const paid = booking.paidAmount || 0;
                        const balance = total - deposit - paid;
                        return Math.max(0, balance).toLocaleString('en-PH');
                      })()}
                    </span>
                  </div>
                )}
                {!booking.invoice && booking.depositAmount && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Deposit Paid:</span>
                    <span className="font-bold text-emerald-700">
                      ₱{booking.depositAmount.toLocaleString('en-PH')}
                    </span>
                  </div>
                )}
                {typeof booking.paidAmount === 'number' && booking.paidAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount Paid (after DP):</span>
                    <span className="font-medium text-slate-600">
                      ₱{booking.paidAmount.toLocaleString('en-PH')}
                    </span>
                  </div>
                )}
                {booking.paymentStatus === 'paid' && booking.tipAmount && booking.tipAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tip:</span>
                    <span className="font-semibold text-emerald-700">
                      ₱{booking.tipAmount.toLocaleString('en-PH')}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-2">
                {booking.paymentStatus !== 'paid' && (
                  <>
                    <button
                      onClick={() => handleUpdatePayment(booking.id, 'partial', booking.invoice?.total ? booking.invoice.total * 0.5 : 0)}
                      className="rounded-full border-2 border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 touch-manipulation active:scale-[0.98] hover:bg-orange-50"
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
                {booking.paymentStatus === 'paid' && (
                  <button
                    onClick={() => handleUpdatePayment(booking.id, 'refunded')}
                    className="rounded-full border-2 border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 touch-manipulation active:scale-[0.98] hover:bg-red-50"
                  >
                    Refund
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Booking
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Customer
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Date
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Total Amount
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Deposit (DP)
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Amount Paid
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Balance
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Sister 10%
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Status
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 relative">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50">
                  <td className="px-4 xl:px-6 py-3">
                      <span className="text-xs xl:text-sm font-semibold text-slate-900">{booking.bookingId}</span>
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      <span className="text-xs xl:text-sm text-slate-900">{getCustomerName(booking)}</span>
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      {booking.invoice?.createdAt ? (
                        <span className="text-xs xl:text-sm text-slate-600">
                          {format(parseISO(booking.invoice.createdAt), 'MMM d, yyyy')}
                        </span>
                      ) : booking.updatedAt ? (
                        <span className="text-xs xl:text-sm text-slate-600">
                          {format(parseISO(booking.updatedAt), 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span className="text-xs xl:text-sm text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      <span className="text-xs xl:text-sm font-semibold text-slate-900">
                        ₱{booking.invoice?.total.toLocaleString('en-PH') || '0'}
                      </span>
                      {!booking.invoice && booking.depositAmount && (
                        <p className="text-xs text-slate-400 italic">No invoice yet</p>
                      )}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      {booking.depositAmount ? (
                        <div>
                          <span className="text-xs xl:text-sm font-semibold text-emerald-700">
                            ₱{booking.depositAmount.toLocaleString('en-PH')}
                          </span>
                          <button
                            onClick={async () => {
                              const amount = prompt('Update deposit amount (₱):', String(booking.depositAmount || 0));
                              if (!amount || isNaN(Number(amount))) return;
                              const res = await fetch(`/api/bookings/${booking.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'update_deposit',
                                  depositAmount: Number(amount),
                                }),
                              });
                              if (res.ok) window.location.reload();
                            }}
                            className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            const amount = prompt('Enter deposit amount (₱):');
                            if (!amount || isNaN(Number(amount))) return;
                            const res = await fetch(`/api/bookings/${booking.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'update_deposit',
                                depositAmount: Number(amount),
                              }),
                            });
                            if (res.ok) window.location.reload();
                          }}
                          className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          Add DP
                        </button>
                      )}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      {typeof booking.paidAmount === 'number' && booking.paidAmount > 0 ? (
                        <span className="text-xs xl:text-sm font-semibold text-slate-900">
                          ₱{booking.paidAmount.toLocaleString('en-PH')}
                        </span>
                      ) : (
                        <span className="text-xs xl:text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      {booking.invoice ? (
                        <>
                          <span className={`text-xs xl:text-sm font-bold ${(() => {
                            const total = booking.invoice?.total || 0;
                            const deposit = booking.depositAmount || 0;
                            const paid = booking.paidAmount || 0;
                            const balance = total - deposit - paid;
                            return balance > 0 ? 'text-red-700' : 'text-emerald-700';
                          })()}`}>
                            ₱{(() => {
                              const total = booking.invoice?.total || 0;
                              const deposit = booking.depositAmount || 0;
                              const paid = booking.paidAmount || 0;
                              const balance = total - deposit - paid;
                              return Math.max(0, balance).toLocaleString('en-PH');
                            })()}
                          </span>
                          {booking.paymentStatus === 'partial' && booking.paidAmount && (
                            <p className="text-xs text-slate-500 mt-1">
                              Paid: ₱{booking.paidAmount.toLocaleString('en-PH')}
                            </p>
                          )}
                          {booking.paymentStatus === 'paid' && booking.tipAmount && booking.tipAmount > 0 && (
                            <p className="text-xs text-emerald-700 mt-1 font-semibold">
                              Tip: ₱{booking.tipAmount.toLocaleString('en-PH')}
                            </p>
                          )}
                        </>
                      ) : booking.depositAmount ? (
                        <div className="space-y-0.5">
                          <span className="text-xs xl:text-sm font-bold text-emerald-700">
                            ₱0
                          </span>
                          <p className="text-[10px] xl:text-xs text-slate-500">
                            DP only: ₱{booking.depositAmount.toLocaleString('en-PH')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs xl:text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      {booking.assistantName === 'Sister' && booking.assistantCommissionRate && booking.invoice?.total ? (
                        <span className="text-xs xl:text-sm font-semibold text-amber-700">
                          ₱{(booking.invoice.total * booking.assistantCommissionRate).toLocaleString('en-PH')}
                        </span>
                      ) : (
                        <span className="text-xs xl:text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          paymentStatusColors[booking.paymentStatus || 'unpaid']
                        }`}
                      >
                        {paymentStatusLabels[booking.paymentStatus || 'unpaid']}
                      </span>
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      <div className="relative inline-block" ref={(el) => (dropdownRefs.current[booking.id] = el)}>
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === booking.id ? null : booking.id)}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                          aria-label="Actions"
                        >
                          <IoEllipsisVertical className="w-5 h-5 text-slate-600" />
                        </button>
                        {openDropdownId === booking.id && (
                          <div 
                            className="fixed w-40 rounded-xl border border-slate-200 bg-white shadow-lg z-[100] overflow-hidden"
                            style={{
                              right: typeof window !== 'undefined' ? `${Math.max(20, window.innerWidth - (dropdownRefs.current[booking.id]?.getBoundingClientRect().right || 0) + 20)}px` : '20px',
                              top: dropdownPosition[booking.id] === 'up' 
                                ? `${Math.max(20, (dropdownRefs.current[booking.id]?.getBoundingClientRect().top || 0) - 130)}px`
                                : `${Math.min((typeof window !== 'undefined' ? window.innerHeight : 1000) - 150, (dropdownRefs.current[booking.id]?.getBoundingClientRect().bottom || 0) + 4)}px`,
                            }}
                          >
                            {booking.paymentStatus !== 'paid' && (
                              <>
                                <button
                                  onClick={() => handleUpdatePayment(booking.id, 'partial', booking.invoice?.total ? booking.invoice.total * 0.5 : 0)}
                                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-semibold text-orange-700 hover:bg-orange-50 transition-colors"
                                >
                                  Mark as Partial
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedBookingForPayment(booking);
                                    setPaymentModalOpen(true);
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors"
                                >
                                  Mark as Paid
                                </button>
                              </>
                            )}
                            {booking.paymentStatus === 'paid' && (
                              <button
                                onClick={() => handleUpdatePayment(booking.id, 'refunded')}
                                className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
          const paymentStatus: PaymentStatus = totalPaid >= balance ? 'paid' : 'partial';
          
          await handleUpdatePayment(selectedBookingForPayment.id, paymentStatus, totalPaid, tipAmount);
        }}
      />
    </div>
  );
}

