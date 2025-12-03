'use client';

import type { TimeRange } from '@/lib/analytics';

interface TimeFilterTabsProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeFilterTabs({ value, onChange }: TimeFilterTabsProps) {
  const options: { value: TimeRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
  ];

  return (
    <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
            value === option.value
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

