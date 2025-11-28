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

    let badgeColor = 'bg-slate-300 text-slate-800';
    if (isBlocked) badgeColor = 'bg-rose-300 text-rose-900';
    else if (confirmedCount) badgeColor = 'bg-slate-900 text-white';
    else if (pendingCount) badgeColor = 'bg-amber-300 text-amber-900';
    else if (availableCount) badgeColor = 'bg-emerald-300 text-emerald-900';

    // Show count with "slot" for available on all screen sizes
    const label = isBlocked
      ? 'B'
      : confirmedCount
        ? `${confirmedCount}`
        : pendingCount
          ? `${pendingCount}`
          : availableCount
            ? `${availableCount} slot${availableCount !== 1 ? 's' : ''}`
            : null;

    return { isBlocked, label, badgeColor, isoDate };
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border-2 border-slate-300 bg-slate-100 p-3 sm:p-4 md:p-6 shadow-md shadow-slate-900/10">
      <header className="mb-3 sm:mb-4 md:mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-500">Calendar</p>
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-900">{format(referenceDate, 'MMMM yyyy')}</h2>
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onChangeMonth(subMonths(referenceDate, 1))}
            className="rounded-full border-2 border-slate-300 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:scale-95 transition-all touch-manipulation"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(addMonths(referenceDate, 1))}
            className="rounded-full border-2 border-slate-300 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:scale-95 transition-all touch-manipulation"
          >
            Next
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs font-semibold text-slate-600">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <span key={day} className="py-1 sm:py-2">
            {day}
          </span>
        ))}
      </div>

      <div className="mt-1 sm:mt-2 grid grid-cols-7 gap-1 sm:gap-2">
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
                    'flex flex-col gap-0.5 sm:gap-1 md:gap-1.5 rounded-xl sm:rounded-2xl border-2 p-1 sm:p-1.5 md:p-2.5 lg:p-3 text-left transition-all shadow-sm touch-manipulation active:scale-95 min-h-[3rem] sm:min-h-[3.5rem] md:min-h-[4rem]',
                    isCurrentMonth ? 'border-slate-300' : 'border-slate-200 text-slate-400',
                    isBlocked ? 'bg-rose-200 border-rose-400 hover:bg-rose-300 hover:border-rose-500' : 'bg-white border-slate-300 hover:bg-slate-50 hover:border-slate-400',
                    isSelected ? 'ring-2 ring-slate-900 ring-offset-1 sm:ring-offset-2 border-slate-900' : '',
                    isToday ? 'shadow-md border-slate-900/30 bg-slate-50' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className={`text-xs sm:text-sm font-semibold leading-tight ${isCurrentMonth ? 'text-slate-900' : 'text-slate-400'}`}>
                    {format(date, 'd')}
                  </span>
                  {label && (
                    <span className={`inline-flex items-center justify-center rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-[11px] font-semibold whitespace-nowrap ${badgeColor}`}>
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

