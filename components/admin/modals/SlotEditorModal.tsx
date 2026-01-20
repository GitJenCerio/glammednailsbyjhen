import { useEffect, useState } from 'react';
import type { Slot, SlotStatus } from '@/lib/types';
import { SLOT_TIMES, type SlotTime } from '@/lib/constants/slots';
import { ErrorModal } from './ErrorModal';

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
  const [selectedTimes, setSelectedTimes] = useState<Set<SlotTime>>(new Set());
  const [status, setStatus] = useState<SlotStatus>('available');
  const [slotType, setSlotType] = useState<'regular' | 'with_squeeze_fee'>('regular');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!slot;

  useEffect(() => {
    if (open) {
      setError(null); // Clear error when modal opens
      if (slot) {
        setDate(slot.date);
        setTime(slot.time as SlotTime);
        setSelectedTimes(new Set([slot.time as SlotTime]));
        setStatus(slot.status);
        setSlotType(slot.slotType ?? 'regular');
        setNotes(slot.notes ?? '');
      } else if (defaultDate) {
        setDate(defaultDate);
        setTime(SLOT_TIMES[0]);
        setSelectedTimes(new Set());
        setStatus('available');
        setSlotType('regular');
        setNotes('');
      }
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

  const toggleTime = (timeValue: SlotTime) => {
    const newSelected = new Set(selectedTimes);
    if (newSelected.has(timeValue)) {
      newSelected.delete(timeValue);
    } else {
      newSelected.add(timeValue);
    }
    setSelectedTimes(newSelected);
  };

  const selectAllTimes = () => {
    setSelectedTimes(new Set(SLOT_TIMES));
  };

  const clearAllTimes = () => {
    setSelectedTimes(new Set());
  };

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // When editing, use single time. When creating, use selected times
    const timesToCreate = isEditing ? [time] : Array.from(selectedTimes);
    
    if (timesToCreate.length === 0) {
      setError('Please select at least one time slot.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Create slots sequentially for each selected time
      for (const timeValue of timesToCreate) {
        await onSubmit({ date, time: timeValue, status, slotType, notes });
      }
      onClose();
    } catch (err: any) {
      const errorMsg = err.message ?? 'Unable to save slot(s).';
      setError(timesToCreate.length > 1 
        ? `${errorMsg} Some slots may have been created successfully.`
        : errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-xl my-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl sm:text-2xl font-semibold">{slot ? 'Edit slot' : 'Create slot(s)'}</h3>
        <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">
          {isEditing 
            ? 'Slots cannot overlap blocked ranges.'
            : 'Select one or more time slots to create. Slots cannot overlap blocked ranges.'}
        </p>

        <div className="space-y-3 sm:space-y-4">
          <label className="block text-xs sm:text-sm font-medium">
            Date
            <input
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
            />
          </label>

          {isEditing ? (
            <label className="block text-xs sm:text-sm font-medium">
              Time
              <select
                value={time}
                onChange={(e) => setTime(e.target.value as SlotTime)}
                className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
                required
              >
                {SLOT_TIMES.map((value) => (
                  <option key={value} value={value}>
                    {getTimeLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="block text-xs sm:text-sm font-medium">
              <div className="flex items-center justify-between mb-2">
                <label>Time Slots (Select one or more)</label>
                {selectedTimes.size > 0 && (
                  <span className="text-xs text-slate-500">
                    {selectedTimes.size} selected
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-2 max-h-48 overflow-y-auto rounded-xl sm:rounded-2xl border border-slate-200 p-2">
                <div className="flex gap-2 pb-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={selectAllTimes}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={clearAllTimes}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Clear All
                  </button>
                </div>
                {SLOT_TIMES.map((timeValue) => (
                  <label
                    key={timeValue}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTimes.has(timeValue)}
                      onChange={() => toggleTime(timeValue)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 focus:ring-2"
                    />
                    <span className="text-sm sm:text-base">{getTimeLabel(timeValue)}</span>
                  </label>
                ))}
              </div>
              {selectedTimes.size === 0 && (
                <p className="mt-1 text-xs text-rose-600">Please select at least one time slot</p>
              )}
            </div>
          )}

          <label className="block text-xs sm:text-sm font-medium">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SlotStatus)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
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
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
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
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
              rows={3}
            />
          </label>
        </div>

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
            disabled={saving || (!isEditing && selectedTimes.size === 0)}
            className="w-full sm:w-auto rounded-full bg-slate-900 px-6 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-50 touch-manipulation"
          >
            {saving 
              ? (isEditing ? 'Saving...' : `Creating ${selectedTimes.size} slot(s)...`)
              : isEditing 
                ? 'Save slot'
                : selectedTimes.size > 0 
                  ? `Create ${selectedTimes.size} slot(s)`
                  : 'Create slot(s)'}
          </button>
        </div>
      </form>

      <ErrorModal
        open={!!error}
        title="Cannot Create Slot"
        message={error || ''}
        onClose={() => setError(null)}
      />
    </div>
  );
}

