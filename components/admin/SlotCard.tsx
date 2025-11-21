import type { Slot } from '@/lib/types';

type SlotCardProps = {
  slot: Slot;
  onEdit: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
};

export function SlotCard({ slot, onEdit, onDelete }: SlotCardProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
      <div>
        <p className="text-sm text-slate-500">{slot.time}</p>
        <p className="text-lg font-semibold capitalize">{slot.status}</p>
        {slot.notes && <p className="text-sm text-slate-500">{slot.notes}</p>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(slot)}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold hover:border-slate-900"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(slot)}
          className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

