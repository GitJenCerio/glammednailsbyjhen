'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import type { Booking, BookingWithSlot, PaymentStatus, Customer, NailTech } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';
import { PaymentModal } from './modals/PaymentModal';
import { IoEllipsisVertical, IoCreateOutline, IoSearchOutline, IoClose, IoDocumentTextOutline, IoCashOutline, IoEyeOutline } from 'react-icons/io5';
import { createPortal } from 'react-dom';

type FinanceViewProps = {
  bookings: Booking[];
  slots: any[];
  customers?: Customer[];
  nailTechs?: NailTech[];
  selectedNailTechId?: string | null;
  onNailTechChange?: (nailTechId: string | null) => void;
  onMakeQuotation?: (bookingId: string) => void;
  onViewInvoice?: (bookingId: string) => void;
  onUpdatePayment?: (bookingId: string, paymentStatus: PaymentStatus, paidAmount?: number, tipAmount?: number, paidPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') => Promise<void>;
};

type MonthFilter = 'all' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  refunded: 'Refunded',
  forfeited: 'DP FORFEITED',
};

const paymentStatusColors: Record<PaymentStatus, string> = {
  unpaid: 'bg-red-100 text-red-800 border-red-200',
  partial: 'bg-orange-100 text-orange-800 border-orange-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  refunded: 'bg-gray-100 text-gray-800 border-gray-200',
  forfeited: 'bg-amber-100 text-amber-800 border-amber-200',
};

