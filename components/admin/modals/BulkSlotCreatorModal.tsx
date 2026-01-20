'use client';

import { useState, useEffect } from 'react';
import type { SlotStatus } from '@/lib/types';
import { SLOT_TIMES, type SlotTime } from '@/lib/constants/slots';
import { format, addDays, eachDayOfInterval, getDay } from 'date-fns';
import { ErrorModal } from './ErrorModal';

type BulkSlotCreatorModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { date: string; time: string; status: SlotStatus; slotType?: 'regular' | 'with_squeeze_fee' | null; notes?: string }) => Promise<void>;
  defaultNailTechId?: string | null;
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
] as const;

type DayConfig = {
  days: number[]; // Array of day numbers (0-6)
  times: Set<SlotTime>;
  label: string;
};

export function BulkSlotCreatorModal({ open, onClose, onSubmit, defaultNailTechId }: BulkSlotCreatorModalProps) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [useWeeks, setUseWeeks] = useState(true);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([
    {
      days: [1, 2, 3, 4, 5, 6], // Monday - Saturday
      times: new Set<SlotTime>(),
      label: 'Monday - Saturday',
    },
    {
      days: [0], // Sunday
      times: new Set<SlotTime>(),
      label: 'Sunday',
    },
  ]);
  const [status, setStatus] = useState<SlotStatus>('available');
  const [slotType, setSlotType] = useState<'regular' | 'with_squeeze_fee'>('regular');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (open) {
      // Calculate end date based on weeks
      const start = new Date(startDate);
      const end = addDays(start, weeks * 7 - 1);
      setEndDate(format(end, 'yyyy-MM-dd'));
    }
  }, [open, startDate, weeks]);

  const getTimeLabel = (value: string) => {
    const [hourStr, minute] = value.split(':');
    let hour = Number(hourStr);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    if (hour === 0) hour = 12;
    if (hour > 12) hour -= 12;
    return `${hour}:${minute} ${suffix}`;
  };

  const toggleTime = (configIndex: number, timeValue: SlotTime) => {
    const newConfigs = [...dayConfigs];
    const newTimes = new Set(newConfigs[configIndex].times);
    if (newTimes.has(timeValue)) {
      newTimes.delete(timeValue);
    } else {
      newTimes.add(timeValue);
    }
    newConfigs[configIndex].times = newTimes;
    setDayConfigs(newConfigs);
  };

  const selectAllTimes = (configIndex: number) => {
    const newConfigs = [...dayConfigs];
    newConfigs[configIndex].times = new Set(SLOT_TIMES);
    setDayConfigs(newConfigs);
  };

  const clearAllTimes = (configIndex: number) => {
    const newConfigs = [...dayConfigs];
    newConfigs[configIndex].times = new Set();
    setDayConfigs(newConfigs);
  };

  const addDayConfig = () => {
    setDayConfigs([
      ...dayConfigs,
      {
        days: [],
        times: new Set<SlotTime>(),
        label: `Group ${dayConfigs.length + 1}`,
      },
    ]);
  };

  const removeDayConfig = (index: number) => {
    if (dayConfigs.length > 1) {
      setDayConfigs(dayConfigs.filter((_, i) => i !== index));
    }
  };

  const toggleDayInConfig = (configIndex: number, dayValue: number) => {
    const newConfigs = [...dayConfigs];
    const days = newConfigs[configIndex].days;
    const index = days.indexOf(dayValue);
    if (index > -1) {
      days.splice(index, 1);
    } else {
      days.push(dayValue);
      days.sort();
    }
    setDayConfigs(newConfigs);
  };

  const calculateTotalSlots = () => {
    if (!startDate || (!endDate && !useWeeks)) return 0;
    
    const start = new Date(startDate);
    const end = useWeeks ? addDays(start, weeks * 7 - 1) : new Date(endDate);
    const dates = eachDayOfInterval({ start, end });
    
    let total = 0;
    dates.forEach((date) => {
      const dayOfWeek = getDay(date);
      const config = dayConfigs.find((c) => c.days.includes(dayOfWeek));
      if (config) {
        total += config.times.size;
      }
    });
    return total;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!startDate || (!endDate && !useWeeks)) {
      setError('Please select a date range.');
      return;
    }

    // Validate that all day configs have at least one day and one time
    for (const config of dayConfigs) {
      if (config.days.length === 0) {
        setError(`Please select at least one day for "${config.label}".`);
        return;
      }
      if (config.times.size === 0) {
        setError(`Please select at least one time slot for "${config.label}".`);
        return;
      }
    }

    const start = new Date(startDate);
    const end = useWeeks ? addDays(start, weeks * 7 - 1) : new Date(endDate);
    const dates = eachDayOfInterval({ start, end });
    
    const slotsToCreate: Array<{ date: string; time: SlotTime }> = [];
    
    dates.forEach((date) => {
      const dayOfWeek = getDay(date);
      const config = dayConfigs.find((c) => c.days.includes(dayOfWeek));
      if (config) {
        config.times.forEach((time) => {
          slotsToCreate.push({
            date: format(date, 'yyyy-MM-dd'),
            time,
          });
        });
      }
    });

    if (slotsToCreate.length === 0) {
      setError('No slots to create. Please check your day and time selections.');
      return;
    }

    setSaving(true);
    setError(null);
    setProgress({ current: 0, total: slotsToCreate.length });

    try {
      for (let i = 0; i < slotsToCreate.length; i++) {
        const slot = slotsToCreate[i];
        await onSubmit({
          date: slot.date,
          time: slot.time,
          status,
          slotType,
          notes,
        });
        setProgress({ current: i + 1, total: slotsToCreate.length });
      }
      onClose();
    } catch (err: any) {
      const errorMsg = err.message ?? 'Unable to create slots.';
      setError(`${errorMsg} ${progress.current} of ${slotsToCreate.length} slots may have been created.`);
    } finally {
      setSaving(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  if (!open) return null;

  const totalSlots = calculateTotalSlots();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="w-full max-w-4xl rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-xl my-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl sm:text-2xl font-semibold mb-2">Bulk Create Slots</h3>
        <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">
          Create slots for multiple days with different time configurations per day group.
        </p>

        <div className="space-y-4 sm:space-y-6">
          {/* Date Range Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                required
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">
                {useWeeks ? 'Number of Weeks' : 'End Date'}
              </label>
              {useWeeks ? (
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={weeks}
                  onChange={(e) => setWeeks(Number(e.target.value))}
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
                />
              ) : (
                <input
                  type="date"
                  value={endDate}
                  required={!useWeeks}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
                />
              )}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useWeeks}
                onChange={(e) => setUseWeeks(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-xs sm:text-sm">Use number of weeks instead of end date</span>
            </label>
          </div>

          {/* Day Configurations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-medium">Day Groups & Time Slots</label>
              <button
                type="button"
                onClick={addDayConfig}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add Day Group
              </button>
            </div>

            {dayConfigs.map((config, configIndex) => (
              <div key={configIndex} className="border-2 border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={config.label}
                      onChange={(e) => {
                        const newConfigs = [...dayConfigs];
                        newConfigs[configIndex].label = e.target.value;
                        setDayConfigs(newConfigs);
                      }}
                      placeholder="Group name (e.g., Monday - Saturday)"
                      className="text-base sm:text-sm font-medium border-b-2 border-slate-300 focus:border-slate-900 focus:outline-none px-1 py-1 w-full max-w-xs"
                    />
                  </div>
                  {dayConfigs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDayConfig(configIndex)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Day Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2">Select Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <label
                        key={day.value}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 cursor-pointer transition ${
                          config.days.includes(day.value)
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={config.days.includes(day.value)}
                          onChange={() => toggleDayInConfig(configIndex, day.value)}
                          className="sr-only"
                        />
                        <span className="text-xs sm:text-sm font-medium">{day.short}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Time Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs sm:text-sm font-medium">Time Slots</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllTimes(configIndex)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => clearAllTimes(configIndex)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {SLOT_TIMES.map((timeValue) => (
                      <label
                        key={timeValue}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={config.times.has(timeValue)}
                          onChange={() => toggleTime(configIndex, timeValue)}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 focus:ring-2"
                        />
                        <span className="text-xs sm:text-sm">{getTimeLabel(timeValue)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Common Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs sm:text-sm font-medium">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SlotStatus)}
                className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
              >
                <option value="available">Available</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="blocked">Blocked</option>
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
          </div>

          <label className="block text-xs sm:text-sm font-medium">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 text-base sm:text-sm"
              rows={2}
            />
          </label>

          {/* Summary */}
          {totalSlots > 0 && (
            <div className="rounded-xl bg-blue-50 border-2 border-blue-200 p-3">
              <p className="text-xs sm:text-sm font-semibold text-blue-900">
                Will create <strong>{totalSlots} slot(s)</strong> across the selected date range.
              </p>
            </div>
          )}

          {/* Progress */}
          {saving && progress.total > 0 && (
            <div className="rounded-xl bg-slate-100 border-2 border-slate-300 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs sm:text-sm font-medium text-slate-900">
                  Creating slots...
                </p>
                <p className="text-xs sm:text-sm text-slate-600">
                  {progress.current} / {progress.total}
                </p>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-slate-900 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto rounded-full border border-slate-200 px-4 py-2 text-xs sm:text-sm font-semibold hover:border-slate-900 touch-manipulation disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || totalSlots === 0}
            className="w-full sm:w-auto rounded-full bg-slate-900 px-6 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-50 touch-manipulation"
          >
            {saving
              ? `Creating ${progress.current}/${progress.total}...`
              : totalSlots > 0
                ? `Create ${totalSlots} slot(s)`
                : 'Create slots'}
          </button>
        </div>
      </form>

      <ErrorModal
        open={!!error}
        title="Cannot Create Slots"
        message={error || ''}
        onClose={() => setError(null)}
      />
    </div>
  );
}

