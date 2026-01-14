'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { BookingWithSlot } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';

type ReleaseSlotsModalProps = {
  open: boolean;
  onClose: () => void;
  onRelease: (bookingIds: string[]) => Promise<void>;
};

export function ReleaseSlotsModal({ open, onClose, onRelease }: ReleaseSlotsModalProps) {
  const [eligibleBookings, setEligibleBookings] = useState<BookingWithSlot[]>([]);
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadEligibleBookings();
      setSelectedBookingIds(new Set());
      setError(null);
    }
  }, [open]);

  async function loadEligibleBookings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings/release');
      const data = await res.json();
      if (res.ok) {
        setEligibleBookings(data.bookings || []);
      } else {
        setError(data.error || 'Failed to load eligible bookings');
      }
    } catch (err) {
      setError('Failed to load eligible bookings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleBooking(bookingId: string) {
    const newSelected = new Set(selectedBookingIds);
    if (newSelected.has(bookingId)) {
      newSelected.delete(bookingId);
    } else {
      newSelected.add(bookingId);
    }
    setSelectedBookingIds(newSelected);
  }

  function selectAll() {
    if (selectedBookingIds.size === eligibleBookings.length) {
      setSelectedBookingIds(new Set());
    } else {
      setSelectedBookingIds(new Set(eligibleBookings.map(b => b.id)));
    }
  }

  async function handleRelease() {
    if (selectedBookingIds.size === 0) {
      setError('Please select at least one booking to release');
      return;
    }

    setReleasing(true);
    setError(null);
    try {
      await onRelease(Array.from(selectedBookingIds));
      await loadEligibleBookings();
      setSelectedBookingIds(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to release bookings');
    } finally {
      setReleasing(false);
    }
  }

  if (!open) return null;

  const getTimeAgo = (createdAt: string) => {
    const created = parseISO(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ago`;
    }
    return `${diffMinutes}m ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Release Slots</h2>
            <p className="text-sm text-slate-600 mt-1">
              Select bookings to release (no form received)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            disabled={releasing}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
            </div>
          ) : error && !eligibleBookings.length ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={loadEligibleBookings}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Retry
              </button>
            </div>
          ) : eligibleBookings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600">No bookings eligible for release</p>
              <p className="text-sm text-slate-500 mt-2">
                All pending bookings have forms synced
              </p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={selectAll}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  {selectedBookingIds.size === eligibleBookings.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-slate-600">
                  {selectedBookingIds.size} of {eligibleBookings.length} selected
                </span>
              </div>

              {/* Bookings List */}
              <div className="space-y-2">
                {eligibleBookings.map((booking) => {
                  const isSelected = selectedBookingIds.has(booking.id);
                  const slot = booking.slot;
                  // Safely parse date - check if it's a valid date string
                  let slotDate = 'N/A';
                  if (slot && slot.date && slot.date !== 'N/A' && slot.date.trim() !== '') {
                    try {
                      const parsedDate = parseISO(slot.date);
                      // Check if the parsed date is valid
                      if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
                        slotDate = format(parsedDate, 'MMM d, yyyy');
                      }
                    } catch (e) {
                      // If parsing fails, use 'N/A'
                      slotDate = 'N/A';
                    }
                  }
                  const slotTime = slot && slot.time && slot.time !== 'N/A' ? formatTime12Hour(slot.time) : 'N/A';
                  
                  return (
                    <label
                      key={booking.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                        isSelected
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleBooking(booking.id)}
                        className="mt-1 h-4 w-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-900">{booking.bookingId}</span>
                              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                                {booking.serviceType || 'N/A'}
                              </span>
                            </div>
                            <div className="text-sm text-slate-600 space-y-1">
                              <p>Created: {getTimeAgo(booking.createdAt)}</p>
                              <p>Slot: {slotDate} at {slotTime}</p>
                            </div>
                          </div>
                          <div className="text-right text-sm text-slate-500">
                            <p>No form synced</p>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          {error && eligibleBookings.length > 0 && (
            <p className="flex-1 text-sm text-red-600">{error}</p>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            disabled={releasing}
          >
            Cancel
          </button>
          <button
            onClick={handleRelease}
            disabled={releasing || selectedBookingIds.size === 0}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {releasing ? 'Releasing...' : `Release ${selectedBookingIds.size} Slot${selectedBookingIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

