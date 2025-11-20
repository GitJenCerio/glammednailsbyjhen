'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  IoGridOutline,
  IoCalendarOutline,
  IoPeopleOutline,
  IoBookOutline,
  IoBagHandleOutline,
  IoNotificationsOutline,
  IoSettingsOutline,
  IoSearchOutline,
} from 'react-icons/io5';
import { eachDayOfInterval, format, startOfMonth, isSameMonth } from 'date-fns';
import dynamic from 'next/dynamic';
import type { CalendarEvent as CalendarViewEvent } from '@/components/CalendarView';

const CalendarView = dynamic(() => import('@/components/CalendarView'), { ssr: false });

const themes = {
  slate: {
    name: 'Classic Slate',
    palette: ['#0f172a', '#475569'],
    pageBg: 'bg-slate-50',
    pageText: 'text-slate-900',
    mutedText: 'text-slate-500',
    subtleText: 'text-slate-400',
    sidebarBg: 'bg-white',
    sidebarBorder: 'border-slate-200',
    navActive: 'bg-slate-900 text-white shadow-lg shadow-slate-900/10',
    navInactive: 'text-slate-500 hover:bg-slate-100',
    navBadge: 'bg-slate-200 text-slate-600',
    navBadgeActive: 'bg-white/20 text-white',
    panelBg: 'bg-white',
    panelRing: 'ring-slate-100',
    panelBorder: 'border-slate-100',
    accentSoft: 'bg-slate-900/5 text-slate-900',
    inputBorder: 'border-slate-200 focus:border-slate-900',
    inputBg: 'bg-white',
    iconButton: 'border-slate-200 text-slate-500',
    iconButtonHover: 'hover:border-slate-900 hover:text-slate-900',
    avatarBg: 'bg-slate-900',
    avatarText: 'text-white',
    quickAction: 'border-slate-100 text-slate-600',
    quickActionHover: 'hover:border-slate-900 hover:text-slate-900',
    surfaceBorder: 'border-slate-100',
  },
  rose: {
    name: 'Blush Bloom',
    palette: ['#f43f5e', '#fb7185'],
    pageBg: 'bg-rose-50',
    pageText: 'text-rose-950',
    mutedText: 'text-rose-600',
    subtleText: 'text-rose-400',
    sidebarBg: 'bg-white',
    sidebarBorder: 'border-rose-100',
    navActive: 'bg-rose-500 text-white shadow-lg shadow-rose-500/30',
    navInactive: 'text-rose-500 hover:bg-rose-100/70',
    navBadge: 'bg-rose-100 text-rose-600',
    navBadgeActive: 'bg-white/20 text-white',
    panelBg: 'bg-white',
    panelRing: 'ring-rose-100',
    panelBorder: 'border-rose-100',
    accentSoft: 'bg-rose-100 text-rose-700',
    inputBorder: 'border-rose-200 focus:border-rose-500',
    inputBg: 'bg-white',
    iconButton: 'border-rose-100 text-rose-400',
    iconButtonHover: 'hover:border-rose-500 hover:text-rose-600',
    avatarBg: 'bg-rose-500',
    avatarText: 'text-white',
    quickAction: 'border-rose-100 text-rose-600',
    quickActionHover: 'hover:border-rose-500 hover:text-rose-700',
    surfaceBorder: 'border-rose-100',
  },
  midnight: {
    name: 'Midnight Glow',
    palette: ['#312e81', '#1f2937'],
    pageBg: 'bg-slate-950',
    pageText: 'text-slate-50',
    mutedText: 'text-slate-400',
    subtleText: 'text-slate-500',
    sidebarBg: 'bg-slate-900',
    sidebarBorder: 'border-slate-800',
    navActive: 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40',
    navInactive: 'text-slate-400 hover:bg-slate-800',
    navBadge: 'bg-slate-800 text-slate-300',
    navBadgeActive: 'bg-white/20 text-white',
    panelBg: 'bg-slate-900',
    panelRing: 'ring-slate-800',
    panelBorder: 'border-slate-800',
    accentSoft: 'bg-indigo-500/10 text-indigo-200',
    inputBorder: 'border-slate-700 focus:border-indigo-400',
    inputBg: 'bg-slate-900',
    iconButton: 'border-slate-800 text-slate-400',
    iconButtonHover: 'hover:border-indigo-400 hover:text-indigo-300',
    avatarBg: 'bg-indigo-500',
    avatarText: 'text-white',
    quickAction: 'border-slate-800 text-slate-300',
    quickActionHover: 'hover:border-indigo-400 hover:text-white',
    surfaceBorder: 'border-slate-800',
  },
} as const;

