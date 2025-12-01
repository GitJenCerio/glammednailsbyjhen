import type { Slot } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';

type SlotCardProps = {
  slot: Slot;
  onEdit: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
};

export function SlotCard({ slot, onEdit, onDelete }: SlotCardProps) {
  const isConfirmed = slot.status === 'confirmed';

  const getStatusColor = () => {
    switch (slot.status) {
      case 'confirmed':
        return 'border-slate-700 bg-slate-50';
      case 'pending':
        return 'border-amber-300 bg-amber-50';
      case 'blocked':
        return 'border-rose-300 bg-rose-50';
      default:
        return 'border-emerald-300 bg-emerald-50';
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 rounded-xl sm:rounded-2xl border-2 ${getStatusColor()} p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-200`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm sm:text-base font-bold text-slate-900">{formatTime12Hour(slot.time)}</p>
          {slot.slotType === 'with_squeeze_fee' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-purple-200 text-purple-900 border border-purple-300">
              Squeeze-in Fee
            </span>
          )}
        </div>
        <p className="text-lg sm:text-xl font-extrabold capitalize mb-1">{slot.status}</p>
        {slot.notes && <p className="text-xs sm:text-sm text-slate-600 break-words font-medium">{slot.notes}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => !isConfirmed && onEdit(slot)}
          disabled={isConfirmed}
          className={`rounded-full border-2 px-4 py-2 text-xs sm:text-sm font-semibold touch-manipulation active:scale-95 transition-all ${
            isConfirmed
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
              : 'border-slate-400 bg-white text-slate-700 hover:border-slate-900 hover:bg-slate-50'
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => !isConfirmed && onDelete(slot)}
          disabled={isConfirmed}
          className={`rounded-full border-2 px-4 py-2 text-xs sm:text-sm font-semibold touch-manipulation active:scale-95 transition-all ${
            isConfirmed
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
              : 'border-rose-400 bg-white text-rose-700 hover:border-rose-700 hover:bg-rose-50'
          }`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

