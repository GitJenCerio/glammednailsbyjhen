import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { IoEyeOutline } from 'react-icons/io5';
import type { Slot } from '@/lib/types';

type MakeHiddenSlotsVisibleModalProps = {
  open: boolean;
  allSlots: Slot[];
  onClose: () => void;
  onConfirm: (month: string) => Promise<void>;
  isProcessing?: boolean;
};

export function MakeHiddenSlotsVisibleModal({
  open,
  allSlots,
  onClose,
  onConfirm,
  isProcessing = false,
}: MakeHiddenSlotsVisibleModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [hiddenSlotsCount, setHiddenSlotsCount] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setSelectedMonth('');
      setHiddenSlotsCount(0);
    }
  }, [open]);

  useEffect(() => {
    if (selectedMonth) {
      const count = allSlots.filter((slot) => {
        const slotMonth = slot.date.substring(0, 7); // YYYY-MM
        return slot.isHidden && slotMonth === selectedMonth;
      }).length;
      setHiddenSlotsCount(count);
    } else {
      setHiddenSlotsCount(0);
    }
  }, [selectedMonth, allSlots]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (!selectedMonth || hiddenSlotsCount === 0) return;
    await onConfirm(selectedMonth);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <IoEyeOutline className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">
              Make Hidden Slots Visible
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mb-4">
              Select a month to make all hidden slots visible for that month.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Choose a month...</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() + i);
                  const monthValue = format(date, 'yyyy-MM');
                  const monthLabel = format(date, 'MMMM yyyy');
                  return (
                    <option key={monthValue} value={monthValue}>
                      {monthLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedMonth && hiddenSlotsCount > 0 && (
              <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">{hiddenSlotsCount}</span> hidden slot(s) will be made visible for{' '}
                  <span className="font-semibold">{format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}</span>.
                </p>
              </div>
            )}

            {selectedMonth && hiddenSlotsCount === 0 && (
              <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
                <p className="text-sm text-slate-600">
                  No hidden slots found for {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || !selectedMonth || hiddenSlotsCount === 0}
            className="w-full sm:w-auto rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            {isProcessing ? 'Making visible...' : 'Make Visible'}
          </button>
        </div>
      </div>
    </div>
  );
}