type ThemeKey = keyof typeof themes;

const stats = [
  {
    label: 'Total Bookings',
    value: '128',
    trend: '+12%',
    trendLabel: 'vs last week',
    icon: IoBookOutline,
  },
  {
    label: 'Active Customers',
    value: '87',
    trend: '+8%',
    trendLabel: 'new this month',
    icon: IoPeopleOutline,
  },
  {
    label: 'Services Offered',
    value: '14',
    trend: '+2',
    trendLabel: 'new add-ons',
    icon: IoBagHandleOutline,
  },
  {
    label: 'Upcoming Events',
    value: '9',
    trend: '+3',
    trendLabel: 'this week',
    icon: IoCalendarOutline,
  },
];

const quickActions = [
  { label: 'Add Booking', icon: IoBookOutline },
  { label: 'New Customer', icon: IoPeopleOutline },
  { label: 'Create Service', icon: IoBagHandleOutline },
  { label: 'Schedule Event', icon: IoCalendarOutline },
];

const dailyBookings = [
  { time: '09:00 AM', customer: 'Alexis Ray', service: 'Gel Manicure', status: 'Confirmed' },
  { time: '11:30 AM', customer: 'Hailey Sage', service: 'Russian Manicure', status: 'Pending' },
  { time: '02:15 PM', customer: 'Mila Cruz', service: 'Acrylic Full Set', status: 'Confirmed' },
  { time: '04:00 PM', customer: 'Summer Leigh', service: 'Gel Removal', status: 'Cancelled' },
];

const customers = [
  { name: 'Alexis Ray', visits: 12, lastVisit: 'Nov 12', spend: '$860', status: 'VIP' },
  { name: 'Hailey Sage', visits: 8, lastVisit: 'Nov 8', spend: '$540', status: 'Loyal' },
  { name: 'Mila Cruz', visits: 5, lastVisit: 'Nov 15', spend: '$320', status: 'Active' },
  { name: 'Summer Leigh', visits: 3, lastVisit: 'Nov 10', spend: '$180', status: 'New' },
];

type CalendarActionMode = 'slot' | 'booking' | 'block';

type CalendarListItem = {
  date: string;
  title: string;
  status: 'Booked' | 'Blocked' | 'Available';
};

const seedCalendarEvents: CalendarListItem[] = [
  { date: '2025-11-03', title: 'Full set w/ Alexis Ray', status: 'Booked' },
  { date: '2025-11-08', title: 'Gel refill w/ Hailey Sage', status: 'Booked' },
  { date: '2025-11-14', title: 'Studio maintenance', status: 'Blocked' },
  { date: '2025-11-17', title: 'VIP appointment w/ Mila', status: 'Booked' },
  { date: '2025-11-24', title: 'New client discovery call', status: 'Available' },
  { date: '2025-12-05', title: 'Holiday campaign shoot', status: 'Booked' },
  { date: '2025-12-20', title: 'Studio deep clean', status: 'Blocked' },
];

