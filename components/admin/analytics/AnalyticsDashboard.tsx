'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { IoCashOutline, IoCalendarOutline, IoPeopleOutline, IoCloseCircleOutline, IoEyeOutline, IoArrowForwardOutline } from 'react-icons/io5';

interface AnalyticsDashboardProps {
  bookings: Booking[];
  slots: Slot[];
  customers: Customer[];
}

export function AnalyticsDashboard({ bookings, slots, customers }: AnalyticsDashboardProps) {
  const [range, setRange] = useState<TimeRange>('today');
  const [webAnalytics, setWebAnalytics] = useState<{
    pageViews: number;
    bookNowClicks: number;
    conversionRate: number;
    incompleteBookings: number;
  }>({
    pageViews: 0,
    bookNowClicks: 0,
    conversionRate: 0,
    incompleteBookings: 0,
  });
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

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
  
  // Fetch web analytics
  useEffect(() => {
    async function fetchWebAnalytics() {
      setLoadingAnalytics(true);
      try {
        const statsRes = await fetch(`/api/analytics/stats?range=${range}`);
        const statsData = await statsRes.json();
        
        const stats = statsData.stats || { pageViews: 0, bookNowClicks: 0, bookingStarts: 0, bookingCompletions: 0 };
        
        // Calculate conversion rate: completed bookings / book now clicks
        // Completed bookings are confirmed or pending_payment (form submitted)
        const completedBookings = bookingsInRange.filter(
          (b) => b.status === 'confirmed' || b.status === 'pending_payment'
        ).length;
        
        const conversionRate = stats.bookNowClicks > 0 
          ? (completedBookings / stats.bookNowClicks) * 100 
          : 0;
        
        setWebAnalytics({
          pageViews: stats.pageViews || 0,
          bookNowClicks: stats.bookNowClicks || 0,
          conversionRate: Math.round(conversionRate * 10) / 10,
          incompleteBookings: incompleteBookingsList.length,
        });
      } catch (error) {
        console.error('Failed to fetch web analytics:', error);
      } finally {
        setLoadingAnalytics(false);
      }
    }
    
    fetchWebAnalytics();
  }, [range, bookingsInRange, incompleteBookingsList.length]);

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

  const studioPercentage =
    locationBreakdown.studio + locationBreakdown.homeService > 0
      ? ((locationBreakdown.studio / (locationBreakdown.studio + locationBreakdown.homeService)) * 100).toFixed(1)
      : '0';
  const homeServicePercentage =
    locationBreakdown.studio + locationBreakdown.homeService > 0
      ? ((locationBreakdown.homeService / (locationBreakdown.studio + locationBreakdown.homeService)) * 100).toFixed(1)
      : '0';

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

  const newClientPercentage =
    clientTypeBreakdown.new + clientTypeBreakdown.repeat > 0
      ? ((clientTypeBreakdown.new / (clientTypeBreakdown.new + clientTypeBreakdown.repeat)) * 100).toFixed(1)
      : '0';
  const repeatClientPercentage =
    clientTypeBreakdown.new + clientTypeBreakdown.repeat > 0
      ? ((clientTypeBreakdown.repeat / (clientTypeBreakdown.new + clientTypeBreakdown.repeat)) * 100).toFixed(1)
      : '0';

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
    return {
      id: booking.id,
      title: customer?.name || booking.bookingId,
      subtitle: slot
        ? `${format(parseISO(slot.date), 'MMM d, yyyy')} · ${slot.time}`
        : 'No slot found',
      metadata: <span className="text-xs text-slate-500">{booking.bookingId}</span>,
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Revenue Card */}
        <GradientCard
          title={range === 'today' ? 'Revenue Today' : range === 'week' ? 'Revenue This Week' : range === 'month' ? 'Revenue This Month' : 'Revenue This Year'}
          value={`₱${totalRevenue.toLocaleString('en-PH')}`}
          subtitle={`${totalBookings} booking${totalBookings !== 1 ? 's' : ''}`}
          gradient="from-blue-500 via-purple-500 to-pink-500"
          icon={<IoCashOutline className="w-12 h-12" />}
          className="h-full min-h-[200px]"
        />

        {/* Total Bookings Card */}
        <GradientCard
          title="Total Bookings"
          value={totalBookings}
          subtitle={`Revenue: ₱${totalRevenue.toLocaleString('en-PH')}`}
          gradient="from-emerald-500 via-teal-500 to-cyan-500"
          icon={<IoCalendarOutline className="w-12 h-12" />}
          className="h-full min-h-[200px]"
        />

        {/* Service Location Breakdown Donut Chart */}
        <DonutChartCard
          title="Service Location"
          data={locationChartData}
          className="h-full min-h-[200px]"
        />

        {/* Client Type Breakdown Donut Chart */}
        {clientTypeBreakdown.new + clientTypeBreakdown.repeat > 0 ? (
          <DonutChartCard
            title="Client Type"
            data={clientTypeChartData}
            className="h-full min-h-[200px]"
          />
        ) : (
          <div className="rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-6 shadow-lg flex items-center justify-center min-h-[200px]">
            <p className="text-sm text-slate-400 text-center">No client type data</p>
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

      {/* Web Analytics Row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Page Views"
          value={loadingAnalytics ? '...' : webAnalytics.pageViews}
          color="slate"
          icon={<IoEyeOutline className="w-5 h-5" />}
        />
        <MetricCard
          title="Book Now Clicks"
          value={loadingAnalytics ? '...' : webAnalytics.bookNowClicks}
          color="blue"
          icon={<IoArrowForwardOutline className="w-5 h-5" />}
        />
        <MetricCard
          title="Conversion Rate"
          value={loadingAnalytics ? '...' : `${webAnalytics.conversionRate}%`}
          subtitle={webAnalytics.bookNowClicks > 0 ? `${webAnalytics.bookNowClicks} clicks` : 'No clicks'}
          color="green"
          icon={<IoCashOutline className="w-5 h-5" />}
        />
        <MetricCard
          title="Incomplete Bookings"
          value={incompleteBookingsList.length}
          subtitle="Started but didn't finish"
          color="orange"
          icon={<IoCloseCircleOutline className="w-5 h-5" />}
        />
      </div>

      {/* Location Breakdown Summary */}
      {locationBreakdown.studio + locationBreakdown.homeService > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            title="Studio"
            value={`${studioPercentage}%`}
            subtitle={`${locationBreakdown.studio} booking${locationBreakdown.studio !== 1 ? 's' : ''}`}
            color="purple"
          />
          <MetricCard
            title="Home Service"
            value={`${homeServicePercentage}%`}
            subtitle={`${locationBreakdown.homeService} booking${locationBreakdown.homeService !== 1 ? 's' : ''}`}
            color="pink"
          />
        </div>
      )}

      {/* Client Source Breakdown */}
      {totalSources > 0 && (
        <div className="grid gap-4 lg:grid-cols-1">
          <DonutChartCard title="Client Source / Referral" data={clientSourceChartData} />
        </div>
      )}

      {/* Client Type Summary */}
      {clientTypeBreakdown.new + clientTypeBreakdown.repeat > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            title="New Clients"
            value={`${newClientPercentage}%`}
            subtitle={`${clientTypeBreakdown.new} booking${clientTypeBreakdown.new !== 1 ? 's' : ''}`}
            color="blue"
          />
          <MetricCard
            title="Repeat Clients"
            value={`${repeatClientPercentage}%`}
            subtitle={`${clientTypeBreakdown.repeat} booking${clientTypeBreakdown.repeat !== 1 ? 's' : ''}`}
            color="green"
          />
        </div>
      )}

      {/* Client Source Summary */}
      {totalSources > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {clientSourceBreakdown.facebook > 0 && (
            <MetricCard
              title="Facebook"
              value={clientSourceBreakdown.facebook}
              subtitle={`${totalSources > 0 ? ((clientSourceBreakdown.facebook / totalSources) * 100).toFixed(1) : '0'}%`}
              color="blue"
            />
          )}
          {clientSourceBreakdown.tiktok > 0 && (
            <MetricCard
              title="TikTok"
              value={clientSourceBreakdown.tiktok}
              subtitle={`${totalSources > 0 ? ((clientSourceBreakdown.tiktok / totalSources) * 100).toFixed(1) : '0'}%`}
              color="slate"
            />
          )}
          {clientSourceBreakdown.instagram > 0 && (
            <MetricCard
              title="Instagram"
              value={clientSourceBreakdown.instagram}
              subtitle={`${totalSources > 0 ? ((clientSourceBreakdown.instagram / totalSources) * 100).toFixed(1) : '0'}%`}
              color="pink"
            />
          )}
          {clientSourceBreakdown.referral > 0 && (
            <MetricCard
              title="Referred"
              value={clientSourceBreakdown.referral}
              subtitle={`${totalSources > 0 ? ((clientSourceBreakdown.referral / totalSources) * 100).toFixed(1) : '0'}%`}
              color="purple"
            />
          )}
          {clientSourceBreakdown.other > 0 && (
            <MetricCard
              title="Other"
              value={clientSourceBreakdown.other}
              subtitle={`${totalSources > 0 ? ((clientSourceBreakdown.other / totalSources) * 100).toFixed(1) : '0'}%`}
              color="slate"
            />
          )}
        </div>
      )}

      {/* Middle Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue Trend Line Chart */}
        <LineChartCard title="Revenue Trend" data={revenueData.trend} />

        {/* Top Services Bar Chart */}
        <BarChartCard title="Top Services" data={topServices} />
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming Bookings */}
        <ListCard
          title="Upcoming Bookings"
          items={upcomingBookingsList}
          emptyMessage="No upcoming bookings"
        />

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

