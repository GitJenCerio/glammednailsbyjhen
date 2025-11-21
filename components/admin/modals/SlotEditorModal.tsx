import { useEffect, useState } from 'react';
import type { Slot, SlotStatus } from '@/lib/types';
import { SLOT_TIMES, type SlotTime } from '@/lib/constants/slots';

type SlotEditorModalProps = {
  open: boolean;
  slot?: Slot | null;
  defaultDate?: string | null;
  onClose: () => void;
  onSubmit: (payload: { date: string; time: string; status: SlotStatus; notes?: string }) => Promise<void>;
};

const statuses: SlotStatus[] = ['available', 'pending', 'confirmed', 'blocked'];

export function SlotEditorModal({ open, slot, defaultDate, onClose, onSubmit }: SlotEditorModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState<SlotTime>(SLOT_TIMES[0]);
  const [status, setStatus] = useState<SlotStatus>('available');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slot) {
      setDate(slot.date);
      setTime(slot.time as SlotTime);
      setStatus(slot.status);
      setNotes(slot.notes ?? '');
    } else if (defaultDate) {
      setDate(defaultDate);
      setTime(SLOT_TIMES[0]);
      setStatus('available');
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
      await onSubmit({ date, time, status, notes });
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Unable to save slot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="text-2xl font-semibold">{slot ? 'Edit slot' : 'Create slot'}</h3>
        <p className="text-sm text-slate-500 mb-6">Slots cannot overlap blocked ranges.</p>

        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Date
            <input
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm font-medium">
            Time
            <select
              value={time}
              onChange={(e) => setTime(e.target.value as SlotTime)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
              required
            >
              {SLOT_TIMES.map((value) => (
                <option key={value} value={value}>
                  {getTimeLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SlotStatus)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            >
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
              rows={3}
            />
          </label>
        </div>

        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-slate-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save slot'}
          </button>
        </div>
      </form>
    </div>
  );
}

