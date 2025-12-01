'use client';

import { useState, useEffect } from 'react';
import type { Booking } from '@/lib/types';

type PaymentModalProps = {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
  onSubmit: (amountPaid: number) => Promise<void>;
};

export function PaymentModal({ open, booking, onClose, onSubmit }: PaymentModalProps) {
  const [amountPaid, setAmountPaid] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && booking) {
      setAmountPaid('');
      setError(null);
    }
  }, [open, booking]);

  if (!open || !booking) return null;

  const total = booking.invoice?.total || 0;
  const deposit = booking.depositAmount || 0;
  const balance = total - deposit;
  const paidAmount = booking.paidAmount || 0;
  const remainingBalance = balance - paidAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const amount = Number(amountPaid);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      setSaving(false);
      return;
    }

    try {
      await onSubmit(amount);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment.');
    } finally {
      setSaving(false);
    }
  };

  const handleFullPayment = () => {
    setAmountPaid(remainingBalance.toString());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="text-2xl font-semibold mb-2">Record Payment</h3>
        <p className="text-sm text-slate-500 mb-6">Enter the amount paid for this booking.</p>

        <div className="space-y-4 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Invoice Total:</span>
              <span className="font-semibold text-slate-900">₱{total.toLocaleString('en-PH')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Deposit:</span>
              <span className="font-semibold text-emerald-700">₱{deposit.toLocaleString('en-PH')}</span>
            </div>
            {paidAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Already Paid:</span>
                <span className="font-semibold text-slate-700">₱{paidAmount.toLocaleString('en-PH')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
              <span className="text-slate-700 font-semibold">Remaining Balance:</span>
              <span className="font-bold text-slate-900">₱{remainingBalance.toLocaleString('en-PH')}</span>
            </div>
          </div>

          <label className="block text-sm font-medium">
            Amount Paid (₱)
            <input
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              required
              autoFocus
              className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            />
          </label>

          {remainingBalance > 0 && (
            <button
              type="button"
              onClick={handleFullPayment}
              className="w-full rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              Pay Full Balance (₱{remainingBalance.toLocaleString('en-PH')})
            </button>
          )}

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          {amountPaid && !isNaN(Number(amountPaid)) && Number(amountPaid) > 0 && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">New Total Paid:</span>
                <span className="font-semibold text-slate-900">
                  ₱{((booking.paidAmount || 0) + Number(amountPaid)).toLocaleString('en-PH')}
                </span>
              </div>
              {Number(amountPaid) > remainingBalance && (
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                  <span className="text-emerald-600 font-medium">Tip Amount:</span>
                  <span className="font-bold text-emerald-700">
                    ₱{(Number(amountPaid) - remainingBalance).toLocaleString('en-PH')}
                  </span>
                </div>
              )}
              {Number(amountPaid) < remainingBalance && (
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                  <span className="text-amber-600 font-medium">New Balance:</span>
                  <span className="font-bold text-amber-700">
                    ₱{(remainingBalance - Number(amountPaid)).toLocaleString('en-PH')}
                  </span>
                </div>
              )}
              {Number(amountPaid) === remainingBalance && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-center">
                  <span className="text-emerald-600 font-semibold">✓ Payment will be fully paid</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-slate-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !amountPaid || isNaN(Number(amountPaid)) || Number(amountPaid) <= 0}
            className="rounded-full bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Processing...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}

