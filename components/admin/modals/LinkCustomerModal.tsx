'use client';

import { useState } from 'react';
import type { Booking, Customer } from '@/lib/types';
import { IoClose } from 'react-icons/io5';
import { CustomerList } from '@/components/admin/CustomerList';

type LinkCustomerModalProps = {
  open: boolean;
  booking: Booking | null;
  customers: Customer[];
  onClose: () => void;
  onConfirm: (bookingId: string, customerId: string) => Promise<void>;
};

export function LinkCustomerModal({ open, booking, customers, onClose, onConfirm }: LinkCustomerModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  if (!open || !booking) return null;

  const handleConfirm = async () => {
    if (!selectedCustomerId) return;
    
    setIsLinking(true);
    try {
      await onConfirm(booking.id, selectedCustomerId);
      setSelectedCustomerId(null);
      onClose();
    } catch (error) {
      console.error('Error linking customer:', error);
      alert('Failed to link booking to customer. Please try again.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-xl shadow-slate-900/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors z-10"
          aria-label="Close"
          type="button"
        >
          <IoClose className="w-6 h-6 text-slate-600" />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-2 pr-10">Link Booking to Customer</h2>
          <p className="text-sm text-slate-600 mb-6">
            Select a customer to link booking <strong>{booking.bookingId}</strong> to.
          </p>

          <div className="mb-6">
            <CustomerList
              customers={customers}
              onSelect={handleSelectCustomer}
              selectedId={selectedCustomerId}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isLinking}
              className="px-4 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedCustomerId || isLinking}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLinking ? 'Linking...' : 'Link Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



