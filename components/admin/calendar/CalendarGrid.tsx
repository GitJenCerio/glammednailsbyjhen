import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import type { BlockedDate, Slot } from '@/lib/types';
import { isDateWithinBlockedRange } from '@/lib/scheduling';

type CalendarGridProps = {
  referenceDate: Date;
  slots: Slot[];
  blockedDates: BlockedDate[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onChangeMonth: (newDate: Date) => void;
};

export function CalendarGrid({
  referenceDate,
  slots,
  blockedDates,
  selectedDate,
  onSelectDate,
  onChangeMonth,
}: CalendarGridProps) {
  const start = startOfWeek(startOfMonth(referenceDate), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(referenceDate), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getDayMeta = (date: Date) => {
    const isoDate = format(date, 'yyyy-MM-dd');
    const daySlots = slots.filter((slot) => slot.date === isoDate);
    const isBlocked = blockedDates.some((block) => isDateWithinBlockedRange(isoDate, block));
    const availableCount = daySlots.filter((slot) => slot.status === 'available').length;
    const pendingCount = daySlots.filter((slot) => slot.status === 'pending').length;
    const confirmedCount = daySlots.filter((slot) => slot.status === 'confirmed').length;

    let badgeColor = 'bg-slate-200 text-slate-700';
    if (isBlocked) badgeColor = 'bg-rose-200 text-rose-800';
    else if (confirmedCount) badgeColor = 'bg-slate-900 text-white';
    else if (pendingCount) badgeColor = 'bg-amber-200 text-amber-900';
    else if (availableCount) badgeColor = 'bg-emerald-100 text-emerald-700';

    const label = isBlocked
      ? 'Blocked'
      : confirmedCount
        ? `${confirmedCount} confirmed`
        : pendingCount
          ? `${pendingCount} pending`
          : availableCount
            ? `${availableCount} available`
            : null;

    return { isBlocked, label, badgeColor, isoDate };
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Calendar</p>
          <h2 className="text-2xl font-semibold">{format(referenceDate, 'MMMM yyyy')}</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChangeMonth(subMonths(referenceDate, 1))}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm hover:border-slate-900"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(addMonths(referenceDate, 1))}
            className="rounded-full border border-slate-200 px-3 py-2 text-sm hover:border-slate-900"
          >
            Next
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <span key={day} className="py-2">
            {day}
          </span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {weeks.map((week, index) => (
          <div key={index} className="contents">
            {week.map((date) => {
              const { isBlocked, label, badgeColor, isoDate } = getDayMeta(date);
              const isCurrentMonth = isSameMonth(date, referenceDate);
              const isSelected = selectedDate === isoDate;
              const isToday = isSameDay(date, new Date());

              return (
                <button
                  key={isoDate}
                  type="button"
                  onClick={() => onSelectDate(isoDate)}
                  className={[
                    'flex flex-col gap-2 rounded-2xl border p-3 text-left transition',
                    isCurrentMonth ? 'border-slate-200' : 'border-transparent text-slate-400',
                    isBlocked ? 'bg-rose-50 border-rose-200' : 'bg-slate-50',
                    isSelected ? 'ring-2 ring-slate-900' : '',
                    isToday ? 'shadow-inner border-slate-900/20' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="text-sm font-semibold">{format(date, 'd')}</span>
                  {label && (
                    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${badgeColor}`}>
                      {label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

