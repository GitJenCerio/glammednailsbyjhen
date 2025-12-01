import type { Slot } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';

type SlotCardProps = {
  slot: Slot;
  onEdit: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
};

export function SlotCard({ slot, onEdit, onDelete }: SlotCardProps) {
  const isConfirmed = slot.status === 'confirmed';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-shadow duration-200">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs sm:text-sm text-slate-500">{formatTime12Hour(slot.time)}</p>
          {slot.slotType === 'with_squeeze_fee' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-purple-100 text-purple-800">
              Squeeze-in Fee
            </span>
          )}
        </div>
        <p className="text-base sm:text-lg font-semibold capitalize">{slot.status}</p>
        {slot.notes && <p className="text-xs sm:text-sm text-slate-500 break-words">{slot.notes}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => !isConfirmed && onEdit(slot)}
          disabled={isConfirmed}
          className={`rounded-full border px-3 py-1.5 sm:py-1 text-xs font-semibold touch-manipulation active:scale-95 ${
            isConfirmed
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
              : 'border-slate-300 hover:border-slate-900'
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => !isConfirmed && onDelete(slot)}
          disabled={isConfirmed}
          className={`rounded-full border px-3 py-1.5 sm:py-1 text-xs font-semibold touch-manipulation active:scale-95 ${
            isConfirmed
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
              : 'border-rose-300 text-rose-600 hover:border-rose-700'
          }`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

