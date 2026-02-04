'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Customer, Booking } from '@/lib/types';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

type CustomerListProps = {
  customers: Customer[];
  bookings?: Booking[]; // Optional: bookings to filter by
  onSelect: (customer: Customer) => void;
  selectedId: string | null;
};

type BookingFilter = 'all' | 'with_bookings' | 'without_bookings';

const ITEMS_PER_PAGE = 20;

export function CustomerList({ customers, bookings = [], onSelect, selectedId }: CustomerListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Create a set of customer IDs that have bookings for quick lookup
  const customersWithBookings = useMemo(() => {
    const customerIds = new Set<string>();
    bookings.forEach(booking => {
      if (booking.customerId && booking.status !== 'cancelled') {
        customerIds.add(booking.customerId);
      }
    });
    return customerIds;
  }, [bookings]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      // Apply booking filter
      if (bookingFilter === 'with_bookings') {
        if (!customersWithBookings.has(customer.id)) return false;
      } else if (bookingFilter === 'without_bookings') {
        if (customersWithBookings.has(customer.id)) return false;
      }

      // Apply search query
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        customer.name.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query)
      );
    });
  }, [customers, searchQuery, bookingFilter, customersWithBookings]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, bookingFilter]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md shadow-slate-900/5">
      <header className="mb-3 sm:mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">Customers</p>
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold">
              {bookingFilter === 'all' ? 'All customers' : 
               bookingFilter === 'with_bookings' ? 'Customers with bookings' : 
               'Customers without bookings'}
            </h2>
          </div>
          {filteredCustomers.length > 0 && (
            <div className="text-xs sm:text-sm text-slate-500">
              {startIndex + 1}-{Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length}
            </div>
          )}
        </div>
      </header>

      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <select
            value={bookingFilter}
            onChange={(e) => setBookingFilter(e.target.value as BookingFilter)}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Customers</option>
            <option value="with_bookings">With Bookings</option>
            <option value="without_bookings">Without Bookings</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      <div className="space-y-2 max-h-[calc(100vh-350px)] sm:max-h-[calc(100vh-380px)] overflow-y-auto pr-1 -mr-1">
        {filteredCustomers.length === 0 && (
          <div className="rounded-xl sm:rounded-2xl border border-dashed border-slate-200 p-3 sm:p-4 text-xs sm:text-sm text-slate-500 text-center">
            {searchQuery ? 'No customers found.' : 'No customers yet.'}
          </div>
        )}
        {paginatedCustomers.map((customer) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => onSelect(customer)}
            className={[
              'w-full rounded-xl sm:rounded-2xl border bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-all duration-200 touch-manipulation',
              selectedId === customer.id
                ? 'border-slate-900 shadow-lg shadow-slate-900/10 ring-2 ring-slate-900/5'
                : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5 active:scale-[0.98]',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold truncate">{customer.name}</p>
                {customer.email && (
                  <p className="text-[10px] sm:text-xs text-slate-400 truncate">{customer.email}</p>
                )}
                {customer.phone && (
                  <p className="text-[10px] sm:text-xs text-slate-500 truncate">{customer.phone}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={[
              'flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all touch-manipulation',
              currentPage === 1
                ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]',
            ].join(' ')}
          >
            <IoChevronBack className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => goToPage(pageNum)}
                  className={[
                    'min-w-[32px] rounded-full px-2 py-1 text-xs sm:text-sm font-semibold transition-all touch-manipulation',
                    currentPage === pageNum
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 active:scale-[0.95]',
                  ].join(' ')}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="text-slate-400 px-1">...</span>
                <button
                  type="button"
                  onClick={() => goToPage(totalPages)}
                  className="min-w-[32px] rounded-full px-2 py-1 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 active:scale-[0.95] transition-all touch-manipulation"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={[
              'flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all touch-manipulation',
              currentPage === totalPages
                ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]',
            ].join(' ')}
          >
            Next
            <IoChevronForward className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

