'use client';

import { useState, useEffect } from 'react';
import type { Customer, Booking } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { IoCalendarOutline, IoTrashOutline } from 'react-icons/io5';

type CustomerDetailPanelProps = {
  customer: Customer | null;
  bookings: Booking[];
  lifetimeValue: number;
  onUpdate?: (customerId: string, updates: Partial<Customer>) => Promise<void>;
  onBookSlot?: (customer: Customer) => void;
  onDelete?: (customerId: string, hasBookings?: boolean) => Promise<void>;
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

export function CustomerDetailPanel({ customer, bookings, lifetimeValue, onUpdate, onBookSlot, onDelete }: CustomerDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSocialMediaName, setEditSocialMediaName] = useState('');
  const [editReferralSource, setEditReferralSource] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (customer) {
      setEditName(customer.name);
      setEditFirstName(customer.firstName || '');
      setEditLastName(customer.lastName || '');
      setEditEmail(customer.email || '');
      setEditPhone(customer.phone || '');
      setEditSocialMediaName(customer.socialMediaName || '');
      setEditReferralSource(customer.referralSource || '');
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
      firstName: editFirstName || undefined,
      lastName: editLastName || undefined,
      email: editEmail || undefined,
      phone: editPhone || undefined,
      socialMediaName: editSocialMediaName || undefined,
      referralSource: editReferralSource || undefined,
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
            <div className="flex gap-2">
              {onBookSlot && (
                <button
                  type="button"
                  onClick={() => onBookSlot(customer)}
                  className="rounded-full bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-700 touch-manipulation flex items-center gap-1.5"
                >
                  <IoCalendarOutline className="w-4 h-4" />
                  Book Slot
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:border-slate-900 touch-manipulation"
              >
                Edit
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={async () => {
                    let confirmMessage = `Are you sure you want to delete ${customer.name}? This action cannot be undone.`;
                    
                    if (bookings.length > 0) {
                      confirmMessage = `WARNING: This customer has ${bookings.length} booking(s). Deleting will remove the customer record, but the bookings will remain in the system (they will show as having no customer).\n\nAre you sure you want to delete ${customer.name} anyway?`;
                    }
                    
                    if (confirm(confirmMessage)) {
                      try {
                        await onDelete(customer.id, bookings.length > 0);
                      } catch (error: any) {
                        alert(error.message || 'Failed to delete customer.');
                      }
                    }
                  }}
                  className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 hover:border-red-400 touch-manipulation flex items-center gap-1.5"
                >
                  <IoTrashOutline className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="space-y-2.5 sm:space-y-3">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Number</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Phone number(s)"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">FB Name / Instagram Name</label>
              <input
                type="text"
                value={editSocialMediaName}
                onChange={(e) => setEditSocialMediaName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Social media handle"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">How did you find out about glammednailsbyjhen?</label>
              <input
                type="text"
                value={editReferralSource}
                onChange={(e) => setEditReferralSource(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Referral source"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                  setEditFirstName(customer.firstName || '');
                  setEditLastName(customer.lastName || '');
                  setEditEmail(customer.email || '');
                  setEditPhone(customer.phone || '');
                  setEditSocialMediaName(customer.socialMediaName || '');
                  setEditReferralSource(customer.referralSource || '');
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
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <p className="font-semibold">Personal Information</p>
              </div>
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-slate-600">
                    <span className="text-slate-500">First Name:</span>{' '}
                    {customer.firstName || <span className="text-slate-400 italic">Not provided</span>}
                  </p>
                  <p className="text-slate-600">
                    <span className="text-slate-500">Last Name:</span>{' '}
                    {customer.lastName || <span className="text-slate-400 italic">Not provided</span>}
                  </p>
                </div>
                <p className="text-slate-600 break-words">
                  <span className="text-slate-500">Email:</span>{' '}
                  {customer.email || <span className="text-slate-400 italic">Not provided</span>}
                </p>
                <p className="text-slate-600 break-words">
                  <span className="text-slate-500">Contact Number:</span>{' '}
                  {customer.phone || <span className="text-slate-400 italic">Not provided</span>}
                </p>
                <p className="text-slate-600 break-words">
                  <span className="text-slate-500">FB/Instagram Name:</span>{' '}
                  {customer.socialMediaName || <span className="text-slate-400 italic">Not provided</span>}
                </p>
                <p className="text-slate-600 break-words">
                  <span className="text-slate-500">How found us:</span>{' '}
                  {customer.referralSource || <span className="text-slate-400 italic">Not provided</span>}
                </p>
              </div>
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

