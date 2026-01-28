'use client';

import { useEffect, useMemo, useState, Suspense, useRef } from 'react';
import { format, startOfMonth, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth as startOfMonthFn, endOfMonth, parseISO, isWithinInterval, addMonths, subMonths } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Prevent static generation - this page requires Firebase client SDK
export const dynamic = 'force-dynamic';
import type { BlockedDate, Booking, BookingWithSlot, Invoice, Slot } from '@/lib/types';
import { formatTime12Hour, getNailTechColorClasses } from '@/lib/utils';
import { CustomSelect } from '@/components/admin/CustomSelect';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import { IoStatsChart, IoCalendar, IoCash, IoPeople, IoSparkles, IoChevronBack, IoChevronForward, IoLogOutOutline, IoMenu, IoClose, IoLockClosed } from 'react-icons/io5';
import Image from 'next/image';
import { SlotCard } from '@/components/admin/SlotCard';
import { SlotEditorModal } from '@/components/admin/modals/SlotEditorModal';
import { BulkSlotCreatorModal } from '@/components/admin/modals/BulkSlotCreatorModal';
import { BlockDateModal } from '@/components/admin/modals/BlockDateModal';
import { DeleteSlotModal } from '@/components/admin/modals/DeleteSlotModal';
import { DeleteDaySlotsModal } from '@/components/admin/modals/DeleteDaySlotsModal';
import { BookingList } from '@/components/admin/BookingList';
import { BookingDetailPanel } from '@/components/admin/BookingDetailPanel';
import { BookingsView } from '@/components/BookingsView';
import { ServicesManager } from '@/components/admin/ServicesManager';
import { QuotationModal } from '@/components/admin/modals/QuotationModal';
import { RescheduleModal } from '@/components/admin/modals/RescheduleModal';
import { SplitRescheduleModal } from '@/components/admin/modals/SplitRescheduleModal';
import { ReleaseSlotsModal } from '@/components/admin/modals/ReleaseSlotsModal';
import { RecoverBookingModal } from '@/components/admin/modals/RecoverBookingModal';
import { FormResponseModal } from '@/components/admin/modals/FormResponseModal';
import { CancelBookingModal } from '@/components/admin/modals/CancelBookingModal';
import { FinanceView } from '@/components/admin/FinanceView';
import { CustomerList } from '@/components/admin/CustomerList';
import { CustomerDetailPanel } from '@/components/admin/CustomerDetailPanel';
import { AnalyticsDashboard } from '@/components/admin/analytics/AnalyticsDashboard';
import { NailTechManager } from '@/components/admin/NailTechManager';
import { UserManager } from '@/components/admin/UserManager';
import { useUserRole } from '@/lib/hooks/useUserRole';
import type { Customer, NailTech, Notification } from '@/lib/types';
import { IoPerson } from 'react-icons/io5';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { 
  subscribeToNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  notifySlotAdded,
  notifySlotRemoved,
  notifySlotUpdated,
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyBookingPending
} from '@/lib/services/notificationService';

const navItems = [
  { id: 'overview', label: 'Overview', icon: IoStatsChart },
  { id: 'bookings', label: 'Bookings', icon: IoCalendar },
  { id: 'finance', label: 'Finance', icon: IoCash },
  { id: 'customers', label: 'Customers', icon: IoPeople },
  { id: 'services', label: 'Services', icon: IoSparkles },
  { id: 'nail-techs', label: 'Nail Technicians', icon: IoPerson },
  { id: 'users', label: 'Users', icon: IoLockClosed },
] as const;