export function FinanceView({ bookings, slots, customers = [], nailTechs = [], selectedNailTechId = null, onNailTechChange, onMakeQuotation, onViewInvoice, onUpdatePayment }: FinanceViewProps) {
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'all'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('all');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<Booking | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<Record<string, 'up' | 'down'>>({});
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; right: number } | null>(null);
  const [localSelectedNailTechId, setLocalSelectedNailTechId] = useState<string | null>(selectedNailTechId || null);
  const [activeFilterField, setActiveFilterField] = useState<'nailTech' | 'status' | 'date'>('status');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync local state with prop
  useEffect(() => {
    if (selectedNailTechId !== undefined) {
      setLocalSelectedNailTechId(selectedNailTechId);
    }
  }, [selectedNailTechId]);

  const handleNailTechChange = (nailTechId: string | null) => {
    setLocalSelectedNailTechId(nailTechId);
    onNailTechChange?.(nailTechId);
  };

  // Create a Map for O(1) slot lookups instead of O(n) find operations
  const slotsMap = useMemo(() => {
    const map = new Map<string, any>();
    slots.forEach(slot => {
      map.set(slot.id, slot);
    });
    return map;
  }, [slots]);

  const bookingsWithSlots = useMemo<BookingWithSlot[]>(() => {
    const list: BookingWithSlot[] = [];
    let filteredBookings = bookings;
    
    // Filter bookings by selected nail tech if one is selected
    if (localSelectedNailTechId) {
      filteredBookings = bookings.filter((booking) => booking.nailTechId === localSelectedNailTechId);
    }
    
    filteredBookings.forEach((booking) => {
      const slot = slotsMap.get(booking.slotId);
      if (!slot) return;
      
      // Also filter by selected nail tech for slots (double-check)
      if (localSelectedNailTechId && slot.nailTechId !== localSelectedNailTechId) return;
      
      const linkedSlots = (booking.linkedSlotIds ?? [])
        .map((linkedId) => slotsMap.get(linkedId))
        .filter((value): value is any => Boolean(value))
        .filter((linkedSlot) => !localSelectedNailTechId || linkedSlot.nailTechId === localSelectedNailTechId);
      const pairedSlot = linkedSlots[0];
      list.push({ ...booking, slot, pairedSlot, linkedSlots });
    });
    return list;
  }, [bookings, slotsMap, localSelectedNailTechId]);

  const getPaymentMethodBadge = (method?: 'PNB' | 'CASH' | 'GCASH') => {
    if (!method) return null;
    const colors = {
      CASH: 'bg-green-100 text-green-800 border-green-200',
      GCASH: 'bg-blue-100 text-blue-800 border-blue-200',
      PNB: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    const labels = {
      CASH: '💵 Cash',
      GCASH: '📱 GCash',
      PNB: '🏦 PNB',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[method]}`}>
        {labels[method]}
      </span>
    );
  };

  // Helper to get effective payment status: if paid but no invoice, show as partial
  // For cancelled bookings with payments, show as forfeited
  const getEffectivePaymentStatus = (booking: Booking): PaymentStatus => {
    // Check if booking is cancelled and has payments (deposit or paid amount)
    if (booking.status === 'cancelled') {
      const hasPayment = (booking.depositAmount && booking.depositAmount > 0) || (booking.paidAmount && booking.paidAmount > 0);
      if (hasPayment) {
        return 'forfeited';
      }
      return 'unpaid'; // Cancelled with no payment
    }
    
    const hasPayment = (booking.depositAmount && booking.depositAmount > 0) || (booking.paidAmount && booking.paidAmount > 0);
    if (!booking.invoice && hasPayment) {
      return 'partial';
    }
    return booking.paymentStatus || 'unpaid';
  };

  const getCustomerName = (booking: Booking) => {
    // 1) Always prefer the name the client typed in the form (per booking)
    if (booking.customerData && Object.keys(booking.customerData).length > 0) {
      // Helper function to find field by fuzzy matching key names
      const findField = (keywords: string[]): string | null => {
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        for (const [key, value] of Object.entries(booking.customerData!)) {
          const lowerKey = key.toLowerCase();
          // Check if key matches any keyword (partial match or exact match)
          if (lowerKeywords.some(kw => lowerKey.includes(kw) || lowerKey === kw) && value && String(value).trim()) {
            return String(value).trim();
          }
        }
        return null;
      };

      // Try to find full name field first (various formats)
      const fullName = findField(['full name', 'fullname']);
      if (fullName) return fullName;

      // Helper function to find first name (excluding surname/last name fields and social media names)
      const findFirstName = (): string | null => {
        const keywords = ['first name', 'firstname', 'fname', 'given name'];
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        for (const [key, value] of Object.entries(booking.customerData!)) {
          const lowerKey = key.toLowerCase();
          // Check for explicit first name keywords
          if (lowerKeywords.some(kw => lowerKey.includes(kw) || lowerKey === kw) && value && String(value).trim()) {
            return String(value).trim();
          }
        }
        // Now try "name" but EXCLUDE social media names, surname, last name, etc.
        for (const [key, value] of Object.entries(booking.customerData!)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('name') && 
              !lowerKey.includes('surname') && 
              !lowerKey.includes('last name') && 
              !lowerKey.includes('lastname') &&
              !lowerKey.includes('full name') && 
              !lowerKey.includes('fullname') &&
              !lowerKey.includes('instagram') &&
              !lowerKey.includes('facebook') &&
              !lowerKey.includes('social') &&
              !lowerKey.includes('inquire') &&
              value && String(value).trim()) {
            return String(value).trim();
          }
        }
        return null;
      };

      // Try to find last name/surname first (including the exact Google Form field name with autofill text)
      const lastName = findField(['surname', 'last name', 'lastname', 'lname', 'family name']);
      
      // Try to find first name (excluding surname fields)
      const firstName = findFirstName();
      
      // If we found both, combine them
      if (firstName && lastName) {
        return `${firstName} ${lastName}`.trim();
      }
      
      // If we found only first name or only last name, use it
      if (firstName) return firstName;
      if (lastName) return lastName;
      
      // Last resort: look for any field that might be a name (not email, phone, social media, etc.)
      for (const [key, value] of Object.entries(booking.customerData)) {
        const lowerKey = key.toLowerCase();
        // Skip non-name fields including social media names
        if (lowerKey.includes('email') || lowerKey.includes('phone') || lowerKey.includes('contact') || 
            lowerKey.includes('booking') || lowerKey.includes('date') || lowerKey.includes('time') ||
            lowerKey.includes('service') || lowerKey.includes('location') || lowerKey.includes('referral') ||
            lowerKey.includes('instagram') || lowerKey.includes('facebook') || lowerKey.includes('social') ||
            lowerKey.includes('inquire') || lowerKey.includes('surname') || lowerKey.includes('last name')) {
          continue;
        }
        // If it's a reasonable length and looks like a name, use it
        const strValue = String(value).trim();
        if (strValue.length > 0 && strValue.length < 100) {
          return strValue;
        }
      }
    }

    // 2) If no form data, fall back to Customer record (shared by email/phone)
    if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
      const customer = customers.find((c) => c.id === booking.customerId);
      if (customer?.name) return customer.name;
    }

    // 3) Last fallback: bookingId
    return booking.bookingId;
  };

  const getCustomerPhone = (booking: BookingWithSlot): string => {
    if (booking.customerData && Object.keys(booking.customerData).length > 0) {
      const findPhoneField = (keywords: string[]): string | null => {
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        for (const [key, value] of Object.entries(booking.customerData!)) {
          const lowerKey = key.toLowerCase();
          if (lowerKeywords.some(kw => lowerKey.includes(kw) || lowerKey === kw) && value && String(value).trim()) {
            return String(value).trim();
          }
        }
        return null;
      };

      const phone = findPhoneField([
        'contact number',
        'phone number',
        'phone',
        'contact',
        'mobile',
        'cell',
        'telephone',
        'tel',
      ]);
      if (phone) return phone;
    }

    if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
      const customer = customers.find(c => c.id === booking.customerId);
      if (customer?.phone) return customer.phone;
    }

    return 'N/A';
  };

  const getTimeRange = (booking: BookingWithSlot): string => {
    if (!booking.slot) return 'N/A';
    if (booking.linkedSlots && booking.linkedSlots.length > 0) {
      const lastSlot = booking.linkedSlots[booking.linkedSlots.length - 1];
      return `${formatTime12Hour(booking.slot.time)} - ${formatTime12Hour(lastSlot.time)}`;
    }
    if (booking.pairedSlot) {
      return `${formatTime12Hour(booking.slot.time)} - ${formatTime12Hour(booking.pairedSlot.time)}`;
    }
    return formatTime12Hour(booking.slot.time);
  };

  const matchesSearch = useCallback((booking: BookingWithSlot, query: string): boolean => {
    if (!query.trim()) return true;
    const lowerQuery = query.toLowerCase().trim();

    if (booking.bookingId.toLowerCase().includes(lowerQuery)) return true;

    const customerName = getCustomerName(booking).toLowerCase();
    if (customerName.includes(lowerQuery)) return true;

    const phone = getCustomerPhone(booking).toLowerCase();
    if (phone.includes(lowerQuery)) return true;

    if (booking.serviceType && booking.serviceType.toLowerCase().includes(lowerQuery)) return true;

    if (booking.slot) {
      const dateStr = format(parseISO(booking.slot.date), 'MMM d, yyyy').toLowerCase();
      if (dateStr.includes(lowerQuery)) return true;
    }

    if (booking.slot) {
      const timeStr = getTimeRange(booking).toLowerCase();
      if (timeStr.includes(lowerQuery)) return true;
    }

    if (booking.customerData) {
      for (const value of Object.values(booking.customerData)) {
        if (String(value).toLowerCase().includes(lowerQuery)) return true;
      }
    }

    return false;
  }, [getCustomerName, getCustomerPhone, getTimeRange]);

  // Helper function to get the relevant date (always service date for revenue recognition)
  const getRelevantDate = useCallback((booking: BookingWithSlot): Date => {
    return parseISO(booking.slot.date);
  }, []);

  const filteredBookings = useMemo(() => {
    let filtered = bookingsWithSlots.filter((booking) => {
      const effectivePaymentStatus = getEffectivePaymentStatus(booking);
      
      if (filterStatus !== 'all' && effectivePaymentStatus !== filterStatus) return false;
      // Include bookings with invoices OR bookings with deposits/paid amounts (partial payments) OR confirmed bookings (even with 0 payment)
      if (!booking.invoice && !booking.depositAmount && !booking.paidAmount && booking.status !== 'confirmed') return false;
      
      
      return true;
    });

    if (filterPeriod !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (filterPeriod === 'today') {
        // Filter for today's appointments (based on appointment date)
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        filtered = filtered.filter((booking) => {
          const appointmentDate = parseISO(booking.slot.date);
          return appointmentDate >= today && appointmentDate < tomorrow;
        });
      } else if (filterPeriod === 'week') {
        // Filter for this week's appointments (current week, Monday to Sunday)
        const startOfWeek = new Date(today);
        const dayOfWeek = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        endOfWeek.setHours(23, 59, 59, 999);
        
        filtered = filtered.filter((booking) => {
          const appointmentDate = parseISO(booking.slot.date);
          return appointmentDate >= startOfWeek && appointmentDate < endOfWeek;
        });
      } else if (filterPeriod === 'month') {
        // Filter for this month's appointments (current month)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        filtered = filtered.filter((booking) => {
          const appointmentDate = parseISO(booking.slot.date);
          return appointmentDate >= startOfMonth && appointmentDate <= endOfMonth;
        });
      }
    }

    // Month and Year filter
    if (monthFilter !== 'all' || yearFilter !== 'all') {
      filtered = filtered.filter((booking) => {
        const bookingDate = getRelevantDate(booking);
        const monthIndex = bookingDate.getMonth() + 1; // 1-12
        const year = bookingDate.getFullYear();
        
        const monthMatch = monthFilter === 'all' || monthIndex === monthFilter;
        const yearMatch = yearFilter === 'all' || year === yearFilter;
        
        return monthMatch && yearMatch;
      });
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter((booking) => matchesSearch(booking, searchQuery));
    }

    return filtered.sort((a, b) => {
      // Sort by relevant date (service date or payment date) - ascending (earliest first)
      const dateA = getRelevantDate(a).getTime();
      const dateB = getRelevantDate(b).getTime();
      return dateA - dateB;
    });
  }, [bookingsWithSlots, filterStatus, filterPeriod, monthFilter, yearFilter, getRelevantDate, searchQuery, matchesSearch]);

  // Get available years from bookings data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    bookingsWithSlots.forEach((booking) => {
      // Always use service date
      const bookingDate = parseISO(booking.slot.date);
      years.add(bookingDate.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a); // Sort descending (newest first)
  }, [bookingsWithSlots]);

  const totals = useMemo(() => {
    // REVENUE RECOGNITION: Count revenue by service date (when service happens)
    // This means a deposit paid today for next month's service counts in next month
    
    // Unpaid: Remaining balance for bookings with invoice
    const unpaid = filteredBookings
      .filter((b) => {
        if (!b.invoice) return false;
        const total = b.invoice.total || 0;
        const deposit = b.depositAmount || 0;
        const paid = b.paidAmount || 0;
        const balance = total - deposit - paid;
        return balance > 0;
      })
      .reduce((sum, b) => {
        const total = b.invoice?.total || 0;
        const deposit = b.depositAmount || 0;
        const paid = b.paidAmount || 0;
        const balance = total - deposit - paid;
        return sum + balance;
      }, 0);
    
    // Partial: Deposit amount when there's a deposit but invoice isn't fully paid
    const partial = filteredBookings
      .filter((b) => {
        const deposit = b.depositAmount || 0;
        if (deposit === 0) return false;
        if (!b.invoice) return true; // Deposit but no invoice yet
        const total = b.invoice.total || 0;
        const paid = b.paidAmount || 0;
        const balance = total - deposit - paid;
        return balance > 0;
      })
      .reduce((sum, b) => {
        const deposit = b.depositAmount || 0;
        return sum + deposit;
      }, 0);
    
    // Paid: Fully paid invoices (counted by service date)
    const paid = filteredBookings
      .filter((b) => b.paymentStatus === 'paid')
      .reduce((sum, b) => {
        const invoiceTotal = b.invoice?.total || 0;
        const tip = b.tipAmount || 0;
        return sum + invoiceTotal + tip;
      }, 0);
    
    // Total Revenue = All amounts for services in this period (by service date)
    const total = filteredBookings.reduce((sum, b) => {
      const deposit = b.depositAmount || 0;
      const paid = b.paidAmount || 0;
      const tip = b.tipAmount || 0;
      return sum + deposit + paid + tip;
    }, 0);
    
    const tips = filteredBookings.reduce((sum, b) => sum + (b.tipAmount || 0), 0);

    // Calculate commission based on nail tech's commission rate
    const nailTechCommissionTotal = filteredBookings.reduce((sum, b) => {
      if (!b.invoice?.total) return sum;
      
      // Find the nail tech for this booking
      const tech = nailTechs.find(t => t.id === b.nailTechId);
      if (!tech || !tech.commissionRate) return sum;
      
      // Calculate commission: invoice total * commission rate
      return sum + b.invoice.total * tech.commissionRate;
    }, 0);

    return { unpaid, partial, paid, total, tips, nailTechCommissionTotal };
  }, [filteredBookings, nailTechs]);

  const handleUpdatePayment = async (bookingId: string, paymentStatus: PaymentStatus, paidAmount?: number, tipAmount?: number, paidPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') => {
    setOpenDropdownId(null);
    
    // Use parent's onUpdatePayment callback if provided (optimized, updates local state)
    if (onUpdatePayment) {
      await onUpdatePayment(bookingId, paymentStatus, paidAmount, tipAmount, paidPaymentMethod);
      return;
    }
    
    // Fallback: direct API call (still faster than page reload)
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
    if (!res.ok) {
      alert('Failed to update payment status');
      return;
    }
    // Note: Without onUpdatePayment callback, the parent will need to reload data
    // But at least we're not doing a full page reload
  };

  // Close dropdown when clicking outside and calculate position
  useEffect(() => {
    if (!openDropdownId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const allRefs = Object.values(dropdownRefs.current);
      const clickedInside = allRefs.some(
        (ref) => ref && ref.contains(event.target as Node)
      );
      const target = event.target as HTMLElement;
      const isDropdownMenu = target.closest('.dropdown-menu');
      if (!clickedInside && !isDropdownMenu) {
        setOpenDropdownId(null);
        setDropdownCoords(null);
      }
    };

    // Calculate dropdown position when it opens
    const dropdown = dropdownRefs.current[openDropdownId];
    if (dropdown) {
      const rect = dropdown.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 160; // Approximate dropdown height
      
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        setDropdownPosition(prev => ({ ...prev, [openDropdownId]: 'up' }));
      } else {
        setDropdownPosition(prev => ({ ...prev, [openDropdownId]: 'down' }));
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  // Calculate today's bookings
  const todayBookings = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return bookingsWithSlots
        .filter((booking) => {
          const effectivePaymentStatus = getEffectivePaymentStatus(booking);
          if (filterStatus !== 'all' && effectivePaymentStatus !== filterStatus) return false;
        if (!booking.invoice && !booking.depositAmount && booking.status !== 'confirmed') return false;
        const appointmentDate = parseISO(booking.slot.date);
        return appointmentDate >= today && appointmentDate < tomorrow;
      })
      .filter((booking) => !searchQuery.trim() || matchesSearch(booking, searchQuery))
      .sort((a, b) => {
        const dateA = parseISO(a.slot.date).getTime();
        const dateB = parseISO(b.slot.date).getTime();
        // Sort ascending (earliest first)
        return dateA - dateB;
      });
  }, [bookingsWithSlots, filterStatus, searchQuery, matchesSearch]);
  
  // Calculate this week's bookings (excluding today's bookings to avoid duplicates)
  const thisWeekBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startOfWeek = new Date(today);
    const dayOfWeek = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return bookingsWithSlots
      .filter((booking) => {
        const effectivePaymentStatus = getEffectivePaymentStatus(booking);
        if (filterStatus !== 'all' && effectivePaymentStatus !== filterStatus) return false;
        if (!booking.invoice && !booking.depositAmount && !booking.paidAmount && booking.status !== 'confirmed') return false;
        const appointmentDate = parseISO(booking.slot.date);
        // Exclude today's bookings (they're shown in the Today section)
        if (appointmentDate >= today && appointmentDate < tomorrow) return false;
        // Include rest of the week
        return appointmentDate >= startOfWeek && appointmentDate < endOfWeek;
      })
      .filter((booking) => !searchQuery.trim() || matchesSearch(booking, searchQuery))
      .sort((a, b) => {
        const dateA = parseISO(a.slot.date).getTime();
        const dateB = parseISO(b.slot.date).getTime();
        // Sort ascending (earliest first)
        return dateA - dateB;
      });
  }, [bookingsWithSlots, filterStatus, searchQuery, matchesSearch]);

  return (
    <div className="space-y-4 sm:space-y-6">


      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
        {/* First row: Total Revenue, Total Tips, Nail Tech Commission */}
        <div className="rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-slate-500 mb-1 sm:mb-2 truncate">Total Revenue</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-slate-900 leading-tight break-words">₱{totals.total.toLocaleString('en-PH')}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border-2 border-purple-300 bg-purple-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-purple-200/50 hover:shadow-xl hover:shadow-purple-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-purple-600 mb-1 sm:mb-2 truncate">Total Tips</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-purple-700 leading-tight break-words">₱{totals.tips.toLocaleString('en-PH')}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border-2 border-amber-300 bg-amber-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-amber-200/50 hover:shadow-xl hover:shadow-amber-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-amber-600 mb-1 sm:mb-2 line-clamp-2">
            {localSelectedNailTechId 
              ? (() => {
                  const tech = nailTechs.find(t => t.id === localSelectedNailTechId);
                  const rate = tech?.commissionRate ? (tech.commissionRate * 100).toFixed(0) : '0';
                  return `Nail Tech Commission (${rate}%)`;
                })()
              : 'Total Commission'}
          </p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-amber-700 leading-tight break-words">₱{totals.nailTechCommissionTotal.toLocaleString('en-PH')}</p>
        </div>
        {/* Second row: Paid, Partial, Unpaid */}
        <div className="rounded-xl sm:rounded-2xl border-2 border-green-300 bg-green-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-green-200/50 hover:shadow-xl hover:shadow-green-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-green-600 mb-1 sm:mb-2 truncate">Paid</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-green-700 leading-tight break-words">₱{totals.paid.toLocaleString('en-PH')}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border-2 border-orange-300 bg-orange-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-orange-200/50 hover:shadow-xl hover:shadow-orange-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-orange-600 mb-1 sm:mb-2 truncate">Partial</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-orange-700 leading-tight break-words">₱{totals.partial.toLocaleString('en-PH')}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border-2 border-red-300 bg-red-50 px-2 sm:px-3 py-3 sm:py-4 lg:p-5 shadow-lg shadow-red-200/50 hover:shadow-xl hover:shadow-red-300/50 transition-shadow flex flex-col justify-center min-w-0">
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-red-600 mb-1 sm:mb-2 truncate">Unpaid</p>
          <p className="text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-red-700 leading-tight break-words">₱{totals.unpaid.toLocaleString('en-PH')}</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <IoSearchOutline className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by booking ID, name, phone, service, date, time..."
          className="w-full pl-10 pr-10 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Clear search"
          >
            <IoClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <p className="text-[11px] sm:text-xs text-slate-500 font-semibold">Filter by:</p>
        <div
          className={`flex gap-3 items-start sm:items-center ${
            activeFilterField === 'status' ? 'flex-nowrap overflow-x-auto' : 'flex-wrap'
          }`}
        >
          {/* Filter field selector */}
          <div className="flex items-center gap-2 flex-nowrap">
            <label className="hidden sm:inline text-[11px] sm:text-xs text-slate-500 font-medium">Field:</label>
            <select
              value={activeFilterField}
              onChange={(e) => {
                const value = e.target.value as 'nailTech' | 'status' | 'date';
                setActiveFilterField(value);
                // Reset other filters when switching field to keep it simple
                if (value !== 'nailTech') {
                  handleNailTechChange(null);
                }
                if (value !== 'status') {
                  setFilterStatus('all');
                }
                if (value !== 'date') {
                  setFilterPeriod('all');
                  setMonthFilter('all');
                  setYearFilter('all');
                }
              }}
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            >
              <option value="nailTech">Nail tech</option>
              <option value="status">Status</option>
              <option value="date">Date</option>
            </select>
          </div>

          {/* Filter value selector (changes based on field) */}
          {activeFilterField === 'nailTech' && nailTechs.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] sm:text-xs text-slate-500 font-medium">Nail Technician:</label>
              <select
                value={localSelectedNailTechId || ''}
                onChange={(e) => handleNailTechChange(e.target.value || null)}
                className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="">All nail techs</option>
                {nailTechs.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    Ms. {tech.name} ({tech.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeFilterField === 'status' && (
            <div className="flex items-center gap-2 flex-nowrap">
              <label className="hidden sm:inline text-[11px] sm:text-xs text-slate-500 font-medium">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | 'all')}
                className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="all">All</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
                <option value="forfeited">DP FORFEITED</option>
              </select>
            </div>
          )}

          {activeFilterField === 'date' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-[11px] sm:text-xs text-slate-500 font-medium">Period:</label>
                <select
                  value={filterPeriod}
                  onChange={(e) => {
                    setFilterPeriod(e.target.value as 'all' | 'today' | 'week' | 'month');
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                </select>
              </div>

            {/* Month and Year filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-[11px] sm:text-xs text-slate-500">Month:</label>
                <select
                  value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as MonthFilter));
                // If month is selected but year is not, suggest current year
                if (e.target.value !== 'all' && yearFilter === 'all') {
                  const currentYear = new Date().getFullYear();
                  if (availableYears.includes(currentYear)) {
                    setYearFilter(currentYear);
                  } else if (availableYears.length > 0) {
                    setYearFilter(availableYears[0]); // Use most recent year
                  }
                }
              }}
                  className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="all">All months</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] sm:text-xs text-slate-500">Year:</label>
                <select
                  value={yearFilter}
                  onChange={(e) => {
                    setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value));
                    // If year is selected but month is not, keep month as 'all' to show all months for that year
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="all">All years</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          )}

        </div>
      </div>

      {/* Today's Bookings Table - Always Visible */}
      {todayBookings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Today&apos;s Bookings</span>
            <span className="text-sm font-normal text-slate-500">({todayBookings.length})</span>
          </h2>
          
          {/* Mobile Card View for Today */}
          <div className="lg:hidden space-y-3">
            {todayBookings.map((booking) => (
              <div key={booking.id} className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{booking.bookingId}</span>
                    </div>
                    <div className="text-xs text-slate-600">{getCustomerName(booking)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border ${
                        paymentStatusColors[getEffectivePaymentStatus(booking)]
                      }`}
                    >
                      {paymentStatusLabels[getEffectivePaymentStatus(booking)]}
                    </span>
                    <div
                      className="relative"
                      ref={(el: HTMLDivElement | null) => {
                        dropdownRefs.current[`mobile-${booking.id}`] = el;
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const button = e.currentTarget;
                          const rect = button.getBoundingClientRect();
                          if (openDropdownId === `mobile-${booking.id}`) {
                            setOpenDropdownId(null);
                            setDropdownCoords(null);
                          } else {
                            setOpenDropdownId(`mobile-${booking.id}`);
                            const buttonCenterY = rect.top + rect.height / 2;
                            setDropdownCoords({
                              top: buttonCenterY,
                              right: window.innerWidth - rect.right,
                            });
                          }
                        }}
                        className="inline-flex items-center justify-center p-0.5 text-slate-600 hover:text-slate-900 transition-colors focus:outline-none touch-manipulation active:scale-[0.98]"
                        aria-label="Actions menu"
                      >
                        <IoEllipsisVertical className="w-5 h-5" />
                      </button>
                      {openDropdownId === `mobile-${booking.id}` && dropdownCoords && typeof window !== 'undefined' && createPortal(
                        <div
                          className="dropdown-menu fixed w-48 rounded-lg border border-slate-200 bg-white shadow-2xl z-[9999]"
                          style={{
                            top: `${Math.max(12, Math.min(window.innerHeight - 200, dropdownCoords.top))}px`,
                            right: `${Math.max(12, dropdownCoords.right + 8)}px`,
                            transform: 'translateY(-50%)',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="py-1">
                            {booking.invoice && onViewInvoice && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewInvoice(booking.id);
                                  setOpenDropdownId(null);
                                  setDropdownCoords(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                              >
                                <IoEyeOutline className="w-4 h-4" />
                                View Invoice
                              </button>
                            )}
                            {onMakeQuotation && !booking.invoice && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMakeQuotation(booking.id);
                                  setOpenDropdownId(null);
                                  setDropdownCoords(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                              >
                                <IoDocumentTextOutline className="w-4 h-4 text-rose-600" />
                                Quote
                              </button>
                            )}
                            {booking.invoice && booking.paymentStatus !== 'paid' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBookingForPayment(booking);
                                  setPaymentModalOpen(true);
                                  setOpenDropdownId(null);
                                  setDropdownCoords(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 touch-manipulation"
                              >
                                <IoCashOutline className="w-4 h-4" />
                                Update Payment
                              </button>
                            )}
                            {booking.invoice && booking.paymentStatus === 'paid' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdatePayment(booking.id, 'refunded');
                                  setOpenDropdownId(null);
                                  setDropdownCoords(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2 touch-manipulation"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service Date:</span>
                    <span className="font-medium text-slate-900 text-right">
                      {format(parseISO(booking.slot.date), 'MMM d, yyyy')} {formatTime12Hour(booking.slot.time)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Amount:</span>
                    <span className="font-semibold text-slate-900">
                      ₱{booking.invoice?.total.toLocaleString('en-PH') || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Paid Amount:</span>
                    {(() => {
                      const deposit = booking.depositAmount || 0;
                      const paid = booking.paidAmount || 0;
                      const totalPaid = deposit + paid;
                      return totalPaid > 0 ? (
                        <span className="font-semibold text-emerald-700">
                          ₱{totalPaid.toLocaleString('en-PH')}
                        </span>
                      ) : (
                        <span className="text-slate-400">₱0</span>
                      );
                    })()}
                  </div>
                  {booking.invoice && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Balance:</span>
                      <span className={`font-bold ${
                        (() => {
                          const total = booking.invoice?.total || 0;
                          const deposit = booking.depositAmount || 0;
                          const paid = booking.paidAmount || 0;
                          const totalPaid = deposit + paid;
                          const balance = total - totalPaid;
                          return balance > 0 ? 'text-red-700' : 'text-emerald-700';
                        })()
                      }`}>
                        ₱{(() => {
                          const total = booking.invoice?.total || 0;
                          const deposit = booking.depositAmount || 0;
                          const paid = booking.paidAmount || 0;
                          const totalPaid = deposit + paid;
                          const balance = total - totalPaid;
                          return Math.max(0, balance).toLocaleString('en-PH');
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View for Today */}
          <div className="hidden lg:block rounded-2xl border-2 border-blue-200 bg-blue-50 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-blue-100 border-b border-blue-200">
                  <tr>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Booking</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Customer</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 whitespace-nowrap">Date & Time</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Total</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Paid</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Balance</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Status</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-200">
                  {todayBookings.map((booking) => {
                    const total = booking.invoice?.total || 0;
                    const deposit = booking.depositAmount || 0;
                    const paid = booking.paidAmount || 0;
                    const totalPaid = deposit + paid;
                    const balance = total - totalPaid;
                    return (
                      <tr key={booking.id} className="hover:bg-blue-100/50">
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm font-medium text-slate-900">{booking.bookingId}</td>
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm text-slate-700">{getCustomerName(booking)}</td>
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm text-slate-700">
                          {format(parseISO(booking.slot.date), 'MMM d')} {formatTime12Hour(booking.slot.time)}
                        </td>
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm font-semibold text-slate-900">₱{total.toLocaleString('en-PH')}</td>
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm text-slate-700">
                      <button
                        onClick={() => {
                          setSelectedBookingForPayment(booking);
                          setPaymentModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold hover:underline cursor-pointer text-slate-700"
                        title="Click to update payment"
                      >
                        ₱{totalPaid.toLocaleString('en-PH')}
                        <IoCreateOutline className="w-3.5 h-3.5" />
                      </button>
                    </td>
                        <td className="px-4 xl:px-6 py-3">
                          <span
                            className={`inline-flex items-center text-xs sm:text-sm font-semibold ${
                              balance > 0 ? 'text-red-700' : 'text-emerald-700'
                            }`}
                          >
                            ₱{Math.max(0, balance).toLocaleString('en-PH')}
                          </span>
                        </td>
                        <td className="px-4 xl:px-6 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            paymentStatusColors[getEffectivePaymentStatus(booking)]
                          }`}>
                            {paymentStatusLabels[getEffectivePaymentStatus(booking)]}
                          </span>
                        </td>
                        <td className="px-4 xl:px-6 py-3">
                          {booking.invoice && booking.paymentStatus === 'paid' ? (
                            <button
                              onClick={() => handleUpdatePayment(booking.id, 'refunded')}
                              className="rounded-full border-2 border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Refund
                            </button>
                          ) : onMakeQuotation && !booking.invoice ? (
                            <button
                              onClick={() => onMakeQuotation(booking.id)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${
                                'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              Quote
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedBookingForPayment(booking);
                                setPaymentModalOpen(true);
                              }}
                              className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                            >
                              Update
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* This Week's Bookings Table - Always Visible */}
      {thisWeekBookings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>This Week&apos;s Bookings</span>
            <span className="text-sm font-normal text-slate-500">({thisWeekBookings.length})</span>
          </h2>
          
          {/* Mobile Card View for This Week */}
          <div className="lg:hidden space-y-3">
            {thisWeekBookings.map((booking) => (
              <div key={booking.id} className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{booking.bookingId}</span>
                    </div>
                    <div className="text-xs text-slate-600">{getCustomerName(booking)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border ${
                        paymentStatusColors[getEffectivePaymentStatus(booking)]
                      }`}
                    >
                      {paymentStatusLabels[getEffectivePaymentStatus(booking)]}
                    </span>
                    <div
                      className="relative"
                      ref={(el: HTMLDivElement | null) => {
                        dropdownRefs.current[`mobile-${booking.id}`] = el;
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const button = e.currentTarget;
                          const rect = button.getBoundingClientRect();
                          if (openDropdownId === `mobile-${booking.id}`) {
                            setOpenDropdownId(null);
                            setDropdownCoords(null);
                          } else {
                            setOpenDropdownId(`mobile-${booking.id}`);
                            const buttonCenterY = rect.top + rect.height / 2;
                            setDropdownCoords({
                              top: buttonCenterY,
                              right: window.innerWidth - rect.right,
                            });
                          }
                        }}
                        className="inline-flex items-center justify-center p-0.5 text-slate-600 hover:text-slate-900 transition-colors focus:outline-none touch-manipulation active:scale-[0.98]"
                        aria-label="Actions menu"
                      >
                        <IoEllipsisVertical className="w-5 h-5" />
                      </button>
                      {openDropdownId === `mobile-${booking.id}` && dropdownCoords && typeof window !== 'undefined' && createPortal(
                        <div
                          className="dropdown-menu fixed w-48 rounded-lg border border-slate-200 bg-white shadow-2xl z-[9999]"
                          style={{
                            top: `${Math.max(12, Math.min(window.innerHeight - 200, dropdownCoords.top))}px`,
                            right: `${Math.max(12, dropdownCoords.right + 8)}px`,
                            transform: 'translateY(-50%)',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="py-1">
                            {booking.invoice && onViewInvoice && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewInvoice(booking.id);
                                  setOpenDropdownId(null);
                                  setDropdownCoords(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                              >
                                <IoEyeOutline className="w-4 h-4" />
                                View Invoice
                              </button>
                            )}
                            {onMakeQuotation && !booking.invoice && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMakeQuotation(booking.id);
                                  setOpenDropdownId(null);
                                  setDropdownCoords(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                              >
                                <IoDocumentTextOutline className="w-4 h-4 text-rose-600" />
                                Quote
                              </button>
                            )}
                            {booking.invoice && booking.paymentStatus !== 'paid' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBookingForPayment(booking);
                                  setPaymentModalOpen(true);
                                  setOpenDropdownId(null);
                                  setDropdownCoords(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 touch-manipulation"
                              >
                                <IoCashOutline className="w-4 h-4" />
                                Update Payment
                              </button>
                            )}
                            {booking.invoice && booking.paymentStatus === 'paid' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdatePayment(booking.id, 'refunded');
                                  setOpenDropdownId(null);
                                  setDropdownCoords(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2 touch-manipulation"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service Date:</span>
                    <span className="font-medium text-slate-900 text-right">
                      {format(parseISO(booking.slot.date), 'MMM d, yyyy')} {formatTime12Hour(booking.slot.time)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Amount:</span>
                    <span className="font-semibold text-slate-900">
                      ₱{booking.invoice?.total.toLocaleString('en-PH') || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Paid Amount:</span>
                    {(() => {
                      const deposit = booking.depositAmount || 0;
                      const paid = booking.paidAmount || 0;
                      const totalPaid = deposit + paid;
                      return totalPaid > 0 ? (
                        <span className="font-semibold text-emerald-700">
                          ₱{totalPaid.toLocaleString('en-PH')}
                        </span>
                      ) : (
                        <span className="text-slate-400">₱0</span>
                      );
                    })()}
                  </div>
                  {booking.invoice && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Balance:</span>
                      <span className={`font-bold ${
                        (() => {
                          const total = booking.invoice?.total || 0;
                          const deposit = booking.depositAmount || 0;
                          const paid = booking.paidAmount || 0;
                          const totalPaid = deposit + paid;
                          const balance = total - totalPaid;
                          return balance > 0 ? 'text-red-700' : 'text-emerald-700';
                        })()
                      }`}>
                        ₱{(() => {
                          const total = booking.invoice?.total || 0;
                          const deposit = booking.depositAmount || 0;
                          const paid = booking.paidAmount || 0;
                          const totalPaid = deposit + paid;
                          const balance = total - totalPaid;
                          return Math.max(0, balance).toLocaleString('en-PH');
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View for This Week */}
          <div className="hidden lg:block rounded-2xl border-2 border-emerald-200 bg-emerald-50 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-emerald-100 border-b border-emerald-200">
                  <tr>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Booking</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Customer</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Date & Time</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Total</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Paid</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Balance</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Status</th>
                    <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-200">
                  {thisWeekBookings.map((booking) => {
                    const total = booking.invoice?.total || 0;
                    const deposit = booking.depositAmount || 0;
                    const paid = booking.paidAmount || 0;
                    const totalPaid = deposit + paid;
                    const balance = total - totalPaid;
                    return (
                      <tr key={booking.id} className="hover:bg-emerald-100/50">
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm font-medium text-slate-900">{booking.bookingId}</td>
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm text-slate-700">{getCustomerName(booking)}</td>
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm text-slate-700">
                          {format(parseISO(booking.slot.date), 'MMM d')} {formatTime12Hour(booking.slot.time)}
                        </td>
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm font-semibold text-slate-900">₱{total.toLocaleString('en-PH')}</td>
                        <td className="px-4 xl:px-6 py-3 text-xs sm:text-sm text-slate-700">
                      <button
                        onClick={() => {
                          setSelectedBookingForPayment(booking);
                          setPaymentModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold hover:underline cursor-pointer text-slate-700"
                        title="Click to update payment"
                      >
                        ₱{totalPaid.toLocaleString('en-PH')}
                        <IoCreateOutline className="w-3.5 h-3.5" />
                      </button>
                    </td>
                        <td className="px-4 xl:px-6 py-3">
                          <span
                            className={`inline-flex items-center text-xs sm:text-sm font-semibold ${
                              balance > 0 ? 'text-red-700' : 'text-emerald-700'
                            }`}
                          >
                            ₱{Math.max(0, balance).toLocaleString('en-PH')}
                          </span>
                        </td>
                        <td className="px-4 xl:px-6 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            paymentStatusColors[getEffectivePaymentStatus(booking)]
                          }`}>
                            {paymentStatusLabels[getEffectivePaymentStatus(booking)]}
                          </span>
                        </td>
                        <td className="px-4 xl:px-6 py-3">
                          {booking.invoice && booking.paymentStatus === 'paid' ? (
                            <button
                              onClick={() => handleUpdatePayment(booking.id, 'refunded')}
                              className="rounded-full border-2 border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Refund
                            </button>
                          ) : onMakeQuotation && !booking.invoice ? (
                            <button
                              onClick={() => onMakeQuotation(booking.id)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${
                                'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              Quote
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedBookingForPayment(booking);
                                setPaymentModalOpen(true);
                              }}
                              className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                            >
                              Update
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* All Other Bookings - Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs sm:text-sm text-slate-500">
            No invoices found.
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <div key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{booking.bookingId}</span>
                  </div>
                  <div className="text-xs text-slate-600">{getCustomerName(booking)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border ${
                      paymentStatusColors[booking.paymentStatus || 'unpaid']
                    }`}
                  >
                    {paymentStatusLabels[booking.paymentStatus || 'unpaid']}
                  </span>
                  <div
                    className="relative"
                    ref={(el: HTMLDivElement | null) => {
                      dropdownRefs.current[`mobile-${booking.id}`] = el;
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const button = e.currentTarget;
                        const rect = button.getBoundingClientRect();
                        if (openDropdownId === `mobile-${booking.id}`) {
                          setOpenDropdownId(null);
                          setDropdownCoords(null);
                        } else {
                          setOpenDropdownId(`mobile-${booking.id}`);
                          const buttonCenterY = rect.top + rect.height / 2;
                          setDropdownCoords({
                            top: buttonCenterY,
                            right: window.innerWidth - rect.right,
                          });
                        }
                      }}
                      className="inline-flex items-center justify-center p-0.5 text-slate-600 hover:text-slate-900 transition-colors focus:outline-none touch-manipulation active:scale-[0.98]"
                      aria-label="Actions menu"
                    >
                      <IoEllipsisVertical className="w-5 h-5" />
                    </button>
                    {openDropdownId === `mobile-${booking.id}` && dropdownCoords && typeof window !== 'undefined' && createPortal(
                      <div
                        className="dropdown-menu fixed w-48 rounded-lg border border-slate-200 bg-white shadow-2xl z-[9999]"
                        style={{
                          top: `${Math.max(12, Math.min(window.innerHeight - 200, dropdownCoords.top))}px`,
                          right: `${Math.max(12, dropdownCoords.right + 8)}px`,
                          transform: 'translateY(-50%)',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          {booking.invoice && onViewInvoice && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewInvoice(booking.id);
                                setOpenDropdownId(null);
                                setDropdownCoords(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                            >
                              <IoEyeOutline className="w-4 h-4" />
                              View Invoice
                            </button>
                          )}
                          {onMakeQuotation && !booking.invoice && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMakeQuotation(booking.id);
                                setOpenDropdownId(null);
                                setDropdownCoords(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                            >
                              <IoDocumentTextOutline className="w-4 h-4 text-rose-600" />
                              Quote
                            </button>
                          )}
                          {booking.invoice && booking.paymentStatus !== 'paid' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBookingForPayment(booking);
                                setPaymentModalOpen(true);
                                setOpenDropdownId(null);
                                setDropdownCoords(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 touch-manipulation"
                            >
                              <IoCashOutline className="w-4 h-4" />
                              Update Payment
                            </button>
                          )}
                          {booking.invoice && booking.paymentStatus === 'paid' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdatePayment(booking.id, 'refunded');
                                setOpenDropdownId(null);
                                setDropdownCoords(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2 touch-manipulation"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Service Date:</span>
                  <span className="font-medium text-slate-900 text-right">
                    {format(parseISO(booking.slot.date), 'MMM d, yyyy')}
                  </span>
                </div>
                {booking.depositDate && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>DP Paid:</span>
                    <span>{format(parseISO(booking.depositDate), 'MMM d, yyyy')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Amount:</span>
                  <span className="font-semibold text-slate-900">
                    ₱{booking.invoice?.total.toLocaleString('en-PH') || '0'}
                  </span>
                </div>
                {!booking.invoice && booking.depositAmount && (
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400 italic">No invoice yet</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Paid Amount:</span>
                  {(() => {
                    const deposit = booking.depositAmount || 0;
                    const paid = booking.paidAmount || 0;
                    const totalPaid = deposit + paid;
                    return totalPaid > 0 ? (
                      <span className="font-semibold text-emerald-700">
                        ₱{totalPaid.toLocaleString('en-PH')}
                      </span>
                    ) : (
                      <span className="text-slate-400">₱0</span>
                    );
                  })()}
                </div>
                {booking.invoice && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Balance:</span>
                    <span className={`font-bold ${(() => {
                      const total = booking.invoice?.total || 0;
                      const deposit = booking.depositAmount || 0;
                      const paid = booking.paidAmount || 0;
                      const totalPaid = deposit + paid;
                      const balance = total - totalPaid;
                      return balance > 0 ? 'text-red-700' : 'text-emerald-700';
                    })()}`}>
                      ₱{(() => {
                        const total = booking.invoice?.total || 0;
                        const deposit = booking.depositAmount || 0;
                        const paid = booking.paidAmount || 0;
                        const totalPaid = deposit + paid;
                        const balance = total - totalPaid;
                        return Math.max(0, balance).toLocaleString('en-PH');
                      })()}
                    </span>
                  </div>
                )}
                {booking.paymentStatus === 'paid' && booking.tipAmount && booking.tipAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tip:</span>
                    <span className="font-semibold text-emerald-700">
                      ₱{booking.tipAmount.toLocaleString('en-PH')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Booking
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Customer
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Service Date
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Total Amount
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Paid Amount
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Balance
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Commission
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Status
                </th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 relative">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50">
                  <td className="px-4 xl:px-6 py-3">
                      <span className="text-xs xl:text-sm font-semibold text-slate-900">{booking.bookingId}</span>
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      <span className="text-xs xl:text-sm text-slate-900">{getCustomerName(booking)}</span>
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      <div>
                        <span className="text-xs xl:text-sm text-slate-600">
                          {format(parseISO(booking.slot.date), 'MMM d, yyyy')}
                        </span>
                        {booking.depositDate && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            DP: {format(parseISO(booking.depositDate), 'MMM d')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      <span className="text-xs xl:text-sm font-semibold text-slate-900">
                        ₱{booking.invoice?.total.toLocaleString('en-PH') || '0'}
                      </span>
                      {!booking.invoice && booking.depositAmount && (
                        <p className="text-xs text-slate-400 italic">No invoice yet</p>
                      )}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      {(() => {
                        const deposit = booking.depositAmount || 0;
                        const paid = booking.paidAmount || 0;
                        const totalPaid = deposit + paid;
                        return totalPaid > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedBookingForPayment(booking);
                              setPaymentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs xl:text-sm font-semibold hover:underline cursor-pointer text-slate-900"
                            title="Click to update payment"
                          >
                            ₱{totalPaid.toLocaleString('en-PH')}
                            <IoCreateOutline className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedBookingForPayment(booking);
                              setPaymentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs xl:text-sm font-semibold hover:underline cursor-pointer text-slate-400"
                            title="Click to update payment"
                          >
                            —
                            <IoCreateOutline className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      {(() => {
                        const total = booking.invoice?.total || 0;
                        const deposit = booking.depositAmount || 0;
                        const paid = booking.paidAmount || 0;
                        const totalPaid = deposit + paid;
                        const balance = total - totalPaid;
                        return (
                          <div>
                            <span
                              className={`inline-flex items-center text-xs xl:text-sm font-bold ${
                                balance > 0 ? 'text-red-700' : 'text-emerald-700'
                              }`}
                            >
                              ₱{Math.max(0, balance).toLocaleString('en-PH')}
                            </span>
                            {booking.paymentStatus === 'paid' && booking.tipAmount && booking.tipAmount > 0 && (
                              <p className="text-xs text-emerald-700 mt-1 font-semibold">
                                Tip: ₱{booking.tipAmount.toLocaleString('en-PH')}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      {booking.invoice?.total ? (() => {
                        const tech = nailTechs.find(t => t.id === booking.nailTechId);
                        if (tech && tech.commissionRate) {
                          return (
                            <span className="text-xs xl:text-sm font-semibold text-amber-700">
                              ₱{(booking.invoice.total * tech.commissionRate).toLocaleString('en-PH')}
                            </span>
                          );
                        }
                        return <span className="text-xs xl:text-sm text-slate-400">—</span>;
                      })() : (
                        <span className="text-xs xl:text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          paymentStatusColors[getEffectivePaymentStatus(booking)]
                        }`}
                      >
                        {paymentStatusLabels[getEffectivePaymentStatus(booking)]}
                      </span>
                    </td>
                    <td className="px-4 xl:px-6 py-3">
                      <div className="relative inline-block" ref={(el) => { dropdownRefs.current[booking.id] = el; }}>
                        <button
                          onClick={() => {
                            setOpenDropdownId(openDropdownId === booking.id ? null : booking.id);
                            setDropdownCoords(null);
                          }}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                          aria-label="Actions"
                        >
                          <IoEllipsisVertical className="w-5 h-5 text-slate-600" />
                        </button>
                        {openDropdownId === booking.id && (
                          <div 
                            className="fixed w-48 rounded-xl border border-slate-200 bg-white shadow-lg z-[100] overflow-hidden"
                            style={{
                              right: typeof window !== 'undefined' ? `${Math.max(20, window.innerWidth - (dropdownRefs.current[booking.id]?.getBoundingClientRect().right || 0) + 20)}px` : '20px',
                              top: dropdownPosition[booking.id] === 'up' 
                                ? `${Math.max(20, (dropdownRefs.current[booking.id]?.getBoundingClientRect().top || 0) - 100)}px`
                                : `${Math.min((typeof window !== 'undefined' ? window.innerHeight : 1000) - 120, (dropdownRefs.current[booking.id]?.getBoundingClientRect().bottom || 0) + 4)}px`,
                            }}
                          >
                          {/* View Invoice Action */}
                          {booking.invoice && onViewInvoice && (
                            <button
                              onClick={() => {
                                onViewInvoice(booking.id);
                                setOpenDropdownId(null);
                              }}
                              className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors border-b border-slate-100"
                            >
                              View Invoice
                            </button>
                          )}

                          {/* Quote Action */}
                          {onMakeQuotation && !booking.invoice && (
                              <button
                                onClick={() => {
                                  onMakeQuotation(booking.id);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors border-b border-slate-100"
                              >
                              Quote
                              </button>
                            )}
                            
                            {/* Refund Action */}
                            {booking.invoice && booking.paymentStatus === 'paid' && (
                              <button
                                onClick={() => {
                                  handleUpdatePayment(booking.id, 'refunded');
                                  setOpenDropdownId(null);
                                }}
                                className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentModal
        open={paymentModalOpen}
        booking={selectedBookingForPayment}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedBookingForPayment(null);
        }}
        onSubmit={async (amountPaid, paymentMethod) => {
          if (!selectedBookingForPayment) return;
          
          const total = selectedBookingForPayment.invoice?.total || 0;
          const deposit = selectedBookingForPayment.depositAmount || 0;
          const balance = total - deposit;
          const totalPaid = (selectedBookingForPayment.paidAmount || 0) + amountPaid;
          const tipAmount = totalPaid > balance ? totalPaid - balance : 0;
          const paymentStatus: PaymentStatus = totalPaid >= balance ? 'paid' : 'partial';
          
          await handleUpdatePayment(selectedBookingForPayment.id, paymentStatus, totalPaid, tipAmount, paymentMethod);
        }}
      />
    </div>
  );
}

