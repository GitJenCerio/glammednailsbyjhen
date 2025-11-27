import { useEffect, useState } from 'react';
import type { Slot, SlotStatus } from '@/lib/types';
import { SLOT_TIMES, type SlotTime } from '@/lib/constants/slots';

type SlotEditorModalProps = {
  open: boolean;
  slot?: Slot | null;
  defaultDate?: string | null;
  onClose: () => void;
  onSubmit: (payload: { date: string; time: string; status: SlotStatus; slotType?: 'regular' | 'with_squeeze_fee' | null; notes?: string }) => Promise<void>;
};

const statuses: SlotStatus[] = ['available', 'pending', 'confirmed', 'blocked'];

export function SlotEditorModal({ open, slot, defaultDate, onClose, onSubmit }: SlotEditorModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState<SlotTime>(SLOT_TIMES[0]);
  const [status, setStatus] = useState<SlotStatus>('available');
  const [slotType, setSlotType] = useState<'regular' | 'with_squeeze_fee'>('regular');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slot) {
      setDate(slot.date);
      setTime(slot.time as SlotTime);
      setStatus(slot.status);
      setSlotType(slot.slotType ?? 'regular');
      setNotes(slot.notes ?? '');
    } else if (defaultDate) {
      setDate(defaultDate);
      setTime(SLOT_TIMES[0]);
      setStatus('available');
      setSlotType('regular');
      setNotes('');
    }
  }, [slot, defaultDate, open]);

  const getTimeLabel = (value: string) => {
    const [hourStr, minute] = value.split(':');
    let hour = Number(hourStr);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    if (hour === 0) hour = 12;
    if (hour > 12) hour -= 12;
    return `${hour}:${minute} ${suffix}`;
  };

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ date, time, status, slotType, notes });
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Unable to save slot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-xl my-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl sm:text-2xl font-semibold">{slot ? 'Edit slot' : 'Create slot'}</h3>
        <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">Slots cannot overlap blocked ranges.</p>

        <div className="space-y-3 sm:space-y-4">
          <label className="block text-xs sm:text-sm font-medium">
            Date
            <input
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:text-base"
            />
          </label>

          <label className="block text-xs sm:text-sm font-medium">
            Time
            <select
              value={time}
              onChange={(e) => setTime(e.target.value as SlotTime)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:text-base"
              required
            >
              {SLOT_TIMES.map((value) => (
                <option key={value} value={value}>
                  {getTimeLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs sm:text-sm font-medium">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SlotStatus)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:text-base"
            >
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs sm:text-sm font-medium">
            Type
            <select
              value={slotType}
              onChange={(e) => setSlotType(e.target.value as 'regular' | 'with_squeeze_fee')}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:text-base"
            >
              <option value="regular">Regular</option>
              <option value="with_squeeze_fee">With Squeeze in fee</option>
            </select>
          </label>

          <label className="block text-xs sm:text-sm font-medium">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:text-base"
              rows={3}
            />
          </label>
        </div>

        {error && <p className="mt-4 rounded-xl sm:rounded-2xl bg-rose-50 px-3 py-2 text-xs sm:text-sm text-rose-600">{error}</p>}

        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-full border border-slate-200 px-4 py-2 text-xs sm:text-sm font-semibold hover:border-slate-900 touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto rounded-full bg-slate-900 px-6 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-50 touch-manipulation"
          >
            {saving ? 'Saving...' : 'Save slot'}
          </button>
        </div>
      </form>
    </div>
  );
}

