'use client';

import { useState, useEffect } from 'react';
import type { Customer, Booking } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

type CustomerDetailPanelProps = {
  customer: Customer | null;
  bookings: Booking[];
  lifetimeValue: number;
  onUpdate?: (customerId: string, updates: Partial<Customer>) => Promise<void>;
};

const statusLabels: Record<string, string> = {
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

export function CustomerDetailPanel({ customer, bookings, lifetimeValue, onUpdate }: CustomerDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (customer) {
      setEditName(customer.name);
      setEditEmail(customer.email || '');
      setEditPhone(customer.phone || '');
      setEditNotes(customer.notes || '');
    }
  }, [customer]);

  if (!customer) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md shadow-slate-900/5">
        <p className="text-xs sm:text-sm text-slate-500">Select a customer to see details.</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!onUpdate) return;
    await onUpdate(customer.id, {
      name: editName,
      email: editEmail || undefined,
      phone: editPhone || undefined,
      notes: editNotes || undefined,
    });
    setIsEditing(false);
  };

  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');
  const pendingBookings = bookings.filter((b) => b.status !== 'confirmed' && b.status !== 'cancelled');

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md shadow-slate-900/5">
      <header className="mb-3 sm:mb-4">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">Customer</p>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold break-words">{customer.name}</h2>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:border-slate-900 touch-manipulation"
            >
              Edit
            </button>
          )}
        </div>
      </header>

      <div className="space-y-2.5 sm:space-y-3">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white touch-manipulation active:scale-[0.98]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(customer.name);
                  setEditEmail(customer.email || '');
                  setEditPhone(customer.phone || '');
                  setEditNotes(customer.notes || '');
                }}
                className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 touch-manipulation active:scale-[0.98] hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-xs sm:text-sm shadow-sm shadow-slate-900/5">
              <p className="font-semibold mb-1.5 sm:mb-2">Contact Information</p>
              {customer.email && (
                <p className="text-slate-600 break-words">
                  <span className="text-slate-500">Email:</span> {customer.email}
                </p>
              )}
              {customer.phone && (
                <p className="text-slate-600 break-words">
                  <span className="text-slate-500">Phone:</span> {customer.phone}
                </p>
              )}
              {!customer.email && !customer.phone && (
                <p className="text-slate-400 italic">No contact information available.</p>
              )}
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-xs sm:text-sm shadow-sm shadow-slate-900/5">
              <p className="font-semibold mb-1.5 sm:mb-2">Statistics</p>
              <div className="space-y-1">
                <p className="text-slate-600">
                  <span className="text-slate-500">Total Bookings:</span> {bookings.length}
                </p>
                <p className="text-slate-600">
                  <span className="text-slate-500">Confirmed:</span> {confirmedBookings.length}
                </p>
                <p className="text-slate-600">
                  <span className="text-slate-500">Pending:</span> {pendingBookings.length}
                </p>
                <p className="text-slate-600">
                  <span className="text-slate-500">Cancelled:</span> {cancelledBookings.length}
                </p>
                <p className="text-slate-600 font-semibold">
                  <span className="text-slate-500">Lifetime Value:</span> ₱{lifetimeValue.toLocaleString('en-PH')}
                </p>
              </div>
            </div>

            {customer.notes && (
              <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-xs sm:text-sm shadow-sm shadow-slate-900/5">
                <p className="font-semibold mb-1.5 sm:mb-2">Notes</p>
                <p className="text-slate-600 whitespace-pre-wrap break-words">{customer.notes}</p>
              </div>
            )}

            {bookings.length > 0 && (
              <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-xs sm:text-sm shadow-sm shadow-slate-900/5">
                <p className="font-semibold mb-2">Recent Bookings</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {bookings.slice(0, 10).map((booking) => (
                    <div key={booking.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{booking.bookingId}</p>
                          {booking.serviceType && (
                            <p className="text-slate-500 text-[10px]">
                              {serviceLabels[booking.serviceType] ?? booking.serviceType}
                            </p>
                          )}
                          <p className="text-slate-400 text-[10px]">
                            {format(parseISO(booking.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-slate-500 flex-shrink-0">
                          {statusLabels[booking.status] || booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {bookings.length > 10 && (
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Showing 10 of {bookings.length} bookings
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

