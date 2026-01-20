'use client';

import { useState } from 'react';
import type { Customer } from '@/lib/types';

type CustomerListProps = {
  customers: Customer[];
  onSelect: (customer: Customer) => void;
  selectedId: string | null;
};

export function CustomerList({ customers, onSelect, selectedId }: CustomerListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md shadow-slate-900/5">
      <header className="mb-3 sm:mb-4">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">Customers</p>
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold">All customers</h2>
      </header>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      <div className="space-y-2">
        {filteredCustomers.length === 0 && (
          <div className="rounded-xl sm:rounded-2xl border border-dashed border-slate-200 p-3 sm:p-4 text-xs sm:text-sm text-slate-500 text-center">
            {searchQuery ? 'No customers found.' : 'No customers yet.'}
          </div>
        )}
        {filteredCustomers.map((customer) => (
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
    </div>
  );
}

