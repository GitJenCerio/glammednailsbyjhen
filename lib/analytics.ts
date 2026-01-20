import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, format } from 'date-fns';
import type { Booking, Slot, Customer } from '@/lib/types';

export type TimeRange = 'today' | 'week' | 'month' | 'year';

export interface DateRange {
  start: Date;
  end: Date;
}

export function getDateRange(range: TimeRange): DateRange {
  const now = new Date();
  
  switch (range) {
    case 'today':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }), // Monday
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case 'month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    case 'year':
      return {
        start: startOfYear(now),
        end: endOfYear(now),
      };
    default:
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
  }
}

export function getBookingsByRange(bookings: Booking[], range: TimeRange): Booking[] {
  const { start, end } = getDateRange(range);
  
  return bookings.filter((booking) => {
    // Use invoice date if available, otherwise use booking creation date
    const bookingDate = booking.invoice?.createdAt 
      ? parseISO(booking.invoice.createdAt)
      : parseISO(booking.createdAt);
    
    return isWithinInterval(bookingDate, { start, end });
  });
}

export function getRevenueByRange(bookings: Booking[], range: TimeRange): { total: number; trend: Array<{ date: string; revenue: number }> } {
  const filteredBookings = getBookingsByRange(bookings, range);
  
  // Calculate total revenue
  const total = filteredBookings.reduce((sum, booking) => {
    const deposit = booking.depositAmount || 0;
    const paid = booking.paidAmount || 0;
    const tip = booking.tipAmount || 0;
    return sum + deposit + paid + tip;
  }, 0);
  
  // Generate trend data
  const trend: Record<string, number> = {};
  
  filteredBookings.forEach((booking) => {
    const bookingDate = booking.invoice?.createdAt 
      ? parseISO(booking.invoice.createdAt)
      : parseISO(booking.createdAt);
    
    const dateKey = format(bookingDate, 'yyyy-MM-dd');
    const revenue = (booking.depositAmount || 0) + (booking.paidAmount || 0) + (booking.tipAmount || 0);
    
    trend[dateKey] = (trend[dateKey] || 0) + revenue;
  });
  
  // Convert to array and sort by date
  const trendArray = Object.entries(trend)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return { total, trend: trendArray };
}