type AdminSection = (typeof navItems)[number]['id'];

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { permissions, loading: roleLoading, nailTechId, role } = useUserRole();
  const isUpdatingFromUrl = useRef(false);
  const hasInitializedDefaultTech = useRef(false);
  const hasLoadedCalendar = useRef(false);
  const slotCacheRef = useRef<Map<string, Slot[]>>(new Map());
  const bookingSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Filter nav items based on permissions
  const filteredNavItems = useMemo(() => {
    // If permissions are not loaded yet, show all items (for initial setup)
    if (!permissions) return navItems;
    
    return navItems.filter((item) => {
      switch (item.id) {
        case 'overview':
          return permissions.canViewOverview;
        case 'bookings':
          return permissions.canViewBookings;
        case 'finance':
          return permissions.canViewFinance;
        case 'customers':
          return permissions.canViewCustomers;
        case 'services':
          return permissions.canViewServices;
        case 'nail-techs':
          return permissions.canViewNailTechs;
        case 'users':
          // Allow access to users section if no role is set (initial setup) or if user has permission
          return permissions.canViewUsers;
        default:
          return true;
      }
    });
  }, [permissions]);
  
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  // Filter bookings and slots for staff based on assigned nail tech
  const filteredBookings = useMemo(() => {
    if (role !== 'staff' || !nailTechId) {
      return bookings;
    }
    return bookings.filter(booking => booking.nailTechId === nailTechId);
  }, [bookings, role, nailTechId]);

  const filteredSlots = useMemo(() => {
    if (role !== 'staff' || !nailTechId) {
      return slots;
    }
    return slots.filter(slot => slot.nailTechId === nailTechId);
  }, [slots, role, nailTechId]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [bulkSlotModalOpen, setBulkSlotModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [deleteSlotModalOpen, setDeleteSlotModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<Slot | null>(null);
  const [isDeletingSlot, setIsDeletingSlot] = useState(false);
  const [deleteDaySlotsModalOpen, setDeleteDaySlotsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [blockDefaults, setBlockDefaults] = useState<{ start?: string | null; end?: string | null }>({});
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true); // Separate loading state for calendar
  const [toast, setToast] = useState<string | null>(null);
  
  // Get section from URL params, default to 'bookings'
  const sectionFromUrl = searchParams.get('section') as AdminSection | null;
  const viewFromUrl = searchParams.get('view') as 'calendar' | 'list' | null;
  const [activeSection, setActiveSection] = useState<AdminSection>(
    (sectionFromUrl && navItems.some(item => item.id === sectionFromUrl)) ? sectionFromUrl : 'bookings'
  );
  const [bookingsView, setBookingsView] = useState<'calendar' | 'list'>(
    viewFromUrl === 'calendar' || viewFromUrl === 'list' ? viewFromUrl : 'calendar'
  );
  const [bookingFilterPeriod, setBookingFilterPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [quotationModalMode, setQuotationModalMode] = useState<'edit' | 'view'>('edit');
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [reschedulingBookingId, setReschedulingBookingId] = useState<string | null>(null);
  const [splitRescheduleModalOpen, setSplitRescheduleModalOpen] = useState(false);
  const [splitReschedulingBookingId, setSplitReschedulingBookingId] = useState<string | null>(null);
  const [releaseSlotsModalOpen, setReleaseSlotsModalOpen] = useState(false);
  const [recoverBookingModalOpen, setRecoverBookingModalOpen] = useState(false);
  const [cancelBookingModalOpen, setCancelBookingModalOpen] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([]);
  const [customerLifetimeValue, setCustomerLifetimeValue] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedNailTechId, setSelectedNailTechId] = useState<string | null>(null);
  const [nailTechs, setNailTechs] = useState<NailTech[]>([]);
  const [responseModalBooking, setResponseModalBooking] = useState<Booking | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const pendingBookingsCount = useMemo(
    () => bookings.filter((booking) => 
      booking.status === 'pending_payment' && 
      booking.customerData && 
      Object.keys(booking.customerData).length > 0
    ).length,
    [bookings],
  );

  const getCalendarRange = (monthDate: Date) => {
    const rangeStart = format(
      startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 }),
      'yyyy-MM-dd'
    );
    const rangeEnd = format(
      endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 }),
      'yyyy-MM-dd'
    );
    return { rangeStart, rangeEnd };
  };

  const customerStats = useMemo(() => {
    const totalCustomers = customers.length;

    // Count bookings per customer
    const bookingCounts: Record<string, number> = {};
    let cancelledBookings = 0;

    bookings.forEach((booking) => {
      if (booking.customerId) {
        bookingCounts[booking.customerId] = (bookingCounts[booking.customerId] || 0) + 1;
      }
      // Count cancelled bookings
      if (booking.status === 'cancelled') {
        cancelledBookings += 1;
      }
    });

    // Use isRepeatClient field to determine new vs repeat clients
    let newClients = 0;
    let repeatClients = 0;

    customers.forEach((customer) => {
      if (customer.isRepeatClient === true) {
        repeatClients += 1;
      } else {
        newClients += 1;
      }
    });

    const totalCustomerBookings = Object.values(bookingCounts).reduce((sum, value) => sum + value, 0);

    return {
      totalCustomers,
      newClients,
      repeatClients,
      totalCustomerBookings,
      cancelledBookings,
    };
  }, [customers, bookings]);

  const overviewStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth(); // 0-11
    const lastMonthIndex = (currentMonthIndex + 11) % 12;
    const lastMonthYear = currentMonthIndex === 0 ? currentYear - 1 : currentYear;

    let bookingsThisMonth = 0;
    let bookingsLastMonth = 0;
    let revenueThisMonth = 0;
    let revenueLastMonth = 0;

    const serviceCounts: Record<string, number> = {};
    let homeServiceCount = 0;
    let homebasedCount = 0;

    const monthly = Array.from({ length: 12 }, (_, idx) => ({
      monthIndex: idx,
      bookings: 0,
      revenue: 0,
    }));

    bookings.forEach((booking) => {
      // Skip bookings with deleted slots
      const slotExists = slots.some((slot) => slot.id === booking.slotId);
      if (!slotExists) return;

      const dateStr = booking.invoice?.createdAt ?? booking.createdAt;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return;

      const year = d.getFullYear();
      const monthIndex = d.getMonth(); // 0-11

      const revenue =
        (booking.depositAmount || 0) + (booking.paidAmount || 0) + (booking.tipAmount || 0);

      // Monthly aggregates
      monthly[monthIndex].bookings += 1;
      monthly[monthIndex].revenue += revenue;

      // This month vs last month
      if (year === currentYear && monthIndex === currentMonthIndex) {
        bookingsThisMonth += 1;
        revenueThisMonth += revenue;
      }
      if (year === lastMonthYear && monthIndex === lastMonthIndex) {
        bookingsLastMonth += 1;
        revenueLastMonth += revenue;
      }

      // Services
      if (booking.serviceType) {
        serviceCounts[booking.serviceType] = (serviceCounts[booking.serviceType] || 0) + 1;
      }

      // Location breakdown
      if (booking.serviceLocation === 'home_service') {
        homeServiceCount += 1;
      } else if (booking.serviceLocation === 'homebased_studio') {
        homebasedCount += 1;
      }
    });

    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([service, count]) => ({ service, count }));

    const maxMonthlyBookings = monthly.reduce(
      (max, m) => (m.bookings > max ? m.bookings : max),
      0,
    );
    const maxMonthlyRevenue = monthly.reduce(
      (max, m) => (m.revenue > max ? m.revenue : max),
      0,
    );

    return {
      bookingsThisMonth,
      bookingsLastMonth,
      revenueThisMonth,
      revenueLastMonth,
      topServices,
      homeServiceCount,
      homebasedCount,
      monthly,
      maxMonthlyBookings,
      maxMonthlyRevenue,
    };
  }, [bookings, slots]);

  async function syncBookingsInBackground() {
    try {
      const cacheBuster = Date.now().toString();
      const res = await fetch(`/api/bookings?sync=1&t=${cacheBuster}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      if (!res.ok) return;
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.warn('Background booking sync failed:', error);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, selectedNailTechId]);

  useEffect(() => {
    if (activeSection !== 'bookings' && activeSection !== 'overview') {
      if (bookingSyncIntervalRef.current) {
        clearInterval(bookingSyncIntervalRef.current);
        bookingSyncIntervalRef.current = null;
      }
      return;
    }

    // Sync immediately and keep it fresh in the background
    syncBookingsInBackground();
    bookingSyncIntervalRef.current = setInterval(syncBookingsInBackground, 20000);

    return () => {
      if (bookingSyncIntervalRef.current) {
        clearInterval(bookingSyncIntervalRef.current);
        bookingSyncIntervalRef.current = null;
      }
    };
  }, [activeSection]);

  // Subscribe to notifications
  useEffect(() => {
    const unsubscribe = subscribeToNotifications((newNotifications) => {
      setNotifications(newNotifications);
    }, 50);

    return () => unsubscribe();
  }, []);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    markNotificationAsRead(notification.id);
    
    // Navigate to relevant section
    if (notification.section) {
      setActiveSection(notification.section as AdminSection);
    }
    
    // If it's a booking notification, try to select the booking
    if (notification.relatedType === 'booking' && notification.relatedId) {
      setSelectedBookingId(notification.relatedId);
    }
    
    // If it's a slot notification, try to select the date
    if (notification.relatedType === 'slot' && notification.relatedId) {
      const slot = slots.find(s => s.id === notification.relatedId);
      if (slot) {
        setSelectedDate(slot.date);
        setActiveSection('bookings');
        setBookingsView('calendar');
      }
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    await markAllNotificationsAsRead();
  };

  // Sync state with URL params - only when URL actually changes
  useEffect(() => {
    const section = searchParams.get('section') as AdminSection | null;
    const view = searchParams.get('view') as 'calendar' | 'list' | null;
    
    // Update section from URL
    const targetSection = (section && navItems.some(item => item.id === section)) ? section : 'bookings';
    if (targetSection !== activeSection) {
      isUpdatingFromUrl.current = true;
      setActiveSection(targetSection);
    }
    
    // Update view from URL (only relevant for bookings section)
    if (targetSection === 'bookings') {
      const targetView = (view === 'calendar' || view === 'list') ? view : 'calendar';
      if (targetView !== bookingsView) {
        isUpdatingFromUrl.current = true;
        setBookingsView(targetView);
      }
    }
    // Note: We intentionally only depend on searchParams, not on activeSection/bookingsView
    // to avoid infinite loops. The effect should only run when URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Clear nail tech filter when switching to finance section
  useEffect(() => {
    if (activeSection === 'finance') {
      setSelectedNailTechId(null);
    }
  }, [activeSection]);

  // Update URL when activeSection changes (user action, not from URL sync)
  useEffect(() => {
    if (isUpdatingFromUrl.current) {
      isUpdatingFromUrl.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (activeSection !== 'bookings') {
      params.set('section', activeSection);
    }
    // Preserve view param if on bookings section
    if (activeSection === 'bookings' && bookingsView !== 'calendar') {
      params.set('view', bookingsView);
    }
    
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/admin/dashboard${newUrl}`, { scroll: false });
  }, [activeSection, bookingsView, router]);

  // Update URL when bookingsView changes (user action, only for bookings section)
  useEffect(() => {
    if (isUpdatingFromUrl.current) {
      isUpdatingFromUrl.current = false;
      return;
    }

    if (activeSection !== 'bookings') {
      return; // View changes only matter for bookings section
    }

    const params = new URLSearchParams();
    if (bookingsView !== 'calendar') {
      params.set('view', bookingsView);
    }
    
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/admin/dashboard${newUrl}`, { scroll: false });
  }, [bookingsView, activeSection, router]);

  async function loadData() {
    try {
      const isFirstLoad = !hasLoadedCalendar.current;
      setLoading(isFirstLoad);
      if (isFirstLoad) {
        setLoadingCalendar(true);
      }
      // Add cache-busting timestamp to prevent stale data in production
      const cacheBuster = Date.now().toString();
      const { rangeStart: calendarStart, rangeEnd: calendarEnd } = getCalendarRange(currentMonth);
      const slotParams = new URLSearchParams({
        t: cacheBuster,
        startDate: calendarStart,
        endDate: calendarEnd,
      });
      if (selectedNailTechId) {
        slotParams.set('nailTechId', selectedNailTechId);
      }
      const slotCacheKey = `${selectedNailTechId || 'all'}:${calendarStart}:${calendarEnd}`;
      const cachedSlots = slotCacheRef.current.get(slotCacheKey);
      if (cachedSlots && cachedSlots.length > 0) {
        setSlots(cachedSlots);
      }
      
      // Load calendar data + bookings together so calendar statuses are accurate on first render
      const [slotsRes, blocksRes, nailTechsRes, bookingsRes, customersRes] = await Promise.all([
        fetch(`/api/slots?${slotParams.toString()}`, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        }).then((res) => res.json()),
        fetch(`/api/blocks?t=${cacheBuster}`, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        }).then((res) => res.json()),
        fetch(`/api/nail-techs?t=${cacheBuster}`, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        }).then((res) => res.json()).catch(() => ({ nailTechs: [] })),
        fetch(`/api/bookings?sync=0&t=${cacheBuster}`, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        }).then((res) => res.json()).catch(() => ({ bookings: [] })),
        fetch(`/api/customers?t=${cacheBuster}`, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        }).then((res) => res.json()).catch(() => ({ customers: [] })),
      ]);
      
      // Set calendar + booking data together so badges are accurate
      setSlots(slotsRes.slots);
      slotCacheRef.current.set(slotCacheKey, slotsRes.slots);
      setBlockedDates(blocksRes.blockedDates);
      setNailTechs(nailTechsRes.nailTechs || []);
      setBookings(bookingsRes.bookings || []);
      setCustomers(customersRes.customers || []);
      
      // Mark calendar as loaded after bookings are ready
      setLoadingCalendar(false);
      hasLoadedCalendar.current = true;
      
      // Default to Ms. Jhen (Owner) only on first load (avoid resetting on month change)
      // Don't set default for finance section, show all bookings by default
      const nailTechsList = nailTechsRes.nailTechs || [];
      if (!hasInitializedDefaultTech.current) {
        if (!selectedNailTechId && nailTechsList.length > 0) {
          // Only set default if we're in bookings/calendar section, not finance
          if (activeSection === 'bookings' || activeSection === 'overview') {
            // First try to find Ms. Jhen by name (case insensitive)
            let defaultTech = nailTechsList.find((tech: NailTech) => 
              tech.name.toLowerCase().includes('jhen') && 
              tech.status === 'Active'
            );
            
            // If not found, try any Owner with Active status
            if (!defaultTech) {
              defaultTech = nailTechsList.find((tech: NailTech) => 
                tech.role === 'Owner' && tech.status === 'Active'
              );
            }
            
            // If still not found, get first active tech
            if (!defaultTech) {
              defaultTech = nailTechsList.find((tech: NailTech) => tech.status === 'Active') || nailTechsList[0];
            }
            
            if (defaultTech) {
              setSelectedNailTechId(defaultTech.id);
            }
          }
        }
        hasInitializedDefaultTech.current = true;
      }
      
      // Bookings/customers already loaded above for consistency
      const prefetchSlotsForMonth = async (monthDate: Date) => {
        const { rangeStart, rangeEnd } = getCalendarRange(monthDate);
        const prefetchKey = `${selectedNailTechId || 'all'}:${rangeStart}:${rangeEnd}`;
        if (slotCacheRef.current.has(prefetchKey)) return;
        const prefetchParams = new URLSearchParams({
          t: Date.now().toString(),
          startDate: rangeStart,
          endDate: rangeEnd,
        });
        if (selectedNailTechId) {
          prefetchParams.set('nailTechId', selectedNailTechId);
        }
        try {
          const prefetchRes = await fetch(`/api/slots?${prefetchParams.toString()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            }
          });
          if (!prefetchRes.ok) return;
          const prefetchData = await prefetchRes.json();
          slotCacheRef.current.set(prefetchKey, prefetchData.slots || []);
        } catch (error) {
          console.warn('Prefetch slots failed:', error);
        }
      };

      // Prefetch adjacent months to avoid empty gaps on next/prev navigation
      prefetchSlotsForMonth(addMonths(currentMonth, 1));
      prefetchSlotsForMonth(subMonths(currentMonth, 1));
    } catch (error) {
      console.error('Failed to load admin data', error);
      setToast('Unable to load data. Check your backend configuration.');
      setLoadingCalendar(false); // Still allow calendar to render even on error
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomerDetails(customerId: string) {
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const data = await res.json();
      setSelectedCustomer(data.customer);
      setCustomerBookings(data.bookings || []);
      setCustomerLifetimeValue(data.lifetimeValue || 0);
    } catch (error) {
      console.error('Failed to load customer details', error);
      setToast('Unable to load customer details.');
    }
  }

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerDetails(selectedCustomerId);
    } else {
      setSelectedCustomer(null);
      setCustomerBookings([]);
      setCustomerLifetimeValue(0);
    }
  }, [selectedCustomerId]);

  // Memoize filtered slots for calendar (by nail tech) - used for calendar display
  const calendarSlots = useMemo(() => {
    if (selectedNailTechId) {
      return filteredSlots.filter(s => s.nailTechId === selectedNailTechId);
    }
    return filteredSlots;
  }, [filteredSlots, selectedNailTechId]);

  const selectedSlots = useMemo(() => {
    // PRIORITIZE ALL SLOTS: Include all slot statuses (available, pending, confirmed, blocked)
    // This ensures confirmed slots are always visible
    let filteredSlots = slots.filter((slot) => slot.date === selectedDate);
    if (selectedNailTechId) {
      filteredSlots = filteredSlots.filter((slot) => slot.nailTechId === selectedNailTechId);
    }
    
    // Log for debugging: check if confirmed slots are being filtered out
    const confirmedSlots = filteredSlots.filter(s => s.status === 'confirmed');
    if (confirmedSlots.length > 0) {
      console.log(`Found ${confirmedSlots.length} confirmed slot(s) for ${selectedDate}:`, confirmedSlots.map(s => ({ id: s.id, time: s.time, status: s.status })));
    }
    
    // Sort slots by time to ensure consistent display order
    return filteredSlots.sort((a, b) => a.time.localeCompare(b.time));
  }, [slots, selectedDate, selectedNailTechId]);

  const bookingsWithSlots = useMemo<BookingWithSlot[]>(() => {
    const list: BookingWithSlot[] = [];
    let filteredBookings = bookings;
    
    // Filter bookings by selected nail tech if one is selected
    if (selectedNailTechId) {
      filteredBookings = bookings.filter((booking) => booking.nailTechId === selectedNailTechId);
    }
    
    filteredBookings.forEach((booking) => {
      const slot = slots.find((candidate) => candidate.id === booking.slotId);
      if (!slot) return;
      
      // Also filter by selected nail tech for slots (double-check)
      if (selectedNailTechId && slot.nailTechId !== selectedNailTechId) return;
      
      const linkedSlots = (booking.linkedSlotIds ?? [])
        .map((linkedId) => slots.find((candidate) => candidate.id === linkedId))
        .filter((value): value is Slot => Boolean(value))
        .filter((linkedSlot) => !selectedNailTechId || linkedSlot.nailTechId === selectedNailTechId);
      const pairedSlot = linkedSlots[0];
      list.push({ ...booking, slot, pairedSlot, linkedSlots });
    });
    return list;
  }, [bookings, slots, selectedNailTechId]);

  // Filter bookings by time period (today, week, month)
  // Filter by appointment date (for calendar view)
  const filteredBookingsWithSlots = useMemo<BookingWithSlot[]>(() => {
    if (bookingFilterPeriod === 'today') {
      const today = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      return bookingsWithSlots.filter((booking) => {
        if (!booking.slot) return false;
        const slotDate = parseISO(booking.slot.date);
        return isWithinInterval(slotDate, { start: today, end: todayEnd });
      });
    } else if (bookingFilterPeriod === 'week') {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      return bookingsWithSlots.filter((booking) => {
        if (!booking.slot) return false;
        const slotDate = parseISO(booking.slot.date);
        return isWithinInterval(slotDate, { start: weekStart, end: weekEnd });
      });
    } else if (bookingFilterPeriod === 'month') {
      const monthStart = startOfMonthFn(new Date());
      const monthEnd = endOfMonth(new Date());
      return bookingsWithSlots.filter((booking) => {
        if (!booking.slot) return false;
        const slotDate = parseISO(booking.slot.date);
        return isWithinInterval(slotDate, { start: monthStart, end: monthEnd });
      });
    }
    return bookingsWithSlots;
  }, [bookingsWithSlots, bookingFilterPeriod]);

  const selectedBooking = selectedBookingId
    ? bookingsWithSlots.find((booking) => booking.id === selectedBookingId) ?? null
    : null;

  async function handleSaveSlot(payload: { date: string; time: string; status: Slot['status']; slotType?: 'regular' | 'with_squeeze_fee' | null; notes?: string }) {
    const url = editingSlot ? `/api/slots/${editingSlot.id}` : '/api/slots';
    const method = editingSlot ? 'PATCH' : 'POST';
    
    // For staff users, validate they can only edit/create slots for their assigned nail tech
    if (role === 'staff' && nailTechId) {
      if (editingSlot && editingSlot.nailTechId !== nailTechId) {
        throw new Error('You can only edit slots for your assigned nail technician.');
      }
    }
    
    // For staff users, always use their assigned nail tech ID
    // For other roles, use selected nail tech ID or default
    const nailTechIdForSlot = role === 'staff' && nailTechId 
      ? nailTechId 
      : (selectedNailTechId || null);
    
    // When creating a new slot, include the nail tech ID
    const requestPayload = editingSlot 
      ? payload 
      : { ...payload, nailTechId: nailTechIdForSlot };
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    if (!res.ok) {
      let errorMessage = 'Failed to save slot.';
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const errorText = await res.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    const savedSlotResponse = await res.json();
    const savedSlot: Slot = savedSlotResponse.slot ?? savedSlotResponse;

    setSlots((prevSlots) => {
      const nextSlots = editingSlot
        ? prevSlots.map((slot) => (slot.id === savedSlot.id ? savedSlot : slot))
        : [...prevSlots, savedSlot];
      return nextSlots.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
    });
    
    // Create notification for slot added/updated
    try {
      if (editingSlot) {
        await notifySlotUpdated(savedSlot.id || editingSlot.id, payload.date, formatTime12Hour(payload.time));
      } else {
        await notifySlotAdded(savedSlot.id, payload.date, formatTime12Hour(payload.time));
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
    
    setToast('Slot saved.');
  }

  function handleDeleteSlot(slot: Slot) {
    setSlotToDelete(slot);
    setDeleteSlotModalOpen(true);
  }

  async function confirmDeleteSlot() {
    if (!slotToDelete) return;
    setIsDeletingSlot(true);
    try {
      const res = await fetch(`/api/slots/${slotToDelete.id}`, { 
        method: 'DELETE',
        cache: 'no-store', // Prevent caching in production
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete slot' }));
        throw new Error(error.error || 'Failed to delete slot');
      }
      
      await res.json();
      setSlots((prevSlots) => prevSlots.filter((slot) => slot.id !== slotToDelete.id));
      
      // Create notification for slot removed
      try {
        await notifySlotRemoved(slotToDelete.id, slotToDelete.date, formatTime12Hour(slotToDelete.time));
      } catch (error) {
        console.error('Failed to create notification:', error);
      }
      
      setToast('Slot deleted.');
      setDeleteSlotModalOpen(false);
      setSlotToDelete(null);
    } catch (error: any) {
      console.error('Error deleting slot:', error);
      setToast(`Failed to delete slot: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDeletingSlot(false);
    }
  }

  async function handleDeleteDaySlots(onlyAvailable: boolean) {
    try {
      const url = `/api/slots/by-date?date=${selectedDate}${onlyAvailable ? '&onlyAvailable=true' : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete slots.');
      }
      setSlots((prevSlots) =>
        prevSlots.filter((slot) => {
          if (slot.date !== selectedDate) return true;
          return onlyAvailable ? slot.status !== 'available' : false;
        })
      );
      setToast(data.message || `Deleted ${data.deletedCount} slot(s).`);
      setDeleteDaySlotsModalOpen(false);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete slots.';
      setToast(errorMessage);
      throw error; // Re-throw so modal can handle it
    }
  }

  async function handleBlockDates(payload: { startDate: string; endDate: string; scope: BlockedDate['scope']; reason?: string }) {
    const res = await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    await loadData();
    setToast('Dates blocked.');
  }

  async function handleConfirmBooking(id: string, depositAmount?: number, depositPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'confirm',
          depositAmount: depositAmount !== undefined ? depositAmount : null,
          depositPaymentMethod: depositPaymentMethod,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to confirm booking');
      }
      
      // Immediately update the local booking state to 'confirmed' to prevent UI loop
      // This prevents the confirm button from showing again while waiting for Firebase
      setBookings(prevBookings => 
        prevBookings.map(booking => {
          if (booking.id === id) {
            const updated: Booking = { ...booking, status: 'confirmed' as const };
            if (depositAmount !== undefined && depositAmount !== null && depositAmount > 0) {
              updated.depositAmount = depositAmount;
              updated.depositDate = new Date().toISOString();
              updated.paymentStatus = 'partial';
              if (depositPaymentMethod) {
                updated.depositPaymentMethod = depositPaymentMethod;
              }
            }
            return updated;
          }
          return booking;
        })
      );
      
      // Wait a bit to ensure Firebase transaction completes before refreshing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload data from Firebase to get the actual confirmed status
      await loadData();
      
      // Re-select the booking after refresh to ensure UI updates
      setSelectedBookingId(id);
      
      // Create notification for booking confirmed
      try {
        const booking = bookings.find(b => b.id === id);
        const customer = booking ? customers.find(c => c.id === booking.customerId) : null;
        const customerName = customer?.name || 'Unknown Customer';
        if (booking) {
          await notifyBookingConfirmed(booking.id, customerName);
        }
      } catch (error) {
        console.error('Failed to create notification:', error);
      }
      
      setToast(depositAmount ? `Booking confirmed. Deposit: ₱${depositAmount.toLocaleString('en-PH')}` : 'Booking confirmed.');
    } catch (error: any) {
      console.error('Failed to confirm booking:', error);
      setToast(`Error: ${error.message || 'Failed to confirm booking'}`);
    }
  }

  async function handleCancelBooking(id: string): Promise<void> {
    setCancellingBookingId(id);
    setCancelBookingModalOpen(true);
    // Return immediately - the actual cancellation happens in confirmCancelBooking
    return Promise.resolve();
  }

  async function confirmCancelBooking(releaseSlot: boolean = true) {
    if (!cancellingBookingId) return;
    
    setIsCancellingBooking(true);
    try {
      const res = await fetch(`/api/bookings/${cancellingBookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', releaseSlot }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        setToast(`Error: ${error.error || 'Failed to cancel booking'}`);
        setIsCancellingBooking(false);
        return;
      }
      
      // Update local state immediately for better UX
      setBookings(prev => prev.map(b => 
        b.id === cancellingBookingId ? { ...b, status: 'cancelled' as const } : b
      ));
      
      // Create notification for booking cancelled
      try {
        const booking = bookings.find(b => b.id === cancellingBookingId);
        const customer = booking ? customers.find(c => c.id === booking.customerId) : null;
        const customerName = customer?.name || 'Unknown Customer';
        if (booking) {
          await notifyBookingCancelled(booking.id, customerName);
        }
      } catch (error) {
        console.error('Failed to create notification:', error);
      }
      
      setToast('Booking cancelled.');
      setSelectedBookingId(null);
      setCancelBookingModalOpen(false);
      setCancellingBookingId(null);
      
      // Reload data in background to ensure consistency
      loadData().catch(err => {
        console.error('Failed to reload data:', err);
      });
    } catch (error: any) {
      setToast(`Error: ${error.message || 'Failed to cancel booking'}`);
    } finally {
      setIsCancellingBooking(false);
    }
  }

  function handleRescheduleBooking(id: string) {
    setReschedulingBookingId(id);
    setRescheduleModalOpen(true);
  }

  function handleSplitRescheduleBooking(id: string) {
    setSplitReschedulingBookingId(id);
    setSplitRescheduleModalOpen(true);
  }

  async function handleRescheduleConfirm(bookingId: string, newSlotId: string, linkedSlotIds?: string[]) {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reschedule',
        newSlotId,
        linkedSlotIds,
      }),
    });
    if (!res.ok) {
      const error = await res.json();
      setToast(`Error: ${error.error || 'Failed to reschedule booking'}`);
      return;
    }
    await loadData();
    setToast('Booking rescheduled successfully.');
    setRescheduleModalOpen(false);
    setReschedulingBookingId(null);
  }

  async function handleSplitRescheduleConfirm(
    bookingId: string,
    slot1Id: string,
    slot2Id: string,
    nailTech1Id: string,
    nailTech2Id: string
  ) {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'split_reschedule',
        slot1Id,
        slot2Id,
        nailTech1Id,
        nailTech2Id,
      }),
    });
    if (!res.ok) {
      const error = await res.json();
      setToast(`Error: ${error.error || 'Failed to split reschedule booking'}`);
      return;
    }
    await loadData();
    setToast('Booking split and rescheduled successfully. Two separate bookings created.');
    setSplitRescheduleModalOpen(false);
    setSplitReschedulingBookingId(null);
  }

  function handleMakeQuotation(id: string) {
    setSelectedBookingId(id);
    setQuotationModalMode('edit');
    setQuotationModalOpen(true);
  }

  function handleViewInvoice(id: string) {
    setSelectedBookingId(id);
    setQuotationModalMode('view');
    setQuotationModalOpen(true);
  }

  async function handleSendInvoice(bookingId: string, invoiceData: Invoice) {
    // Note: Invoice is already saved in QuotationModal, so we just need to update local state
    // This is much faster than reloading all data
    try {
      // Update the booking in local state without reloading everything
      setBookings(prevBookings => 
        prevBookings.map(booking => 
          booking.id === bookingId 
            ? { ...booking, invoice: invoiceData as any }
            : booking
        )
      );
      setToast('Invoice saved successfully.');
    } catch (error) {
      console.error('Error updating local state:', error);
      // Fallback to full reload if local update fails
      await loadData();
      setToast('Invoice saved (reloaded data).');
    }
  }

  async function handleSyncSheets() {
    const res = await fetch('/api/google/sync', { method: 'POST' });
    const data = await res.json();
    await loadData();
    setToast(`Processed ${data.processed} new form responses.`);
  }

  async function handleReleaseSlots(bookingIds: string[]) {
    const res = await fetch('/api/bookings/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingIds }),
    });
    const data = await res.json();
    if (res.ok) {
      await loadData();
      setToast(data.message || `Released ${data.released} booking(s)`);
    } else {
      throw new Error(data.error || 'Failed to release bookings');
    }
  }

  async function handleRecoverBooking(bookingId: string) {
    const res = await fetch('/api/bookings/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json();
    if (res.ok) {
      await loadData();
      setToast(data.message || `Booking ${bookingId} recovered successfully`);
    } else {
      throw new Error(data.error || 'Failed to recover booking');
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      router.push('/admin');
    } catch (error) {
      console.error('Failed to sign out', error);
      setToast('Failed to sign out. Please try again.');
    }
  }

  const renderBookingsSection = () => (
    <>
      {/* Sub-navigation for bookings view - at the very top */}
      <div className="mb-3 sm:mb-4 flex gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-1 w-full sm:w-fit">
        <button
          onClick={() => setBookingsView('calendar')}
          className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition touch-manipulation ${
            bookingsView === 'calendar'
              ? 'bg-black text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="hidden sm:inline">Calendar & Slots</span>
          <span className="sm:hidden">Calendar</span>
        </button>
        <button
          onClick={() => setBookingsView('list')}
          className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition touch-manipulation ${
            bookingsView === 'list'
              ? 'bg-black text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="hidden sm:inline">View Bookings</span>
          <span className="sm:hidden">Bookings</span>
        </button>
      </div>

      {/* Action buttons below subtab - only for calendar view (simplified, with Release Slots) */}
      {bookingsView === 'calendar' && (
        <div className="mb-4 sm:mb-6 flex flex-wrap gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingSlot(null);
              setSlotModalOpen(true);
            }}
            className="rounded-full bg-green-300 px-4 sm:px-6 py-2 text-xs sm:text-sm font-semibold text-green-800 hover:bg-green-400 touch-manipulation"
          >
            New slot
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkSlotModalOpen(true);
            }}
            className="rounded-full bg-blue-300 px-4 sm:px-6 py-2 text-xs sm:text-sm font-semibold text-blue-800 hover:bg-blue-400 touch-manipulation"
          >
            <span className="hidden sm:inline">Bulk create slots</span>
            <span className="sm:hidden">Bulk create</span>
          </button>
          <button
            type="button"
            onClick={() => setReleaseSlotsModalOpen(true)}
            className="rounded-full border border-amber-200 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-amber-700 hover:border-amber-600 hover:bg-amber-50 touch-manipulation"
          >
            <span className="hidden sm:inline">Release Slots</span>
            <span className="sm:hidden">Release</span>
          </button>
        </div>
      )}

      {toast && (
        <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl bg-emerald-50 px-3 sm:px-4 py-2 text-xs sm:text-sm text-emerald-700 flex items-center justify-between gap-2">
          <span className="flex-1">{toast}</span>
          <button className="text-xs uppercase font-semibold touch-manipulation" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
        </div>
      ) : bookingsView === 'list' ? (
        <BookingsView
          bookings={filteredBookings}
          slots={filteredSlots}
          selectedDate={selectedDate}
          customers={customers}
          nailTechs={nailTechs}
          onServiceTypeChange={loadData}
          selectedNailTechId={selectedNailTechId}
          onNailTechChange={setSelectedNailTechId}
          onCancel={handleCancelBooking}
          onReschedule={handleRescheduleBooking}
          onSplitReschedule={handleSplitRescheduleBooking}
          onMakeQuotation={handleMakeQuotation}
          onConfirm={handleConfirmBooking}
          onUpdatePayment={async (bookingId, paymentStatus, paidAmount, tipAmount) => {
            const res = await fetch(`/api/bookings/${bookingId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update_payment',
                paymentStatus,
                paidAmount,
                tipAmount,
              }),
            });
            if (res.ok) {
              // Update local state instead of reloading all data - much faster
              try {
                setBookings(prevBookings => 
                  prevBookings.map(booking => 
                    booking.id === bookingId 
                      ? { 
                          ...booking, 
                          paymentStatus, 
                          paidAmount: paidAmount ?? booking.paidAmount,
                          tipAmount: tipAmount ?? booking.tipAmount,
                          status: paymentStatus === 'paid' ? 'confirmed' : booking.status
                        }
                      : booking
                  )
                );
                const message = tipAmount && tipAmount > 0 
                  ? `Payment status updated. Tip: ₱${tipAmount.toLocaleString('en-PH')}`
                  : 'Payment status updated.';
                setToast(message);
              } catch (error) {
                console.error('Error updating local state:', error);
                // Fallback to full reload if local update fails
                await loadData();
                setToast('Payment status updated (reloaded data).');
              }
            }
          }}
        />
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Nail Tech Selector */}
          <div className="rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white p-3 sm:p-4">
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
              {role === 'staff' && nailTechId ? 'Your Assigned Nail Technician' : 'Select Nail Technician Calendar'}
            </label>
            {role === 'staff' && nailTechId ? (
              <div className="text-sm text-slate-600">
                <p className="font-medium">Ms. {nailTechs.find(t => t.id === nailTechId)?.name || 'Unknown'}</p>
                <p className="text-xs text-slate-500 mt-1">You can only view bookings and slots for your assigned nail technician.</p>
              </div>
            ) : (
              <div className="relative">
                <CustomSelect
                  value={selectedNailTechId || ''}
                  onChange={(newNailTechId) => {
                    const value = newNailTechId || null;
                    setSelectedNailTechId(value);
                    // Reset selected date when switching techs for clarity
                    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                  }}
                  options={[
                    { value: '', label: 'All Nail Techs' },
                    ...nailTechs.sort((a, b) => a.name.localeCompare(b.name)).map((tech) => ({
                      value: tech.id,
                      label: `Ms. ${tech.name} (${tech.role})`,
                    })),
                  ]}
                  placeholder={nailTechs.length === 0 ? 'Loading nail techs...' : 'Select nail tech...'}
                  className="w-full sm:w-auto"
                  allNailTechIds={[...nailTechs].sort((a, b) => a.name.localeCompare(b.name)).map(t => t.id)}
                />
                {selectedNailTechId && nailTechs.find(t => t.id === selectedNailTechId) && (() => {
                  const sortedTechIds = [...nailTechs].sort((a, b) => a.name.localeCompare(b.name)).map(t => t.id);
                  return (
                    <div className={`absolute right-8 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${getNailTechColorClasses(selectedNailTechId, sortedTechIds)} pointer-events-none`} />
                  );
                })()}
              </div>
            )}
            {selectedNailTechId && (
              <p className="mt-2 text-xs text-slate-600">
                Viewing calendar for: <strong>Ms. {nailTechs.find(t => t.id === selectedNailTechId)?.name || selectedNailTechId}</strong>
              </p>
            )}
          </div>

          {/* Calendar and Slots side by side */}
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[2fr,1fr] xl:grid-cols-[2.5fr,1fr]">
            <div>
              {loadingCalendar ? (
                <div className="rounded-2xl sm:rounded-3xl border-2 border-slate-300 bg-slate-100 p-3 sm:p-4 md:p-6 shadow-md shadow-slate-900/10 animate-pulse">
                  <div className="mb-3 sm:mb-4 md:mb-6 flex items-center justify-between">
                    <div>
                      <div className="h-3 w-24 bg-slate-300 rounded mb-2"></div>
                      <div className="h-6 w-32 bg-slate-300 rounded"></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-16 bg-slate-300 rounded-full"></div>
                      <div className="h-8 w-16 bg-slate-300 rounded-full"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <div key={i} className="h-16 sm:h-20 bg-slate-200 rounded-lg"></div>
                    ))}
                  </div>
                </div>
              ) : (
                <CalendarGrid
                  referenceDate={currentMonth}
                  slots={calendarSlots}
                  bookings={filteredBookings.filter((booking) => booking.status !== 'cancelled')}
                  blockedDates={blockedDates}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onChangeMonth={setCurrentMonth}
                  nailTechName={selectedNailTechId ? `Ms. ${nailTechs.find(t => t.id === selectedNailTechId)?.name || ''}` : undefined}
                />
              )}
            </div>

            <section className="rounded-2xl sm:rounded-3xl border-2 border-slate-300 bg-white p-4 sm:p-6 shadow-lg shadow-slate-200/50">
              <header className="mb-3 sm:mb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">Slots</p>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-semibold">
                    {format(new Date(selectedDate), 'EEEE, MMM d')}
                  </h2>
                </div>
                  <div className="flex gap-2">
                    {selectedSlots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDeleteDaySlotsModalOpen(true)}
                        className="rounded-full border border-rose-200 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-rose-600 hover:border-rose-600 hover:bg-rose-50 touch-manipulation"
                      >
                        <span className="hidden sm:inline">Delete all</span>
                        <span className="sm:hidden">Delete</span>
                      </button>
                    )}
                    {selectedDate >= format(new Date(), 'yyyy-MM-dd') ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSlot(null);
                          setSlotModalOpen(true);
                        }}
                        className="rounded-full bg-green-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-green-800 hover:bg-green-400 touch-manipulation"
                      >
                        Add slot
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="rounded-full border border-slate-200 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-400 cursor-not-allowed opacity-50"
                      >
                        Past date
                      </button>
                    )}
                  </div>
                </header>

                <div className="space-y-4">
                  {selectedSlots.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      No slots yet. Create one to open this day for booking.
                    </div>
                  )}
                  {selectedSlots.map((slot) => {
                    // Find booking for this slot - ignore cancelled bookings so released slots show as available
                    const bookingForSlot = bookingsWithSlots.find((b) => {
                      if (b.status === 'cancelled') return false;
                          // Check if this slot is the primary slot for this booking
                          if (b.slotId === slot.id) {
                            // Always show the booking details for this slot (pending or confirmed)
                            return true;
                          }
                          // Check if this slot is a linked slot (for mani-pedi, home service with multiple people, etc.)
                          if (b.linkedSlotIds && b.linkedSlotIds.includes(slot.id)) {
                            // Always show the booking details for this linked slot as well
                            return true;
                          }
                          return false;
                        });
                    
                    // Log warning if slot status is 'available' but has a booking (data inconsistency)
                    if (slot.status === 'available' && bookingForSlot) {
                      console.warn(`Slot ${slot.id} has status 'available' but booking ${bookingForSlot.bookingId} exists. This may indicate slot status was not updated when booking was confirmed.`);
                    }
                    const customerForBooking = bookingForSlot ? customers.find((c) => c.id === bookingForSlot.customerId) : null;
                    // Sort nail techs by name for consistent color assignment
                    const sortedTechIds = [...nailTechs].sort((a, b) => a.name.localeCompare(b.name)).map(t => t.id);
                    return (
                      <div
                        key={slot.id}
                        onClick={(e) => {
                          // Only handle click if not clicking on a button or interactive element
                          const target = e.target as HTMLElement;
                          if (target.closest('button') || target.closest('[role="button"]')) {
                            return;
                          }
                          // When slot is clicked, select the associated booking if it exists
                          if (bookingForSlot) {
                            setSelectedBookingId(bookingForSlot.id);
                            setSelectedSlotId(null);
                          } else {
                            // If no booking, show available slot info
                            setSelectedBookingId(null);
                            setSelectedSlotId(slot.id);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <SlotCard
                          slot={slot}
                          booking={bookingForSlot || null}
                          customer={customerForBooking || null}
                          onEdit={(value) => {
                            setEditingSlot(value);
                            setSlotModalOpen(true);
                          }}
                          onDelete={handleDeleteSlot}
                          onView={(booking) => setResponseModalBooking(booking)}
                          onMakeQuotation={handleMakeQuotation}
                          onSlotClick={(clickedSlot) => {
                            // When available slot is clicked, show available slot info
                            setSelectedBookingId(null);
                            setSelectedSlotId(clickedSlot.id);
                          }}
                          nailTechs={nailTechs}
                          selectedNailTechId={selectedNailTechId}
                          allNailTechIds={sortedTechIds}
                        />
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>

          {/* Booking detail panel - shown when slot is clicked */}
          {selectedBooking && (
            <div className="mt-4 sm:mt-6">
              <BookingDetailPanel
                booking={selectedBooking}
                slotLabel={
                  selectedBooking?.slot ? `${selectedBooking.slot.date} · ${formatTime12Hour(selectedBooking.slot.time)}` : undefined
                }
                pairedSlotLabel={
                  selectedBooking?.linkedSlots && selectedBooking.linkedSlots.length > 0
                    ? formatTime12Hour(selectedBooking.linkedSlots[selectedBooking.linkedSlots.length - 1].time)
                    : selectedBooking?.pairedSlot
                      ? formatTime12Hour(selectedBooking.pairedSlot.time)
                      : undefined
                }
                nailTechName={selectedBooking?.slot?.nailTechId ? `Ms. ${nailTechs.find(t => t.id === selectedBooking.slot.nailTechId)?.name || 'Unknown'}` : undefined}
                onConfirm={handleConfirmBooking}
                onCancel={handleCancelBooking}
                onView={(booking) => setResponseModalBooking(booking)}
              />
            </div>
          )}
          {/* Show available slot message when clicking an available slot */}
          {selectedSlotId && !selectedBooking && (() => {
            const selectedSlot = slots.find(s => s.id === selectedSlotId);
            if (!selectedSlot) return null;
            return (
              <div className="mt-4 sm:mt-6">
                <div className="rounded-2xl sm:rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-4 sm:p-6 shadow-md shadow-slate-900/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-semibold text-emerald-900 mb-1">
                        Slot Available
                      </h3>
                      <p className="text-sm sm:text-base text-emerald-700">
                        {format(new Date(selectedSlot.date), 'EEEE, MMMM d, yyyy')} · {formatTime12Hour(selectedSlot.time)}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-emerald-500 text-white border border-emerald-600">
                      Available
                    </span>
                  </div>
                  <div className="border-t border-emerald-200 pt-4 mt-4">
                    <p className="text-sm sm:text-base text-emerald-800 font-medium">
                      This slot is available and not booked yet.
                    </p>
                    {selectedSlot.notes && (
                      <p className="text-xs sm:text-sm text-emerald-700 mt-2">
                        <strong>Notes:</strong> {selectedSlot.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );

  const renderPlaceholder = (title: string, body: string) => (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
    </div>
  );

  const sectionDescription: Record<AdminSection, string> = {
    overview: 'Analytics dashboard with real-time insights and visualizations.',
    bookings: 'Create slots, block dates, and track booking statuses.',
    finance: 'View invoices, track payments, and manage revenue.',
    customers: 'See relationship insights and client history.',
    services: 'Manage offerings, durations, and pricing.',
    'nail-techs': 'Manage nail technicians, their schedules, and availability.',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Permanent Admin Header */}
      <AdminHeader
        notifications={notifications}
        unreadCount={unreadNotificationsCount}
        onNotificationClick={handleNotificationClick}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onLogout={handleLogout}
        sidebarCollapsed={sidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed top-14 inset-x-0 z-30 bg-white border-b border-slate-200 px-4 py-4 shadow-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <nav className="space-y-2">
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={[
                  'flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                  activeSection === item.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100',
                ].join(' ')}
              >
                {item.label}
                {item.id === 'bookings' && pendingBookingsCount > 0 && (
                  <span
                    className={[
                      'rounded-full px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs',
                      activeSection === 'bookings' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600',
                    ].join(' ')}
                  >
                    {pendingBookingsCount}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition mt-4 border border-rose-200"
            >
              <IoLogOutOutline className="w-5 h-5" />
              Logout
            </button>
          </nav>
        </div>
      )}

      <div className="flex min-h-screen pt-14 sm:pt-16">
        <aside className={`hidden sm:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 pt-14 sm:pt-16 ${
          sidebarCollapsed ? 'w-14 sm:w-16 px-1.5 sm:px-2 py-4 sm:py-6' : 'w-40 sm:w-48 md:w-52 lg:w-56 xl:w-72 px-2 sm:px-3 md:px-4 lg:px-6 py-4 sm:py-6 md:py-7 lg:py-8'
        }`}>
          <div className="mb-8 flex items-center justify-between gap-2">
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center w-full">
                <Image
                  src="/logo.png"
                  alt="glammednailsbyjhen logo"
                  width={48}
                  height={48}
                  className="w-12 h-12 object-contain"
                  priority
                />
              </div>
            ) : (
              <div className="flex-1">
                <div className="mb-2">
                  <Image
                    src="/logo.png"
                    alt="glammednailsbyjhen logo"
                    width={180}
                    height={60}
                    className="h-12 md:h-14 lg:h-16 w-auto object-contain"
                    priority
                  />
                </div>
                <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] md:tracking-[0.4em] text-slate-400">Admin</p>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <IoChevronForward className="w-4 h-4 text-slate-600" />
              ) : (
                <IoChevronBack className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
          <nav className="space-y-2 flex-1">
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={[
                  'flex w-full items-center justify-center md:justify-between rounded-xl md:rounded-2xl px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-xs md:text-sm font-semibold transition relative',
                  activeSection === item.id
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'text-slate-500 hover:bg-slate-100',
                ].join(' ')}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {sidebarCollapsed ? (
                  <>
                    {item.id === 'bookings' && pendingBookingsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[8px] flex items-center justify-center font-bold">
                        {pendingBookingsCount}
                      </span>
                    )}
                    {item.icon && <item.icon className="w-5 h-5" />}
                  </>
                ) : (
                  <>
                    <span>{item.label}</span>
                    {item.id === 'bookings' && pendingBookingsCount > 0 && (
                      <span
                        className={[
                          'rounded-full px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs',
                          activeSection === 'bookings' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600',
                        ].join(' ')}
                      >
                        {pendingBookingsCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto pt-4 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className={`flex w-full items-center ${sidebarCollapsed ? 'justify-center' : 'gap-1.5 md:gap-2'} rounded-xl md:rounded-2xl px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-xs md:text-sm font-semibold text-rose-600 hover:bg-rose-50 transition border border-rose-200`}
              title={sidebarCollapsed ? 'Logout' : undefined}
            >
              <IoLogOutOutline className="w-4 md:w-5 h-4 md:h-5" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {activeSection !== 'bookings' && activeSection !== 'overview' && (
            <header className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">Dashboard</p>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900">
                  {sectionDescription[activeSection]}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">Use the navigation to access the booking workflow.</p>
              </div>
            </header>
          )}

          {activeSection === 'bookings' ? (
            permissions?.canViewBookings ? (
              renderBookingsSection()
            ) : (
              <div className="p-6 text-center">
                <p className="text-slate-600">You don&apos;t have permission to view this section.</p>
              </div>
            )
          ) : activeSection === 'finance' ? (
            permissions?.canViewFinance ? (
              <FinanceView 
              bookings={bookings} 
              slots={slots} 
              customers={customers}
              nailTechs={nailTechs}
              selectedNailTechId={selectedNailTechId}
              onNailTechChange={(id) => setSelectedNailTechId(id)}
              onMakeQuotation={handleMakeQuotation}
              onViewInvoice={handleViewInvoice}
              onUpdatePayment={async (bookingId, paymentStatus, paidAmount, tipAmount, paidPaymentMethod) => {
                const res = await fetch(`/api/bookings/${bookingId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'update_payment',
                    paymentStatus,
                    paidAmount,
                    tipAmount,
                    paidPaymentMethod,
                  }),
                });
                if (res.ok) {
                  // Update local state instead of reloading all data - much faster
                  try {
                    setBookings(prevBookings => 
                      prevBookings.map(booking => 
                        booking.id === bookingId 
                          ? { 
                              ...booking, 
                              paymentStatus, 
                              paidAmount: paidAmount ?? booking.paidAmount,
                              tipAmount: tipAmount ?? booking.tipAmount,
                              status: paymentStatus === 'paid' ? 'confirmed' : booking.status
                            }
                          : booking
                      )
                    );
                    const message = tipAmount && tipAmount > 0 
                      ? `Payment status updated. Tip: ₱${tipAmount.toLocaleString('en-PH')}`
                      : 'Payment status updated.';
                    setToast(message);
                  } catch (error) {
                    console.error('Error updating local state:', error);
                    // Fallback to full reload if local update fails
                    await loadData();
                    setToast('Payment status updated (reloaded data).');
                  }
                }
              }}
            />
            ) : (
              <div className="p-6 text-center">
                <p className="text-slate-600">You don&apos;t have permission to view this section.</p>
              </div>
            )
          ) : activeSection === 'customers' ? (
            permissions?.canViewCustomers ? (
              <div className="space-y-4 sm:space-y-6">
              {/* Customers overview stats */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-shadow">
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-slate-400 mb-1">Total Customers</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">{customerStats.totalCustomers}</p>
                </div>
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:shadow-emerald-300/50 transition-shadow">
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-emerald-600 mb-1">New Clients</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-800">{customerStats.newClients}</p>
                </div>
                <div className="rounded-2xl border-2 border-purple-300 bg-purple-50 p-4 shadow-lg shadow-purple-200/50 hover:shadow-xl hover:shadow-purple-300/50 transition-shadow">
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-purple-600 mb-1">Repeat Clients</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-800">{customerStats.repeatClients}</p>
                </div>
                <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 shadow-lg shadow-rose-200/50 hover:shadow-xl hover:shadow-rose-300/50 transition-shadow">
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-rose-600 mb-1">Cancelled Bookings</p>
                  <p className="text-xl sm:text-2xl font-bold text-rose-800">{customerStats.cancelledBookings}</p>
                  <p className="mt-1 text-[11px] text-rose-700">
                    From {customerStats.totalCustomerBookings} customer bookings
                  </p>
                </div>
              </div>

              {/* Customers list + detail */}
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-[2fr,1fr]">
                <div className="space-y-4 sm:space-y-6">
                  <CustomerList
                    customers={customers}
                    onSelect={(customer) => setSelectedCustomerId(customer.id)}
                    selectedId={selectedCustomerId}
                  />
                </div>
                <div className="space-y-4 sm:space-y-6">
                  <CustomerDetailPanel
                    customer={selectedCustomer}
                    bookings={customerBookings}
                    lifetimeValue={customerLifetimeValue}
                    onUpdate={async (customerId, updates) => {
                      const res = await fetch(`/api/customers/${customerId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updates),
                      });
                      if (res.ok) {
                        await loadData();
                        if (selectedCustomerId === customerId) {
                          await loadCustomerDetails(customerId);
                        }
                        setToast('Customer updated.');
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-slate-600">You don&apos;t have permission to view this section.</p>
              </div>
            )
          ) : activeSection === 'services' ? (
            permissions?.canViewServices ? (
              <ServicesManager />
            ) : (
              <div className="p-6 text-center">
                <p className="text-slate-600">You don&apos;t have permission to view this section.</p>
              </div>
            )
          ) : activeSection === 'nail-techs' ? (
            permissions?.canViewNailTechs ? (
              <NailTechManager />
            ) : (
              <div className="p-6 text-center">
                <p className="text-slate-600">You don&apos;t have permission to view this section.</p>
              </div>
            )
          ) : activeSection === 'users' ? (
            // Allow access during initial setup (when permissions are null) or if user has permission
            (!permissions || permissions.canViewUsers) ? (
              <UserManager />
            ) : (
              <div className="p-6 text-center">
                <p className="text-slate-600">You don&apos;t have permission to view this section.</p>
              </div>
            )
          ) : (
            /* Overview tab - Analytics Dashboard */
            permissions?.canViewOverview ? (
              <AnalyticsDashboard bookings={bookings} slots={slots} customers={customers} />
            ) : (
              <div className="p-6 text-center">
                <p className="text-slate-600">You don&apos;t have permission to view this section.</p>
              </div>
            )
          )}
        </main>
      </div>

      <SlotEditorModal
        open={slotModalOpen}
        slot={editingSlot}
        defaultDate={selectedDate}
        onClose={() => {
          setSlotModalOpen(false);
          setEditingSlot(null);
        }}
        onSubmit={handleSaveSlot}
      />

      <BulkSlotCreatorModal
        open={bulkSlotModalOpen}
        onClose={() => {
          setBulkSlotModalOpen(false);
        }}
        onSubmit={handleSaveSlot}
        defaultNailTechId={role === 'staff' && nailTechId ? nailTechId : selectedNailTechId}
      />

      <BlockDateModal
        open={blockModalOpen}
        initialStart={blockDefaults.start ?? selectedDate}
        initialEnd={blockDefaults.end ?? selectedDate}
        onClose={() => setBlockModalOpen(false)}
        onSubmit={handleBlockDates}
      />

      <DeleteSlotModal
        open={deleteSlotModalOpen}
        slot={slotToDelete}
        onClose={() => {
          setDeleteSlotModalOpen(false);
          setSlotToDelete(null);
        }}
        onConfirm={confirmDeleteSlot}
        isDeleting={isDeletingSlot}
      />

      <DeleteDaySlotsModal
        open={deleteDaySlotsModalOpen}
        date={selectedDate}
        slots={selectedSlots}
        onClose={() => setDeleteDaySlotsModalOpen(false)}
        onConfirm={handleDeleteDaySlots}
      />

      {quotationModalOpen && selectedBooking && (
        <QuotationModal
          booking={selectedBooking}
          slotLabel={
            selectedBooking?.slot ? `${selectedBooking.slot.date} · ${formatTime12Hour(selectedBooking.slot.time)}` : undefined
          }
          nailTechs={nailTechs}
          customerName={customers.find((customer) => customer.id === selectedBooking.customerId)?.name}
          mode={quotationModalMode}
          onRequestEdit={() => setQuotationModalMode('edit')}
          onClose={() => {
            setQuotationModalOpen(false);
            setQuotationModalMode('edit');
          }}
          onSendInvoice={handleSendInvoice}
        />
      )}

      {rescheduleModalOpen && reschedulingBookingId && (
        <RescheduleModal
          open={rescheduleModalOpen}
          booking={bookings.find(b => b.id === reschedulingBookingId) || null}
          slots={slots}
          blockedDates={blockedDates}
          onClose={() => {
            setRescheduleModalOpen(false);
            setReschedulingBookingId(null);
          }}
          onReschedule={handleRescheduleConfirm}
        />
      )}

      {splitRescheduleModalOpen && splitReschedulingBookingId && (
        <SplitRescheduleModal
          open={splitRescheduleModalOpen}
          booking={bookings.find(b => b.id === splitReschedulingBookingId) || null}
          slots={slots}
          blockedDates={blockedDates}
          nailTechs={nailTechs}
          onClose={() => {
            setSplitRescheduleModalOpen(false);
            setSplitReschedulingBookingId(null);
          }}
          onSplitReschedule={handleSplitRescheduleConfirm}
        />
      )}

      <ReleaseSlotsModal
        open={releaseSlotsModalOpen}
        onClose={() => setReleaseSlotsModalOpen(false)}
        onRelease={handleReleaseSlots}
      />

      <RecoverBookingModal
        open={recoverBookingModalOpen}
        onClose={() => setRecoverBookingModalOpen(false)}
        onRecover={handleRecoverBooking}
      />

      <FormResponseModal
        open={!!responseModalBooking}
        booking={responseModalBooking}
        onClose={() => setResponseModalBooking(null)}
      />

      {cancelBookingModalOpen && cancellingBookingId && (() => {
        const bookingToCancel = bookings.find(b => b.id === cancellingBookingId);
        const slotToCancel = bookingToCancel ? slots.find(s => s.id === bookingToCancel.slotId) : null;
        const customerToCancel = bookingToCancel ? customers.find(c => c.id === bookingToCancel.customerId) : null;
        
        return (
          <CancelBookingModal
            open={cancelBookingModalOpen}
            booking={bookingToCancel || null}
            slot={slotToCancel || null}
            customer={customerToCancel || null}
            customers={customers}
            onClose={() => {
              setCancelBookingModalOpen(false);
              setCancellingBookingId(null);
            }}
            onConfirm={confirmCancelBooking}
            isCancelling={isCancellingBooking}
          />
        );
      })()}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}

