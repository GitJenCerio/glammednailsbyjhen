'use client';

import { useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import type { TileArgs } from 'react-calendar';
import {
  addMonths,
  subMonths,
  startOfMonth,
  format,
  isSameMonth,
} from 'date-fns';
import 'react-calendar/dist/Calendar.css';
import './CalendarView.css';

type EventType = 'available' | 'booked' | 'pending';

export type CalendarEvent = {
  id: number;
  date: string; // ISO date e.g. 2023-07-02
  title: string;
  type: EventType;
};

interface CalendarViewProps {
  events?: CalendarEvent[];
  initialMonth?: Date;
  onMonthChange?: (month: Date) => void;
  fullWidth?: boolean;
  className?: string;
}

const defaultEvents: CalendarEvent[] = [
  { id: 1, date: '2023-07-02', title: 'Event name', type: 'available' },
  { id: 2, date: '2023-07-05', title: 'Event name', type: 'booked' },
  { id: 3, date: '2023-07-11', title: 'Event name', type: 'pending' },
  { id: 4, date: '2023-07-14', title: 'Event name', type: 'available' },
  { id: 5, date: '2023-07-19', title: 'Event name', type: 'pending' },
  { id: 6, date: '2023-07-30', title: 'Event name', type: 'booked' },
];

export const eventColors: Record<EventType, string> = {
  available: '#5F69FF',
  booked: '#FF2F81',
  pending: '#9A4DFF',
};

export default function CalendarView({
  events = defaultEvents,
  initialMonth,
  onMonthChange,
  fullWidth,
  className,
}: CalendarViewProps) {
  const [activeMonth, setActiveMonth] = useState<Date>(() => startOfMonth(initialMonth ?? new Date()));

  const eventsByDate = useMemo<Record<string, CalendarEvent[]>>(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      acc[event.date] = acc[event.date] ? [...acc[event.date], event] : [event];
      return acc;
    }, {});
  }, [events]);

  useEffect(() => {
    onMonthChange?.(activeMonth);
  }, [activeMonth, onMonthChange]);

  const handlePrev = () => setActiveMonth((prev) => subMonths(prev, 1));
  const handleNext = () => setActiveMonth((prev) => addMonths(prev, 1));

  const wrapperClassName = ['cv-wrapper', fullWidth ? 'cv-wrapper-full' : '', className].filter(Boolean).join(' ');

  const tileContent = ({ date, view }: TileArgs) => {
    if (view !== 'month') return null;
    const key = format(date, 'yyyy-MM-dd');
    const dayEvents = eventsByDate[key] || [];
    if (!dayEvents.length) return null;

    return (
      <div className="cv-events">
        {dayEvents.map((event) => (
          <span
            key={event.id}
            className="cv-event-pill"
            style={{ backgroundColor: eventColors[event.type] || '#CBD5F5' }}
            title={event.title}
          >
            {event.title}
          </span>
        ))}
      </div>
    );
  };

  const tileClassName = ({ date, view }: TileArgs) => {
    if (view !== 'month') return undefined;
    const classes = ['cv-date-tile'];
    if (!isSameMonth(date, activeMonth)) {
      classes.push('cv-date-muted');
    }
    if (format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
      classes.push('cv-date-today');
    }
    return classes.join(' ');
  };

  return (
    <section className={wrapperClassName}>
      <header className="cv-header">
        <div>
          <p className="cv-subtitle">Calendar View</p>
          <h2 className="cv-title">{format(activeMonth, 'MMMM yyyy')}</h2>
        </div>
        <div className="cv-controls">
          <button type="button" onClick={handlePrev} aria-label="Previous month">
            ‹
          </button>
          <button type="button" onClick={handleNext} aria-label="Next month">
            ›
          </button>
        </div>
      </header>

      <div className="cv-legend">
        {Object.entries(eventColors).map(([key, color]) => (
          <span key={key} className="cv-legend-item" aria-label={key}>
            <span style={{ backgroundColor: color }} title={key} />
          </span>
        ))}
      </div>

      <Calendar
        className="cv-calendar"
        calendarType="gregory"
        view="month"
        activeStartDate={activeMonth}
        showNeighboringMonth={true}
        showNavigation={false}
        tileContent={tileContent}
        tileClassName={tileClassName}
        onActiveStartDateChange={({ activeStartDate }) => {
          if (activeStartDate) setActiveMonth(startOfMonth(activeStartDate));
        }}
      />
    </section>
  );
}