export default function AdminDashboard() {
  const [theme, setTheme] = useState<ThemeKey>('slate');
  const themeStyles = themes[theme];
  const [activeSection, setActiveSection] = useState<'overview' | 'bookings' | 'customers' | 'services' | 'calendar'>(
    'overview',
  );
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [calendarData, setCalendarData] = useState<CalendarListItem[]>(seedCalendarEvents);
  const [calendarModalMode, setCalendarModalMode] = useState<CalendarActionMode | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const calendarEntries = useMemo<CalendarViewEvent[]>(() => {
    const statusToType: Record<CalendarListItem['status'], CalendarViewEvent['type']> = {
      Booked: 'booked',
      Blocked: 'pending',
      Available: 'available',
    };

    return calendarData.map((event, index) => ({
      id: index + 1,
      date: event.date,
      title: event.title,
      type: statusToType[event.status],
    }));
  }, [calendarData]);

  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case 'bookings':
        return 'Bookings';
      case 'customers':
        return 'Customers';
      case 'services':
        return 'Services';
      case 'calendar':
        return 'Calendar';
      default:
        return 'Overview';
    }
  }, [activeSection]);

  const monthLabel = useMemo(() => format(currentMonth, 'MMMM yyyy'), [currentMonth]);

  const monthEvents = useMemo(
    () =>
      calendarEvents
        .filter((event) => isSameMonth(new Date(event.date), currentMonth))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [currentMonth],
  );

  const handleMonthChange = (date: Date) => {
    setCurrentMonth(startOfMonth(date));
  };

  return (
    <div className={`min-h-screen ${themeStyles.pageBg} ${themeStyles.pageText} transition-colors`}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={`hidden lg:flex w-72 flex-col border-r ${themeStyles.sidebarBorder} ${themeStyles.sidebarBg}`}>
          <div className={`px-6 py-8 border-b ${themeStyles.sidebarBorder}`}>
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-semibold ${themeStyles.avatarBg} ${themeStyles.avatarText}`}>
                G
              </div>
              <div>
                <p className={`text-sm uppercase tracking-[0.2em] ${themeStyles.subtleText}`}>Admin</p>
                <p className={`font-semibold text-lg ${themeStyles.pageText}`}>Glammed Nails</p>
              </div>
            </div>
        </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {[
              { id: 'overview', label: 'Overview', icon: IoGridOutline },
              { id: 'bookings', label: 'Bookings', icon: IoBookOutline },
              { id: 'customers', label: 'Customers', icon: IoPeopleOutline },
              { id: 'services', label: 'Services', icon: IoBagHandleOutline },
              { id: 'calendar', label: 'Calendar', icon: IoCalendarOutline },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
          <button
                  key={item.id}
                  onClick={() =>
                    setActiveSection(item.id as 'overview' | 'bookings' | 'customers' | 'services' | 'calendar')
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive ? themeStyles.navActive : themeStyles.navInactive
                  }`}
                >
                  <Icon className="text-lg" />
                  {item.label}
                  {item.id === 'bookings' && (
                    <span
                      className={`ml-auto inline-flex items-center justify-center rounded-full px-2 text-xs ${
                        isActive ? themeStyles.navBadgeActive : themeStyles.navBadge
                      }`}
                    >
                      8
                    </span>
                  )}
          </button>
              );
            })}
          </nav>

          <div className={`px-6 py-6 border-t ${themeStyles.sidebarBorder}`}>
            <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${themeStyles.accentSoft}`}>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow ${themeStyles.sidebarBg} ${themeStyles.pageText}`}
              >
                <IoSettingsOutline />
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${themeStyles.subtleText}`}>Need help?</p>
                <p className={`text-sm font-semibold ${themeStyles.pageText}`}>Support Center</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-6 py-8 lg:px-12">
          <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
              <p className={`text-xs uppercase tracking-[0.4em] ${themeStyles.subtleText}`}>Dashboard</p>
              <h1 className={`text-3xl font-semibold ${themeStyles.pageText}`}>{sectionTitle}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`hidden lg:flex items-center gap-3 rounded-2xl border px-3 py-2 ${themeStyles.panelBg} ${themeStyles.panelBorder}`}
              >
                <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${themeStyles.subtleText}`}>Theme</p>
                <div className="flex gap-2">
                  {(Object.entries(themes) as [ThemeKey, (typeof themes)[ThemeKey]][]).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      type="button"
                      aria-pressed={theme === key}
                      className="h-8 w-8 rounded-xl border-2 border-transparent transition focus:outline-none"
                      style={{
                        background: `linear-gradient(135deg, ${value.palette[0]}, ${value.palette[1]})`,
                        boxShadow: theme === key ? `0 0 0 3px ${value.palette[0]}33` : 'none',
                      }}
                      title={value.name}
                    />
                  ))}
                  </div>
                  </div>
              <div className="relative">
                <IoSearchOutline className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                    <input
                      type="text"
                  placeholder="Search anything..."
                  className={`w-64 rounded-2xl border ${themeStyles.inputBorder} ${themeStyles.inputBg} py-2 pl-10 pr-4 text-sm focus:outline-none`}
                    />
                  </div>
          <button
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition ${themeStyles.iconButton} ${themeStyles.iconButtonHover}`}
          >
                <IoNotificationsOutline />
          </button>
              <div className={`flex items-center gap-3 rounded-2xl px-3 py-2 shadow-sm ${themeStyles.panelBg}`}>
                <div
                  className={`h-10 w-10 rounded-2xl flex items-center justify-center font-semibold ${themeStyles.avatarBg} ${themeStyles.avatarText}`}
                >
                  JR
                </div>
                <div>
                  <p className={`text-sm font-semibold ${themeStyles.pageText}`}>Jhen Rivera</p>
                  <p className={`text-xs ${themeStyles.mutedText}`}>Owner</p>
                </div>
              </div>
        </div>
      </header>

          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className={`rounded-3xl ${themeStyles.panelBg} p-6 shadow-sm ring-1 ${themeStyles.panelRing} transition hover:-translate-y-1 hover:shadow-md`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`rounded-2xl p-3 ${themeStyles.accentSoft}`}>
                          <Icon className="text-xl" />
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
                          {stat.trend}
                        </span>
                      </div>
                      <p className={`mt-6 text-sm uppercase tracking-[0.3em] ${themeStyles.subtleText}`}>{stat.label}</p>
                      <p className={`mt-2 text-3xl font-semibold ${themeStyles.pageText}`}>{stat.value}</p>
                      <p className={`text-xs ${themeStyles.subtleText}`}>{stat.trendLabel}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <div className={`rounded-3xl ${themeStyles.panelBg} p-6 shadow-sm ring-1 ${themeStyles.panelRing}`}>
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className={`text-xs uppercase tracking-[0.3em] ${themeStyles.subtleText}`}>Today</p>
                      <h2 className={`text-2xl font-semibold ${themeStyles.pageText}`}>Upcoming Bookings</h2>
                    </div>
                    <button className={`text-sm font-semibold ${themeStyles.mutedText} hover:opacity-80`}>View all</button>
                  </div>
                  <div className="space-y-4">
                    {dailyBookings.map((booking) => (
                      <div
                        key={booking.time}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${themeStyles.surfaceBorder}`}
                      >
                        <div>
                          <p className={`text-sm font-semibold ${themeStyles.pageText}`}>{booking.customer}</p>
                          <p className={`text-xs ${themeStyles.mutedText}`}>
                            {booking.service} • {booking.time}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            booking.status === 'Confirmed'
                              ? 'bg-emerald-50 text-emerald-600'
                              : booking.status === 'Pending'
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`rounded-3xl ${themeStyles.panelBg} p-6 shadow-sm ring-1 ${themeStyles.panelRing}`}>
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className={`text-xs uppercase tracking-[0.3em] ${themeStyles.subtleText}`}>Actions</p>
                      <h2 className={`text-xl font-semibold ${themeStyles.pageText}`}>Quick Create</h2>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {quickActions.map((action) => {
                      const Icon = action.icon;
                      return (
          <button
                          key={action.label}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${themeStyles.quickAction} ${themeStyles.quickActionHover}`}
                        >
                          <div className={`rounded-2xl p-2 ${themeStyles.accentSoft}`}>
                            <Icon />
                          </div>
                          {action.label}
          </button>
                      );
                    })}
                  </div>
                </div>
        </div>

              <div className={`rounded-3xl ${themeStyles.panelBg} p-6 shadow-sm ring-1 ${themeStyles.panelRing}`}>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.3em] ${themeStyles.subtleText}`}>Top Clients</p>
                    <h2 className={`text-2xl font-semibold ${themeStyles.pageText}`}>Customer Spotlight</h2>
                  </div>
                  <button className={`text-sm font-semibold ${themeStyles.mutedText} hover:opacity-80`}>
                    See customers
              </button>
            </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {customers.map((customer) => (
                    <div key={customer.name} className={`rounded-2xl border p-5 ${themeStyles.surfaceBorder}`}>
                      <p className={`text-sm font-semibold ${themeStyles.pageText}`}>{customer.name}</p>
                      <p className={`text-xs ${themeStyles.subtleText}`}>{customer.status}</p>
                      <div className={`mt-4 flex items-center justify-between text-sm ${themeStyles.mutedText}`}>
                  <div>
                          <p className={`text-xs uppercase tracking-[0.2em] ${themeStyles.subtleText}`}>Visits</p>
                          <p className={`text-lg font-semibold ${themeStyles.pageText}`}>{customer.visits}</p>
                  </div>
                  <div>
                          <p className={`text-xs uppercase tracking-[0.2em] ${themeStyles.subtleText}`}>Last visit</p>
                          <p className={`text-sm font-medium ${themeStyles.pageText}`}>{customer.lastVisit}</p>
                  </div>
                  <div>
                          <p className={`text-xs uppercase tracking-[0.2em] ${themeStyles.subtleText}`}>Spend</p>
                          <p className={`text-sm font-medium ${themeStyles.pageText}`}>{customer.spend}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}

          {/* Calendar Section */}
          {activeSection === 'calendar' && (
            <div className="space-y-8">
              <div className={`rounded-3xl ${themeStyles.panelBg} p-4 md:p-6 shadow-sm ring-1 ${themeStyles.panelRing}`}>
                <CalendarView events={calendarEntries} onMonthChange={handleMonthChange} />
              </div>

              <div className={`rounded-3xl ${themeStyles.panelBg} p-6 shadow-sm ring-1 ${themeStyles.panelRing}`}>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.3em] ${themeStyles.subtleText}`}>This Month</p>
                    <h2 className={`text-2xl font-semibold ${themeStyles.pageText}`}>Upcoming Events</h2>
                  </div>
                  <button className={`text-sm font-semibold ${themeStyles.mutedText} hover:opacity-80`}>
                    Add event
                  </button>
                </div>
                <div className="space-y-4">
                  {monthEvents.length === 0 ? (
                    <p className={`text-sm ${themeStyles.mutedText}`}>
                      Nothing scheduled for {monthLabel}. Tap a day to add a booking.
                    </p>
                  ) : (
                    monthEvents.map((event) => (
                      <div
                        key={event.title + event.date}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${themeStyles.surfaceBorder}`}
                      >
                        <div>
                          <p className={`text-xs uppercase tracking-[0.3em] ${themeStyles.subtleText}`}>
                            {format(new Date(event.date), 'MMM dd')}
                          </p>
                          <p className={`text-sm font-semibold ${themeStyles.pageText}`}>{event.title}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            event.status === 'Booked'
                              ? 'bg-amber-50 text-amber-600'
                              : event.status === 'Blocked'
                                ? 'bg-rose-50 text-rose-600'
                                : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {event.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Placeholder sections for other tabs */}
          {activeSection !== 'overview' && activeSection !== 'calendar' && (
            <div className={`rounded-3xl ${themeStyles.panelBg} p-10 text-center shadow-sm ring-1 ${themeStyles.panelRing}`}>
              <p className={`text-sm uppercase tracking-[0.3em] ${themeStyles.subtleText}`}>Coming Soon</p>
              <h2 className={`mt-4 text-2xl font-semibold ${themeStyles.pageText}`}>
                {sectionTitle} section template is ready for your data.
              </h2>
              <p className={`mt-2 text-sm ${themeStyles.mutedText}`}>
                Plug in your API or database to transform this placeholder into a fully interactive experience.
                        </p>
                      </div>
                )}
        </main>
              </div>
            </div>
  );
}

