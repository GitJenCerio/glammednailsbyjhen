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
  const today = format(new Date(), 'yyyy-MM-dd');

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

    const badges: Array<{ label: string; color: string }> = [];

    if (isBlocked) {
      badges.push({ label: 'B', color: 'bg-rose-300 text-rose-900' });
    } else {
      if (confirmedCount > 0) {
        badges.push({ 
          label: `${confirmedCount}`,
          color: 'bg-slate-900 text-white' 
        });
      }
      if (availableCount > 0) {
        badges.push({ 
          label: `${availableCount}`,
          color: 'bg-emerald-300 text-emerald-900' 
        });
      }
      if (pendingCount > 0) {
        badges.push({ 
          label: `${pendingCount}`,
          color: 'bg-amber-300 text-amber-900' 
        });
      }
    }

    return { isBlocked, badges, isoDate };
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
              const { isBlocked, badges, isoDate } = getDayMeta(date);
              const isCurrentMonth = isSameMonth(date, referenceDate);
              const isSelected = selectedDate === isoDate;
              const isToday = isSameDay(date, new Date());
              const isPast = isoDate < today;

              return (
                <button
                  key={isoDate}
                  type="button"
                  onClick={() => !isPast && onSelectDate(isoDate)}
                  disabled={isPast}
                  className={[
                    'flex flex-col gap-0.5 sm:gap-0.5 md:gap-1 rounded-lg sm:rounded-xl md:rounded-2xl border-2 p-0.5 sm:p-1 md:p-1.5 lg:p-2 xl:p-2.5 text-left transition-all shadow-sm min-h-[2.5rem] sm:min-h-[3rem] md:min-h-[3.5rem] lg:min-h-[4rem] xl:min-h-[4.5rem]',
                    isPast ? 'opacity-40 cursor-not-allowed' : 'touch-manipulation active:scale-95',
                    isCurrentMonth ? 'border-slate-300' : 'border-slate-200 text-slate-400',
                    isBlocked ? 'bg-rose-200 border-rose-400 hover:bg-rose-300 hover:border-rose-500' : 'bg-white border-slate-300 hover:bg-slate-50 hover:border-slate-400',
                    isSelected ? 'ring-2 ring-slate-900 ring-offset-1 sm:ring-offset-2 border-slate-900' : '',
                    isToday ? 'shadow-md border-slate-900/30 bg-slate-50' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className={`text-[10px] sm:text-xs md:text-sm font-semibold leading-tight ${isCurrentMonth ? 'text-slate-900' : 'text-slate-400'}`}>
                    {format(date, 'd')}
                  </span>
                  {badges.length > 0 && (
                    <div className="flex flex-col gap-0.5 sm:gap-0.5 md:gap-0.5 lg:gap-1 flex-wrap">
                      {badges.slice(0, 3).map((badge, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center justify-center rounded-full px-0.5 sm:px-1 md:px-1.5 lg:px-2 py-0.5 text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] xl:text-[11px] font-semibold whitespace-nowrap leading-tight ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      ))}
                      {badges.length > 3 && (
                        <span className={`inline-flex items-center justify-center rounded-full px-0.5 sm:px-1 md:px-1.5 lg:px-2 py-0.5 text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] xl:text-[11px] font-semibold whitespace-nowrap leading-tight bg-slate-400 text-white`}>
                          +{badges.length - 3}
                        </span>
                      )}
                    </div>
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

