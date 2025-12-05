import { useState, useEffect } from 'react';
import type { Slot } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';
import { IoTrashOutline } from 'react-icons/io5';
import { format } from 'date-fns';

type DeleteDaySlotsModalProps = {
  open: boolean;
  date: string | null;
  slots: Slot[];
  onClose: () => void;
  onConfirm: (onlyAvailable: boolean) => Promise<void>;
};

export function DeleteDaySlotsModal({ open, date, slots, onConfirm, onClose }: DeleteDaySlotsModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  useEffect(() => {
    if (open) {
      setIsDeleting(false);
      setOnlyAvailable(false);
    }
  }, [open]);

  if (!open || !date) return null;

  const slotsToDelete = onlyAvailable 
    ? slots.filter(s => s.status === 'available')
    : slots;

  const bookedSlots = slots.filter(s => s.status === 'confirmed' || s.status === 'pending');
  const availableSlots = slots.filter(s => s.status === 'available');

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(onlyAvailable);
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedDate = date ? format(new Date(date), 'EEEE, MMMM d, yyyy') : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
              <IoTrashOutline className="w-6 h-6 text-rose-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">Delete All Slots</h3>
            <p className="text-sm sm:text-base text-slate-600 mb-4">
              Delete all slots for this day?
            </p>
            
            <div className="bg-slate-50 rounded-xl p-3 mb-4">
              <div className="text-xs sm:text-sm text-slate-600 space-y-2">
                <p>
                  <span className="font-semibold">Date:</span> {formattedDate}
                </p>
                <p>
                  <span className="font-semibold">Total slots:</span> {slots.length}
                </p>
                {bookedSlots.length > 0 && (
                  <p className="text-amber-700">
                    <span className="font-semibold">Booked/Pending:</span> {bookedSlots.length} slot(s)
                  </p>
                )}
                {availableSlots.length > 0 && (
                  <p className="text-emerald-700">
                    <span className="font-semibold">Available:</span> {availableSlots.length} slot(s)
                  </p>
                )}
              </div>
            </div>

            {bookedSlots.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                    disabled={isDeleting}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 focus:ring-2"
                  />
                  <span className="text-xs sm:text-sm text-amber-800">
                    Only delete available slots (keep {bookedSlots.length} booked/pending slot(s))
                  </span>
                </label>
              </div>
            )}

            {slotsToDelete.length > 0 && (
              <div className="mb-4 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-700 mb-2">Slots to be deleted:</p>
                <div className="space-y-1">
                  {slotsToDelete.slice(0, 5).map((slot) => (
                    <div key={slot.id} className="text-xs text-slate-600 flex items-center justify-between bg-white p-2 rounded">
                      <span>{formatTime12Hour(slot.time)}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                        slot.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                        slot.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {slot.status}
                      </span>
                    </div>
                  ))}
                  {slotsToDelete.length > 5 && (
                    <p className="text-xs text-slate-500 text-center pt-1">
                      ...and {slotsToDelete.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

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
            onClick={handleConfirm}
            disabled={isDeleting || slotsToDelete.length === 0}
            className="w-full sm:w-auto rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            {isDeleting 
              ? `Deleting ${slotsToDelete.length} slot(s)...`
              : `Delete ${slotsToDelete.length} slot(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
