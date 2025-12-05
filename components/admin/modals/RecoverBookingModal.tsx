'use client';

import { useState } from 'react';

type RecoverBookingModalProps = {
  open: boolean;
  onClose: () => void;
  onRecover: (bookingId: string) => Promise<void>;
};

export function RecoverBookingModal({ open, onClose, onRecover }: RecoverBookingModalProps) {
  const [bookingId, setBookingId] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  async function handleRecover() {
    if (!bookingId.trim()) {
      setError('Please enter a booking ID');
      return;
    }

    setRecovering(true);
    setError(null);
    setSuccess(null);

    try {
      await onRecover(bookingId.trim());
      setSuccess(`Booking ${bookingId.trim()} has been recovered successfully!`);
      setBookingId('');
      // Close after 2 seconds
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to recover booking');
    } finally {
      setRecovering(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Recover Expired Booking</h2>
            <p className="text-sm text-slate-600 mt-1">
              Recover a booking from Google Sheets form data
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            disabled={recovering}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Booking ID
              </label>
              <input
                type="text"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="GN-00001 or GN00001"
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                disabled={recovering}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !recovering) {
                    handleRecover();
                  }
                }}
              />
              <p className="mt-1 text-xs text-slate-500">
                Enter the booking ID (e.g., GN-00001) to recover from Google Sheets
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            disabled={recovering}
          >
            Cancel
          </button>
          <button
            onClick={handleRecover}
            disabled={recovering || !bookingId.trim()}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {recovering ? 'Recovering...' : 'Recover Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

