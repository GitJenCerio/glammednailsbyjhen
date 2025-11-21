import { useEffect, useState } from 'react';
import type { BlockedDate } from '@/lib/types';

type BlockDateModalProps = {
  open: boolean;
  initialStart?: string | null;
  initialEnd?: string | null;
  onClose: () => void;
  onSubmit: (payload: { startDate: string; endDate: string; scope: BlockedDate['scope']; reason?: string }) => Promise<void>;
};

const scopes: BlockedDate['scope'][] = ['single', 'range', 'month'];

export function BlockDateModal({ open, initialEnd, initialStart, onClose, onSubmit }: BlockDateModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scope, setScope] = useState<BlockedDate['scope']>('range');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStart) setStartDate(initialStart);
    if (initialEnd) setEndDate(initialEnd);
    if (open) {
      setScope(initialStart && initialEnd && initialStart === initialEnd ? 'single' : 'range');
      setReason('');
    }
  }, [initialStart, initialEnd, open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        startDate,
        endDate: endDate || startDate,
        scope,
        reason,
      });
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Unable to block dates.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="text-2xl font-semibold">Block dates</h3>
        <p className="text-sm text-slate-500 mb-6">Blocked dates instantly hide slots on the customer site.</p>

        <div className="grid grid-cols-1 gap-4">
          <label className="block text-sm font-medium">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm font-medium">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm font-medium">
            Scope
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as BlockedDate['scope'])}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            >
              {scopes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Reason (optional)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
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
            className="rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Blocking...' : 'Block dates'}
          </button>
        </div>
      </form>
    </div>
  );
}