export function getTopServices(bookings: Booking[], range: TimeRange): Array<{ service: string; count: number }> {
  const filteredBookings = getBookingsByRange(bookings, range);
  
  const serviceCounts: Record<string, number> = {};
  
  filteredBookings.forEach((booking) => {
    if (booking.serviceType) {
      const serviceName = booking.serviceType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
    }
  });
  
  return Object.entries(serviceCounts)
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function getPaymentBreakdown(bookings: Booking[], range: TimeRange): {
  paid: number;
  partial: number;
  unpaid: number;
} {
  const filteredBookings = getBookingsByRange(bookings, range);
  
  let paid = 0;
  let partial = 0;
  let unpaid = 0;
  
  filteredBookings.forEach((booking) => {
    if (booking.paymentStatus === 'paid') {
      const invoiceTotal = booking.invoice?.total || 0;
      const tip = booking.tipAmount || 0;
      paid += invoiceTotal + tip;
    } else if (booking.paymentStatus === 'partial') {
      const deposit = booking.depositAmount || 0;
      partial += deposit;
    } else {
      // Unpaid: count the remaining balance
      if (booking.invoice) {
        const total = booking.invoice.total || 0;
        const deposit = booking.depositAmount || 0;
        const paidAmount = booking.paidAmount || 0;
        const balance = total - deposit - paidAmount;
        unpaid += Math.max(0, balance);
      }
    }
  });
  
  return { paid, partial, unpaid };
}

export function getUpcomingBookings(bookings: Booking[], slots: Slot[]): Booking[] {
  const now = new Date();
  
  return bookings
    .filter((booking) => {
      if (booking.status !== 'confirmed') return false;
      
      const slot = slots.find((s) => s.id === booking.slotId);
      if (!slot) return false;
      
      const slotDate = parseISO(slot.date);
      return slotDate >= now;
    })
    .sort((a, b) => {
      const slotA = slots.find((s) => s.id === a.slotId);
      const slotB = slots.find((s) => s.id === b.slotId);
      if (!slotA || !slotB) return 0;
      
      const dateA = parseISO(slotA.date + 'T' + slotA.time);
      const dateB = parseISO(slotB.date + 'T' + slotB.time);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 10);
}

export function getRecentCustomers(bookings: Booking[], customers: Customer[], range: TimeRange): Array<{
  customer: Customer;
  bookingCount: number;
  lastBookingDate: string;
}> {
  const { start, end } = getDateRange(range);
  const filteredBookings = bookings.filter((booking) => {
    const bookingDate = parseISO(booking.createdAt);
    return isWithinInterval(bookingDate, { start, end });
  });
  
  const customerMap: Record<string, { customer: Customer; bookingCount: number; lastBookingDate: Date }> = {};
  
  filteredBookings.forEach((booking) => {
    if (!booking.customerId) return;
    
    const customer = customers.find((c) => c.id === booking.customerId);
    if (!customer) return;
    
    const bookingDate = parseISO(booking.createdAt);
    
    if (!customerMap[booking.customerId]) {
      customerMap[booking.customerId] = {
        customer,
        bookingCount: 0,
        lastBookingDate: bookingDate,
      };
    }
    
    customerMap[booking.customerId].bookingCount += 1;
    if (bookingDate > customerMap[booking.customerId].lastBookingDate) {
      customerMap[booking.customerId].lastBookingDate = bookingDate;
    }
  });
  
  return Object.values(customerMap)
    .map(({ customer, bookingCount, lastBookingDate }) => ({
      customer,
      bookingCount,
      lastBookingDate: format(lastBookingDate, 'yyyy-MM-dd'),
    }))
    .sort((a, b) => b.lastBookingDate.localeCompare(a.lastBookingDate))
    .slice(0, 10);
}

export function getCancellations(bookings: Booking[], range: TimeRange): Booking[] {
  const filteredBookings = getBookingsByRange(bookings, range);
  
  return filteredBookings.filter((booking) => booking.status === 'cancelled');
}

export function getPendingPayments(bookings: Booking[]): Booking[] {
  return bookings.filter((booking) => {
    if (booking.status !== 'pending_payment') return false;
    if (booking.paymentStatus === 'paid') return false;
    return true;
  });
}

export function getServiceLocationBreakdown(bookings: Booking[], range: TimeRange): {
  studio: number;
  homeService: number;
} {
  const filteredBookings = getBookingsByRange(bookings, range);
  
  let studio = 0;
  let homeService = 0;
  
  filteredBookings.forEach((booking) => {
    if (booking.serviceLocation === 'homebased_studio') {
      studio += 1;
    } else if (booking.serviceLocation === 'home_service') {
      homeService += 1;
    }
  });
  
  return { studio, homeService };
}

export function getClientTypeBreakdown(bookings: Booking[], range: TimeRange): {
  new: number;
  repeat: number;
} {
  const filteredBookings = getBookingsByRange(bookings, range);
  
  let newClients = 0;
  let repeatClients = 0;
  
  filteredBookings.forEach((booking) => {
    if (booking.clientType === 'new') {
      newClients += 1;
    } else if (booking.clientType === 'repeat') {
      repeatClients += 1;
    }
  });
  
  return { new: newClients, repeat: repeatClients };
}

export function getClientSourceBreakdown(bookings: Booking[], range: TimeRange): {
  facebook: number;
  tiktok: number;
  instagram: number;
  referral: number;
  other: number;
} {
  const filteredBookings = getBookingsByRange(bookings, range);
  
  let facebook = 0;
  let tiktok = 0;
  let instagram = 0;
  let referral = 0;
  let other = 0;
  
  filteredBookings.forEach((booking) => {
    if (!booking.customerData) {
      other += 1;
      return;
    }
    
    // Normalize keys to lowercase for case-insensitive matching
    const normalizedData: Record<string, string> = {};
    Object.keys(booking.customerData).forEach((key) => {
      normalizedData[key.toLowerCase()] = booking.customerData![key];
    });
    
    // Search for source/referral field - common field names
    const sourceFieldKeys = [
      'how did you hear about us',
      'where did you hear about us',
      'referral source',
      'source',
      'how did you find us',
      'referral',
    ];
    
    let sourceValue = '';
    for (const key of sourceFieldKeys) {
      if (normalizedData[key]) {
        sourceValue = normalizedData[key].toLowerCase().trim();
        break;
      }
    }
    
    // Also check all fields for common patterns
    if (!sourceValue) {
      for (const [key, value] of Object.entries(normalizedData)) {
        const lowerKey = key.toLowerCase();
        const lowerValue = value.toLowerCase().trim();
        
        // Check if key suggests it's a source field
        if (
          lowerKey.includes('source') ||
          lowerKey.includes('referral') ||
          lowerKey.includes('hear') ||
          lowerKey.includes('find')
        ) {
          sourceValue = lowerValue;
          break;
        }
      }
    }
    
    // Categorize the source
    if (!sourceValue) {
      other += 1;
    } else if (sourceValue.includes('facebook') || sourceValue.includes('fb')) {
      facebook += 1;
    } else if (sourceValue.includes('tiktok') || sourceValue.includes('tik tok')) {
      tiktok += 1;
    } else if (
      sourceValue.includes('instagram') ||
      sourceValue.includes('ig') ||
      sourceValue.includes('insta')
    ) {
      instagram += 1;
    } else if (
      sourceValue.includes('refer') ||
      sourceValue.includes('friend') ||
      sourceValue.includes('someone') ||
      sourceValue.includes('recommend')
    ) {
      referral += 1;
    } else {
      other += 1;
    }
  });
  
  return { facebook, tiktok, instagram, referral, other };
}

export interface WebAnalytics {
  pageViews: number;
  bookNowClicks: number;
  conversionRate: number;
  incompleteBookings: number;
}

export interface AnalyticsEvent {
  type: string;
  timestamp: string;
  page?: string;
  bookingId?: string;
}

export function getIncompleteBookings(bookings: Booking[], range: TimeRange): Booking[] {
  const filteredBookings = getBookingsByRange(bookings, range);
  
  // Incomplete bookings are those with status 'pending_form' - they clicked but didn't finish
  return filteredBookings.filter((booking) => booking.status === 'pending_form');
}

