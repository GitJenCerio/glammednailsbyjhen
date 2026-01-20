'use client';

import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import type { Booking, Slot, Customer } from '@/lib/types';
import type { TimeRange } from '@/lib/analytics';
import {
  getBookingsByRange,
  getRevenueByRange,
  getTopServices,
  getPaymentBreakdown,
  getUpcomingBookings,
  getRecentCustomers,
  getCancellations,
  getPendingPayments,
  getServiceLocationBreakdown,
  getClientTypeBreakdown,
  getClientSourceBreakdown,
  getIncompleteBookings,
} from '@/lib/analytics';
import { TimeFilterTabs } from './TimeFilterTabs';
import { GradientCard } from './GradientCard';
import { MetricCard } from './MetricCard';
import { DonutChartCard } from './DonutChartCard';
import { LineChartCard } from './LineChartCard';
import { BarChartCard } from './BarChartCard';
import { ListCard } from './ListCard';
import { IoCashOutline, IoCalendarOutline, IoPeopleOutline, IoCloseCircleOutline } from 'react-icons/io5';

interface AnalyticsDashboardProps {
  bookings: Booking[];
  slots: Slot[];
  customers: Customer[];
}

export function AnalyticsDashboard({ bookings, slots, customers }: AnalyticsDashboardProps) {
  const [range, setRange] = useState<TimeRange>('today');

  // Get all analytics data based on selected range
  const bookingsInRange = useMemo(() => getBookingsByRange(bookings, range), [bookings, range]);
  const revenueData = useMemo(() => getRevenueByRange(bookings, range), [bookings, range]);
  const topServices = useMemo(() => getTopServices(bookings, range), [bookings, range]);
  const paymentBreakdown = useMemo(() => getPaymentBreakdown(bookings, range), [bookings, range]);
  const upcomingBookings = useMemo(() => getUpcomingBookings(bookings, slots), [bookings, slots]);
  const recentCustomers = useMemo(() => getRecentCustomers(bookings, customers, range), [bookings, customers, range]);
  const cancellations = useMemo(() => getCancellations(bookings, range), [bookings, range]);
  const pendingPayments = useMemo(() => getPendingPayments(bookings), [bookings]);
  const locationBreakdown = useMemo(() => getServiceLocationBreakdown(bookings, range), [bookings, range]);
  const clientTypeBreakdown = useMemo(() => getClientTypeBreakdown(bookings, range), [bookings, range]);
  const clientSourceBreakdown = useMemo(() => getClientSourceBreakdown(bookings, range), [bookings, range]);
  const incompleteBookingsList = useMemo(() => getIncompleteBookings(bookings, range), [bookings, range]);

  const totalBookings = bookingsInRange.length;
  const totalRevenue = revenueData.total;

  // Service location breakdown for donut chart
  const locationChartData = [
    {
      name: 'Studio',
      value: locationBreakdown.studio,
      color: '#8b5cf6',
    },
    {
      name: 'Home Service',
      value: locationBreakdown.homeService,
      color: '#ec4899',
    },
  ].filter((item) => item.value > 0);

  // Client type breakdown for donut chart
  const clientTypeChartData = [
    {
      name: 'New Clients',
      value: clientTypeBreakdown.new,
      color: '#3b82f6',
    },
    {
      name: 'Repeat Clients',
      value: clientTypeBreakdown.repeat,
      color: '#10b981',
    },
  ].filter((item) => item.value > 0);

  // Client source breakdown for donut chart
  const totalSources =
    clientSourceBreakdown.facebook +
    clientSourceBreakdown.tiktok +
    clientSourceBreakdown.instagram +
    clientSourceBreakdown.referral +
    clientSourceBreakdown.other;

  const clientSourceChartData = [
    {
      name: 'Facebook',
      value: clientSourceBreakdown.facebook,
      color: '#1877f2',
    },
    {
      name: 'TikTok',
      value: clientSourceBreakdown.tiktok,
      color: '#000000',
    },
    {
      name: 'Instagram',
      value: clientSourceBreakdown.instagram,
      color: '#e4405f',
    },
    {
      name: 'Referred',
      value: clientSourceBreakdown.referral,
      color: '#8b5cf6',
    },
    {
      name: 'Other',
      value: clientSourceBreakdown.other,
      color: '#64748b',
    },
  ].filter((item) => item.value > 0);

  // Upcoming bookings list items
  const upcomingBookingsList = upcomingBookings.map((booking) => {
    const slot = slots.find((s) => s.id === booking.slotId);
    const customer = customers.find((c) => c.id === booking.customerId);
    const slotInfo = slot
      ? `${format(parseISO(slot.date), 'MMM d')} ${slot.time}`
      : 'No slot';
    return {
      id: booking.id,
      title: `${customer?.name || booking.bookingId} · ${slotInfo}`,
      metadata: <span className="text-[10px] text-slate-400">{booking.bookingId}</span>,
    };
  });

  // Recent customers list items
  const recentCustomersList = recentCustomers.map(({ customer, bookingCount, lastBookingDate }) => ({
    id: customer.id,
    title: customer.name,
    subtitle: `${bookingCount} booking${bookingCount !== 1 ? 's' : ''}`,
    metadata: <span className="text-xs text-slate-500">{format(parseISO(lastBookingDate), 'MMM d')}</span>,
  }));

  // Cancellations list items
  const cancellationsList = cancellations.slice(0, 5).map((booking) => {
    const customer = customers.find((c) => c.id === booking.customerId);
    return {
      id: booking.id,
      title: customer?.name || booking.bookingId,
      subtitle: format(parseISO(booking.updatedAt || booking.createdAt), 'MMM d, yyyy'),
      metadata: <span className="text-xs text-red-600 font-semibold">Cancelled</span>,
    };
  });

  return (
    <div className="space-y-6">
      {/* Time Filter */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time insights from your booking system</p>
        </div>
        <TimeFilterTabs value={range} onChange={setRange} />
      </div>

      {/* Top Row */}
      <div className="grid gap-3 sm:gap-4 md:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Column 1: Revenue + Total Bookings stacked in one column */}
        <div className="space-y-3 h-full">
          <GradientCard
            title={
              range === 'today'
                ? 'Revenue Today'
                : range === 'week'
                  ? 'Revenue This Week'
                  : range === 'month'
                    ? 'Revenue This Month'
                    : 'Revenue This Year'
            }
            value={`₱${totalRevenue.toLocaleString('en-PH')}`}
            gradient="from-blue-500 via-purple-500 to-pink-500"
            icon={<IoCashOutline className="w-12 h-12" />}
            className="min-h-[140px] sm:min-h-[160px] md:min-h-[140px] flex-1 md:flex-none"
          />

          <GradientCard
            title="Total Bookings"
            value={totalBookings}
            gradient="from-emerald-500 via-teal-500 to-cyan-500"
            icon={<IoCalendarOutline className="w-12 h-12" />}
            className="min-h-[140px] sm:min-h-[160px] md:min-h-[140px] flex-1 md:flex-none md:mt-0"
          />
        </div>

        {/* Column 2: Service Location Breakdown Donut Chart */}
        <DonutChartCard
          title="Service Location"
          data={locationChartData}
          className="h-full min-h-[140px] sm:min-h-[180px] md:min-h-[160px]"
        />

        {/* Column 3: Client Type Breakdown Donut Chart */}
        {clientTypeBreakdown.new + clientTypeBreakdown.repeat > 0 ? (
          <DonutChartCard
            title="Client Type"
            data={clientTypeChartData}
            className="h-full min-h-[140px] sm:min-h-[180px] md:min-h-[160px]"
          />
        ) : (
          <div className="rounded-2xl border-2 border-slate-300 bg-white p-3 sm:p-4 md:p-3 shadow-lg flex items-center justify-center min-h-[140px] sm:min-h-[180px] md:min-h-[160px]">
            <p className="text-xs sm:text-sm md:text-xs text-slate-400 text-center">No client type data</p>
          </div>
        )}
      </div>

      {/* Mini Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pending Payments"
          value={pendingPayments.length}
          color="orange"
          icon={<IoCashOutline className="w-5 h-5" />}
        />
        <MetricCard
          title="New Customers"
          value={recentCustomers.length}
          color="blue"
          icon={<IoPeopleOutline className="w-5 h-5" />}
        />
        <MetricCard
          title="Cancellations"
          value={cancellations.length}
          color="red"
          icon={<IoCloseCircleOutline className="w-5 h-5" />}
        />
        <MetricCard
          title="Completed Bookings"
          value={bookingsInRange.filter((b) => b.status === 'confirmed').length}
          color="green"
          icon={<IoCalendarOutline className="w-5 h-5" />}
        />
      </div>

      {/* Incomplete Bookings */}
      {incompleteBookingsList.length > 0 && (
        <div className="grid gap-4">
          <MetricCard
            title="Incomplete Bookings"
            value={incompleteBookingsList.length}
            subtitle="Started but didn't finish"
            color="orange"
            icon={<IoCloseCircleOutline className="w-5 h-5" />}
          />
        </div>
      )}

      {/* Revenue Trend */}
      <div className="grid gap-4 lg:grid-cols-1">
        <LineChartCard title="Revenue Trend" data={revenueData.trend} />
      </div>

      {/* Middle Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Client Source Breakdown */}
        {totalSources > 0 && (
          <DonutChartCard title="Client Source" data={clientSourceChartData} className="min-h-[180px] sm:min-h-[250px] md:min-h-[300px]" />
        )}

        {/* Top Services Bar Chart */}
        <BarChartCard title="Top Services" data={topServices} />
      </div>

      {/* Upcoming Bookings - Single Line */}
      <div className="rounded-2xl border-2 border-slate-300 bg-white p-3 sm:p-4 shadow-lg">
        <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">
          Upcoming Bookings
        </h3>
        {upcomingBookingsList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {upcomingBookingsList.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 bg-slate-50"
              >
                <p className="text-xs font-medium text-slate-900 whitespace-nowrap">{item.title}</p>
                {item.metadata && <div className="flex-shrink-0 text-[10px] text-slate-400">{item.metadata}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-slate-400 text-xs">No upcoming bookings</div>
        )}
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Customers */}
        <ListCard
          title="Recent Customers"
          items={recentCustomersList}
          emptyMessage="No recent customers"
        />

        {/* Activity / Cancellations */}
        <ListCard
          title="Recent Cancellations"
          items={cancellationsList}
          emptyMessage="No cancellations"
        />
      </div>
    </div>
  );
}

