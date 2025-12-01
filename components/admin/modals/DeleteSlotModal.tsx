import type { Slot } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';

type DeleteSlotModalProps = {
  open: boolean;
  slot: Slot | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
};

export function DeleteSlotModal({ open, slot, onClose, onConfirm, isDeleting = false }: DeleteSlotModalProps) {
  if (!open || !slot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-rose-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">Delete Slot</h3>
            <p className="text-sm sm:text-base text-slate-600 mb-4">
              Are you sure you want to delete this slot?
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-4">
              <div className="text-xs sm:text-sm text-slate-600 space-y-1">
                <p>
                  <span className="font-semibold">Date:</span> {slot.date}
                </p>
                <p>
                  <span className="font-semibold">Time:</span> {formatTime12Hour(slot.time)}
                </p>
                <p>
                  <span className="font-semibold">Status:</span> <span className="capitalize">{slot.status}</span>
                </p>
                {slot.notes && (
                  <p>
                    <span className="font-semibold">Notes:</span> {slot.notes}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-rose-600 font-medium">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-auto rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full sm:w-auto rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            {isDeleting ? 'Deleting...' : 'Delete Slot'}
          </button>
        </div>
      </div>
    </div>
  );
}

