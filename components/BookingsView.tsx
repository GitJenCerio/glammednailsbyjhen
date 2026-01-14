'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import type { Booking, Slot, BookingWithSlot, NailTech } from '@/lib/types';
import { FormResponseModal } from '@/components/admin/modals/FormResponseModal';
import { PaymentModal } from '@/components/admin/modals/PaymentModal';
import { IoChevronDown, IoEyeOutline, IoDocumentTextOutline, IoCalendarOutline, IoTrashOutline, IoRefreshOutline, IoCloseCircleOutline, IoEllipsisVertical, IoCashOutline, IoSearchOutline, IoClose, IoSparkles } from 'react-icons/io5';
import { ChangeServiceTypeModal } from '@/components/admin/modals/ChangeServiceTypeModal';

type FilterPeriod = 'all' | 'today' | 'week' | 'month';
type StatusFilter = 'all' | 'upcoming' | 'done';
type MonthFilter = 'all' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface BookingsViewProps {
  bookings: Booking[];
  slots: Slot[];
  selectedDate: string;
  customers?: Array<{ id: string; name?: string; phone?: string }>;
  nailTechs?: NailTech[];
  selectedNailTechId?: string | null;
  onNailTechChange?: (nailTechId: string | null) => void;
  onCancel?: (bookingId: string) => void;
  onReschedule?: (bookingId: string) => void;
  onSplitReschedule?: (bookingId: string) => void;
  onMakeQuotation?: (bookingId: string) => void;
  onConfirm?: (bookingId: string) => void;
  onUpdatePayment?: (bookingId: string, paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded', paidAmount?: number, tipAmount?: number) => void;
  onServiceTypeChange?: () => void;
}

const statusLabels: Record<string, string> = {
  pending_form: 'Awaiting Form',
  pending_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
};

const statusColors: Record<string, string> = {
  pending_form: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  pending_payment: 'bg-orange-100 text-orange-800 border-orange-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

export function BookingsView({ bookings, slots, selectedDate, customers = [], nailTechs = [], selectedNailTechId = null, onNailTechChange, onCancel, onReschedule, onSplitReschedule, onMakeQuotation, onConfirm, onUpdatePayment, onServiceTypeChange }: BookingsViewProps) {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('all');
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
  const [clientTypeMap, setClientTypeMap] = useState<Record<string, 'repeat' | 'new'>>({});
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [responseModalBooking, setResponseModalBooking] = useState<BookingWithSlot | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<BookingWithSlot | null>(null);
  const [missingSlots, setMissingSlots] = useState<Map<string, Slot>>(new Map());
  const [restoringSlots, setRestoringSlots] = useState(false);
  const [serviceTypeModalOpen, setServiceTypeModalOpen] = useState(false);
  const [selectedBookingForServiceChange, setSelectedBookingForServiceChange] = useState<BookingWithSlot | null>(null);

  // Automatically fetch missing slots for confirmed bookings
  useEffect(() => {
    const fetchMissingSlots = async () => {
      // Find confirmed bookings with missing slots
      const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
      const existingSlotIds = new Set(slots.map(s => s.id));
      
      // Check which slots we've already tried to fetch (stored in missingSlots)
      const alreadyFetched = new Set(missingSlots.keys());
      
      const bookingsWithMissingSlots = confirmedBookings.filter(
        booking => !existingSlotIds.has(booking.slotId) && !alreadyFetched.has(booking.slotId)
      );

      if (bookingsWithMissingSlots.length === 0) return;

      setRestoringSlots(true);
      const newSlots = new Map(missingSlots);

      for (const booking of bookingsWithMissingSlots) {
        try {
          // Try to fetch the slot directly from Firebase
          const response = await fetch(`/api/slots/${booking.slotId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.slot) {
              newSlots.set(booking.slotId, data.slot);
              console.log(`✅ Restored slot ${booking.slotId} (${data.slot.date} ${data.slot.time}) for confirmed booking ${booking.bookingId}`);
            }
          } else if (response.status === 404) {
            // Slot doesn't exist - try to recover it using the booking recovery endpoint
            try {
              const recoverResponse = await fetch('/api/bookings/recover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: booking.bookingId }),
              });
              
              if (recoverResponse.ok) {
                const recoverData = await recoverResponse.json();
                if (recoverData.slot) {
                  newSlots.set(booking.slotId, recoverData.slot);
                  console.log(`✅ ${recoverData.action === 'created' ? 'Created' : 'Found'} slot ${booking.slotId} (${recoverData.slot.date} ${recoverData.slot.time}) for confirmed booking ${booking.bookingId}`);
                }
              } else {
                const errorData = await recoverResponse.json().catch(() => ({}));
                console.warn(`❌ Cannot recover slot for booking ${booking.bookingId}: ${errorData.error || 'Unknown error'}`);
              }
            } catch (e) {
              console.warn(`Failed to recover booking ${booking.bookingId}:`, e);
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch slot ${booking.slotId} for booking ${booking.bookingId}:`, error);
        }
      }

      if (newSlots.size > missingSlots.size) {
        setMissingSlots(newSlots);
        console.log(`Restored ${newSlots.size - missingSlots.size} missing slot(s) for confirmed bookings`);
      }
      setRestoringSlots(false);
    };

    fetchMissingSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, slots]); // Removed missingSlots from deps to prevent infinite loops

  // Combine bookings with slots and filter by nail tech
  const bookingsWithSlots = useMemo<BookingWithSlot[]>(() => {
    const list: BookingWithSlot[] = [];
    let filteredBookings = bookings;
    
    // Filter bookings by selected nail tech only if nail tech filter is active
    if (activeFilterField === 'nailTech' && localSelectedNailTechId) {
      filteredBookings = bookings.filter((booking) => booking.nailTechId === localSelectedNailTechId);
    }
    
    // Combine regular slots with restored missing slots
    const allSlots = [...slots, ...Array.from(missingSlots.values())];
    
    filteredBookings.forEach((booking) => {
      // Find the slot for this booking (check both regular slots and restored missing slots)
      const slot = allSlots.find((candidate) => candidate.id === booking.slotId);
      
      if (!slot) {
        // Slot is still missing - log warning for confirmed bookings
        if (booking.status === 'confirmed') {
          console.warn(`Confirmed booking ${booking.bookingId} (${booking.id}) references missing slot ${booking.slotId}. Slot not found in Firebase.`);
        }
        return; // Skip bookings with missing slots
      }
      
      // Also filter by selected nail tech for slots (double-check) - only if nail tech filter is active
      if (activeFilterField === 'nailTech' && localSelectedNailTechId && slot.nailTechId !== localSelectedNailTechId) return;
      
      const linkedSlots = (booking.linkedSlotIds ?? [])
        .map((linkedId) => allSlots.find((candidate) => candidate.id === linkedId))
        .filter((value): value is Slot => Boolean(value))
        .filter((linkedSlot) => !(activeFilterField === 'nailTech' && localSelectedNailTechId) || linkedSlot.nailTechId === localSelectedNailTechId);
      const pairedSlot = linkedSlots[0];
      list.push({ ...booking, slot, pairedSlot, linkedSlots });
    });
    return list;
  }, [bookings, slots, missingSlots, localSelectedNailTechId, activeFilterField]);

  const getClientTypeFromForm = (customerData: Record<string, string> | undefined): 'repeat' | 'new' | null => {
    if (!customerData) return null;

    // Check for client type in form data (various possible field names)
    const clientTypeField = 
      customerData['Client Type'] ||
      customerData['client type'] ||
      customerData['ClientType'] ||
      customerData['clientType'] ||
      customerData['Are you a new or returning client?'] ||
      customerData['New or Returning Client'] ||
      customerData['Customer Type'] ||
      customerData['customer type'] ||
      customerData['Type'] ||
      customerData['type'];

    if (clientTypeField) {
      // Normalize the value to 'repeat' or 'new'
      const normalizedValue = String(clientTypeField).toLowerCase().trim();
      if (normalizedValue.includes('repeat') || normalizedValue.includes('returning') || normalizedValue.includes('existing')) {
        return 'repeat';
      } else if (normalizedValue.includes('new') || normalizedValue.includes('first')) {
        return 'new';
      }
    }

    return null;
  };

  // Determine client type (repeat vs new) - prioritize booking record, then form data, then booking history
  useEffect(() => {
    const typeMap: Record<string, 'repeat' | 'new'> = {};
    const customerBookings: Record<string, BookingWithSlot[]> = {};

    bookingsWithSlots.forEach((booking) => {
      // First priority: Check if client type is stored in the booking record (from modal selection)
      if (booking.clientType) {
        typeMap[booking.id] = booking.clientType;
        return; // Skip other checks if booking record has it
      }

      // Second priority: Check if client type is specified in the form data
      if (booking.customerData) {
        const formClientType = getClientTypeFromForm(booking.customerData);
        if (formClientType) {
          typeMap[booking.id] = formClientType;
          return; // Skip booking history check if form data has it
        }

        // If not found in booking record or form, prepare for booking history check
        if (!typeMap[booking.id]) {
          // Try to find a unique identifier - phone is most reliable
          const phone = booking.customerData['Phone'] || booking.customerData['phone'] || booking.customerData['Contact Number'] || booking.customerData['contact'];
          const name = booking.customerData['Name'] || booking.customerData['name'] || booking.customerData['Full Name'] || booking.customerData['fullName'];
          const identifier = phone || name || booking.bookingId;

          if (!customerBookings[identifier]) {
            customerBookings[identifier] = [];
          }
          customerBookings[identifier].push(booking);
        }
      } else {
        // No customer data, use booking ID as identifier for history check
        if (!customerBookings[booking.bookingId]) {
          customerBookings[booking.bookingId] = [];
        }
        customerBookings[booking.bookingId].push(booking);
      }
    });

    // For bookings without form-specified client type, determine from booking history
    Object.keys(customerBookings).forEach((identifier) => {
      const customerBookingList = customerBookings[identifier];
      // Sort by creation date
      customerBookingList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      customerBookingList.forEach((booking, index) => {
        // Only set if not already set from form data
        if (!typeMap[booking.id]) {
          // If this is not the first booking for this customer, they're a repeat client
          typeMap[booking.id] = index === 0 ? 'new' : 'repeat';
        }
      });
    });

    setClientTypeMap(typeMap);
  }, [bookingsWithSlots]);

  // Finance helpers for desktop + mobile views
  const getFinanceSummary = useCallback((booking: BookingWithSlot) => {
    const total = booking.invoice?.total || 0;
    const deposit = booking.depositAmount || 0;
    const paid = booking.paidAmount || 0;

    let balance = 0;
    if (booking.invoice) {
      const rawBalance = total - deposit - paid;
      balance = Math.max(0, rawBalance);
    } else if (deposit > 0) {
      // If there's only a deposit and no invoice, treat balance as 0 for display
      balance = 0;
    }

    return { total, deposit, paid, balance };
  }, []);

  // Map booking/payment status into friendly stage labels for the bookings table
  const getBookingStageLabel = useCallback((booking: BookingWithSlot): string => {
    const hasInvoice = !!booking.invoice;
    const { deposit, balance } = getFinanceSummary(booking);

    // Before invoice exists
    if (!hasInvoice) {
      if (booking.status === 'pending_form') return 'Awaiting Form';
      if (booking.status === 'pending_payment') return 'Awaiting DP';
      if (booking.status === 'confirmed') return 'Confirmed';
      return String(booking.status).replace('_', ' ');
    }

    // With invoice
    if (booking.paymentStatus === 'paid' || balance === 0) {
      return 'Done';
    }

    // If booking is already confirmed, show "Confirmed" instead of "Awaiting DP"
    if (booking.status === 'confirmed' && booking.paymentStatus === 'unpaid' && deposit === 0) {
      return 'Confirmed';
    }

    if (booking.paymentStatus === 'unpaid' && deposit === 0) {
      return 'Awaiting DP';
    }

    // Invoice exists and there is still balance to pay
    return 'Invoiced';
  }, [getFinanceSummary]);

  // Helper functions for search (defined early so they can be used in matchesSearch)
  const getCustomerName = (booking: BookingWithSlot): string => {
    // Priority 1: Get customer name from form data (for bookings with submitted forms)
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

      // Try to find last name/surname (including the exact Google Form field name with autofill text)
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
      
      // Last resort: look for any field that might be a name (not email, phone, etc.)
      for (const [key, value] of Object.entries(booking.customerData)) {
        const lowerKey = key.toLowerCase();
        // Skip non-name fields
        if (lowerKey.includes('email') || lowerKey.includes('phone') || lowerKey.includes('contact') || 
            lowerKey.includes('booking') || lowerKey.includes('date') || lowerKey.includes('time') ||
            lowerKey.includes('service') || lowerKey.includes('location') || lowerKey.includes('referral')) {
          continue;
        }
        // If it's a reasonable length, use it
        const strValue = String(value).trim();
        if (strValue.length > 0 && strValue.length < 100) {
          return strValue;
        }
      }
    }
    
    // Priority 2: Try to get name from customer record if customerId exists
    if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
      const customer = customers.find(c => c.id === booking.customerId);
      if (customer?.name) {
        return customer.name;
      }
    }
    
    // Priority 3: For pending_form bookings, check clientType
    if (booking.status === 'pending_form') {
      // If it's a repeat client and we have customerId, try to show name
      if (booking.clientType === 'repeat') {
        if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
          // Try to find customer name from customers list
          const customer = customers.find(c => c.id === booking.customerId);
          if (customer?.name) {
            return customer.name;
          }
        }
        return 'Repeat Client';
      } else if (booking.clientType === 'new') {
        return 'New Client';
      } else {
        // clientType not set - check if customerId exists to determine
        if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
          const customer = customers.find(c => c.id === booking.customerId);
          if (customer?.name) {
            return customer.name;
          }
          return 'Repeat Client'; // Has customerId but no clientType set
        }
        return 'New Client'; // Default for pending_form without customerId
      }
    }
    
    // Last resort: return bookingId
    return booking.bookingId;
  };

  const getCustomerPhone = (booking: BookingWithSlot): string => {
    // Priority 1: Try to get phone from form data (for bookings with submitted forms)
    if (booking.customerData && Object.keys(booking.customerData).length > 0) {
      // Helper function to find field by fuzzy matching key names
      const findPhoneField = (keywords: string[]): string | null => {
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

      // Try various phone field name variations using fuzzy matching
      const phone = findPhoneField([
        'contact number',
        'phone number',
        'phone',
        'contact',
        'mobile',
        'cell',
        'telephone',
        'tel'
      ]);
      
      if (phone) return phone;
    }
    
    // Priority 2: Try to get phone from customer record if customerId exists
    if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION' && customers.length > 0) {
      const customer = customers.find(c => c.id === booking.customerId);
      if (customer?.phone) {
        return customer.phone;
      }
    }
    
    return 'N/A';
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getTimeRange = (booking: BookingWithSlot): string => {
    if (!booking.slot) return 'N/A';
    if (booking.linkedSlots && booking.linkedSlots.length > 0) {
      const lastSlot = booking.linkedSlots[booking.linkedSlots.length - 1];
      return `${formatTime(booking.slot.time)} - ${formatTime(lastSlot.time)}`;
    }
    if (booking.pairedSlot) {
      return `${formatTime(booking.slot.time)} - ${formatTime(booking.pairedSlot.time)}`;
    }
    return formatTime(booking.slot.time);
  };

  // Search function to filter bookings by query
  const matchesSearch = useCallback((booking: BookingWithSlot, query: string): boolean => {
    if (!query.trim()) return true;
    
    const lowerQuery = query.toLowerCase().trim();
    
    // Search by booking ID
    if (booking.bookingId.toLowerCase().includes(lowerQuery)) return true;
    
    // Search by customer name
    const customerName = getCustomerName(booking).toLowerCase();
    if (customerName.includes(lowerQuery)) return true;
    
    // Search by phone number
    const phone = getCustomerPhone(booking).toLowerCase();
    if (phone.includes(lowerQuery)) return true;
    
    // Search by service type
    if (booking.serviceType && booking.serviceType.toLowerCase().includes(lowerQuery)) return true;
    if (booking.serviceType && serviceLabels[booking.serviceType]?.toLowerCase().includes(lowerQuery)) return true;
    
    // Search by date
    if (booking.slot) {
      const dateStr = format(parseISO(booking.slot.date), 'MMM d, yyyy').toLowerCase();
      if (dateStr.includes(lowerQuery)) return true;
    }
    
    // Search by time
    if (booking.slot) {
      const timeStr = getTimeRange(booking).toLowerCase();
      if (timeStr.includes(lowerQuery)) return true;
    }
    
    // Search in customer data fields
    if (booking.customerData) {
      for (const value of Object.values(booking.customerData)) {
        if (String(value).toLowerCase().includes(lowerQuery)) return true;
      }
    }
    
    return false;
  }, [getCustomerName, getCustomerPhone, getTimeRange]);

  // Filter bookings by period, status, and month
  const filteredBookings = useMemo(() => {
    let result: BookingWithSlot[];

    // Base date filtering (All / Today / Upcoming / This Month)
    if (filterPeriod === 'all') {
      result = bookingsWithSlots.filter((booking) => booking.slot !== undefined);
      
      // Apply month filter if selected (for "all" period)
      if (monthFilter !== 'all') {
        result = result.filter((booking) => {
          if (!booking.slot) return false;
          const appointmentDate = parseISO(booking.slot.date);
          return appointmentDate.getMonth() + 1 === monthFilter; // getMonth() returns 0-11
        });
      }
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let start: Date;
      let end: Date;

      switch (filterPeriod) {
        case 'today':
          start = startOfDay(today);
          end = endOfDay(today);
          break;
        case 'week':
          start = startOfWeek(today, { weekStartsOn: 1 }); // Monday
          end = endOfWeek(today, { weekStartsOn: 1 });
          break;
        case 'month':
          start = startOfMonth(today);
          end = endOfMonth(today);
          break;
        default:
          return bookingsWithSlots.filter((booking) => booking.slot !== undefined);
      }

      result = bookingsWithSlots.filter((booking) => {
        if (!booking.slot) return false;
        const bookingDate = parseISO(booking.slot.date);
        return isWithinInterval(bookingDate, { start, end });
      });
    }

    // Month filter (January, February, etc.)
    if (monthFilter !== 'all') {
      result = result.filter((booking) => {
        if (!booking.slot) return false;
        const monthIndex = parseISO(booking.slot.date).getMonth() + 1; // 1-12
        return monthIndex === monthFilter;
      });
    }

    // Status filter (Upcoming vs Done)
    if (statusFilter !== 'all') {
      result = result.filter((booking) => {
        const stage = getBookingStageLabel(booking);
        if (statusFilter === 'done') {
          return stage === 'Done';
        }
        // 'upcoming' = anything not done
        return stage !== 'Done';
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      result = result.filter((booking) => matchesSearch(booking, searchQuery));
    }

    // Sort by date and time (ascending - earliest first)
    return result.sort((a, b) => {
      if (!a.slot || !b.slot) return 0;
      const dateCompare = a.slot.date.localeCompare(b.slot.date);
      if (dateCompare !== 0) return dateCompare;
      // Ascending order: earlier times first
      return a.slot.time.localeCompare(b.slot.time);
    });
  }, [bookingsWithSlots, filterPeriod, statusFilter, monthFilter, getBookingStageLabel, searchQuery, matchesSearch]);

  // Calculate today's bookings
  const todayBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let result = bookingsWithSlots.filter((booking) => {
      if (!booking.slot) return false;
      const appointmentDate = parseISO(booking.slot.date);
      return appointmentDate >= today && appointmentDate < tomorrow;
    });

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((booking) => {
        const stage = getBookingStageLabel(booking);
        if (statusFilter === 'done') {
          return stage === 'Done';
        }
        return stage !== 'Done';
      });
    }

    // Apply nail tech filter only if nail tech filter is active
    if (activeFilterField === 'nailTech' && localSelectedNailTechId) {
      result = result.filter((booking) => booking.nailTechId === localSelectedNailTechId);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      result = result.filter((booking) => matchesSearch(booking, searchQuery));
    }

    return result.sort((a, b) => {
      if (!a.slot || !b.slot) return 0;
      const dateCompare = a.slot.date.localeCompare(b.slot.date);
      if (dateCompare !== 0) return dateCompare;
      return a.slot.time.localeCompare(b.slot.time);
    });
  }, [bookingsWithSlots, statusFilter, localSelectedNailTechId, activeFilterField, getBookingStageLabel, searchQuery, matchesSearch]);
  
  // Calculate upcoming bookings (today up to 3 days after today, excluding today's bookings to avoid duplicates)
  const thisWeekBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Calculate end date: 3 days after today
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 3);
    endDate.setHours(23, 59, 59, 999);
    
    let result = bookingsWithSlots.filter((booking) => {
      if (!booking.slot) return false;
      const appointmentDate = parseISO(booking.slot.date);
      // Exclude today's bookings (they're shown in the Today section)
      if (appointmentDate >= today && appointmentDate < tomorrow) return false;
      // Include bookings from tomorrow up to 3 days after today
      if (!(appointmentDate >= tomorrow && appointmentDate <= endDate)) return false;
      
      // Exclude cancelled bookings
      if (booking.status === 'cancelled') return false;
      
      // Exclude done bookings
      const stage = getBookingStageLabel(booking);
      if (stage === 'Done') return false;
      
      return true;
    });

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((booking) => {
        const stage = getBookingStageLabel(booking);
        if (statusFilter === 'done') {
          return stage === 'Done';
        }
        return stage !== 'Done';
      });
    }

    // Apply nail tech filter only if nail tech filter is active
    if (activeFilterField === 'nailTech' && localSelectedNailTechId) {
      result = result.filter((booking) => booking.nailTechId === localSelectedNailTechId);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      result = result.filter((booking) => matchesSearch(booking, searchQuery));
    }

    return result.sort((a, b) => {
      if (!a.slot || !b.slot) return 0;
      const dateCompare = a.slot.date.localeCompare(b.slot.date);
      if (dateCompare !== 0) return dateCompare;
      return a.slot.time.localeCompare(b.slot.time);
    });
  }, [bookingsWithSlots, statusFilter, localSelectedNailTechId, activeFilterField, getBookingStageLabel, searchQuery, matchesSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdownId) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside all dropdown containers
      const allRefs = Object.values(dropdownRefs.current);
      const clickedInside = allRefs.some(
        (ref) => ref && ref.contains(event.target as Node)
      );
      // Also check if clicking on the dropdown menu itself
      const target = event.target as HTMLElement;
      const isDropdownMenu = target.closest('.dropdown-menu');
      if (!clickedInside && !isDropdownMenu) {
        setOpenDropdownId(null);
        setDropdownPosition(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  // Helper function to render booking card (mobile)
  const renderBookingCard = (booking: BookingWithSlot, borderColor: string, bgColor: string) => {
    const clientType = booking.clientType || clientTypeMap[booking.id];
    const stageLabel = getBookingStageLabel(booking);
    const isDone = stageLabel === 'Done';
    
    return (
      <div key={booking.id} className={`rounded-2xl border-2 ${borderColor} ${bgColor} p-4 shadow-sm`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold text-slate-900">{booking.bookingId}</span>
              <span className="text-xs text-slate-600">•</span>
              <span className="text-xs text-slate-600 truncate">{getCustomerName(booking)}</span>
              {(booking.dateChanged || booking.timeChanged) && (
                <span className="text-xs sm:text-sm" title={booking.validationWarnings?.join('; ') || 'Date or time was changed'}>
                  ⚠️
                </span>
              )}
            </div>
            {booking.slot && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-slate-500">
                  {format(parseISO(booking.slot.date), 'MMM d, yyyy')}
                </span>
                <span className="text-xs text-slate-500">
                  {getTimeRange(booking)}
                </span>
                {booking.nailTechId && (() => {
                  const tech = nailTechs.find(t => t.id === booking.nailTechId);
                  if (!tech) return null;
                  
                  // Use muted colors similar to Type badges - assign colors based on tech index
                  const techIds = nailTechs.sort((a, b) => a.name.localeCompare(b.name)).map(t => t.id);
                  const techIndex = techIds.indexOf(tech.id);
                  const mutedColors = [
                    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
                    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
                    { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
                    { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
                    { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
                    { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
                    { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
                    { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
                  ];
                  const color = mutedColors[techIndex % mutedColors.length];
                  
                  return (
                    <span
                      className={`inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-semibold border ${color.bg} ${color.text} ${color.border}`}
                    >
                      Ms. {tech.name}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border flex-shrink-0 ${
              statusColors[booking.status] || 'bg-gray-100 text-gray-800 border-gray-200'
            }`}
          >
            {stageLabel}
          </span>
        </div>
        <div className="flex items-start gap-2 mt-3">
          <div className="flex-1 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-start gap-2">
              <span className="text-slate-500 flex-shrink-0">Service:</span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className="font-medium text-slate-900 text-right break-words">{booking.serviceType ? serviceLabels[booking.serviceType] || booking.serviceType : 'N/A'}</span>
                {booking.serviceLocation && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${
                      booking.serviceLocation === 'homebased_studio'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                    title={booking.serviceLocation === 'homebased_studio' ? 'Studio St' : 'Home Service'}
                  >
                    {booking.serviceLocation === 'homebased_studio' ? 'ST' : 'HS'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="text-slate-500 flex-shrink-0">Contact:</span>
              <span className="font-medium text-slate-600 text-right break-all">{getCustomerPhone(booking)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Type:</span>
              {clientType ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${
                    clientType === 'repeat'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {clientType === 'repeat' ? 'Repeat' : 'New'}
                </span>
              ) : (
                <span className="text-slate-400">N/A</span>
              )}
            </div>
          </div>
          {!isDone && (
            <div
              className="relative flex-shrink-0 -mr-1"
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
                    setDropdownPosition(null);
                  } else {
                    setOpenDropdownId(`mobile-${booking.id}`);
                    // Position dropdown at the middle-right of the button
                    const buttonCenterY = rect.top + rect.height / 2;
                    setDropdownPosition({
                      top: buttonCenterY,
                      right: window.innerWidth - rect.right,
                    });
                  }
                }}
                className="inline-flex items-center justify-center p-0.5 text-slate-700 hover:text-slate-900 transition-colors focus:outline-none touch-manipulation active:scale-[0.98]"
                aria-label="Actions menu"
              >
                <IoEllipsisVertical className="w-5 h-5 flex-shrink-0" />
              </button>
              {openDropdownId === `mobile-${booking.id}` && dropdownPosition && typeof window !== 'undefined' && createPortal(
                <div 
                  className="dropdown-menu fixed w-48 rounded-lg border border-slate-200 bg-white shadow-2xl z-[9999]"
                  style={{
                    top: `${Math.max(12, Math.min(window.innerHeight - 200, dropdownPosition.top))}px`,
                    right: `${Math.max(12, dropdownPosition.right + 8)}px`,
                    transform: 'translateY(-50%)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="py-1">
                    {booking.customerData && Object.keys(booking.customerData).length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setResponseModalBooking(booking);
                          setOpenDropdownId(null);
                          setDropdownPosition(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                      >
                        <IoEyeOutline className="w-4 h-4" />
                        View Response
                      </button>
                    )}
                    {onMakeQuotation && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMakeQuotation(booking.id);
                          setOpenDropdownId(null);
                          setDropdownPosition(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                      >
                        <IoDocumentTextOutline className="w-4 h-4 text-rose-600" />
                        {booking.invoice ? 'Requote' : 'Quotation'}
                      </button>
                    )}
                    {onReschedule && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReschedule(booking.id);
                          setOpenDropdownId(null);
                          setDropdownPosition(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                      >
                        <IoCalendarOutline className="w-4 h-4" />
                        Reschedule
                      </button>
                    )}
                    {onSplitReschedule && (booking.serviceType === 'mani_pedi' || (booking.linkedSlotIds && booking.linkedSlotIds.length > 0)) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSplitReschedule(booking.id);
                          setOpenDropdownId(null);
                          setDropdownPosition(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-purple-700 hover:bg-purple-50 flex items-center gap-2 touch-manipulation"
                      >
                        <IoRefreshOutline className="w-4 h-4" />
                        Split Reschedule
                      </button>
                    )}
                    {onUpdatePayment && booking.invoice && (() => {
                      const { balance } = getFinanceSummary(booking);
                      const isAwaitingPayment = (booking.paymentStatus === 'unpaid' || booking.paymentStatus === 'partial') && balance > 0;
                      return isAwaitingPayment ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBookingForPayment(booking);
                            setPaymentModalOpen(true);
                            setOpenDropdownId(null);
                            setDropdownPosition(null);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 touch-manipulation"
                        >
                          <IoCashOutline className="w-4 h-4" />
                          Payment
                        </button>
                      ) : null;
                    })()}
                    {booking.status !== 'cancelled' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBookingForServiceChange(booking);
                          setServiceTypeModalOpen(true);
                          setOpenDropdownId(null);
                          setDropdownPosition(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 touch-manipulation"
                      >
                        <IoSparkles className="w-4 h-4" />
                        Change Service
                      </button>
                    )}
                    {onCancel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancel(booking.id);
                          setOpenDropdownId(null);
                          setDropdownPosition(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2 touch-manipulation"
                      >
                        <IoCloseCircleOutline className="w-4 h-4" />
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper function to render booking table row (desktop)
  const renderBookingTableRow = (booking: BookingWithSlot) => {
    const clientType = booking.clientType || clientTypeMap[booking.id];
    const stageLabel = getBookingStageLabel(booking);
    const isDone = stageLabel === 'Done';
    
    return (
      <tr key={booking.id} className="hover:bg-slate-100 transition-colors border-b border-slate-200">
        <td className="px-3 py-3 align-middle">
          <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">{booking.bookingId}</span>
        </td>
        <td className="px-2 py-3 align-middle text-center w-[32px]">
          {(booking.dateChanged || booking.timeChanged) && (
            <span
              className="text-sm inline-block"
              title={booking.validationWarnings?.join('; ') || 'Date or time was changed'}
            >
              ⚠️
            </span>
          )}
        </td>
        <td className="px-3 py-3 align-middle">
          {booking.slot ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-900 whitespace-nowrap">
                  {format(parseISO(booking.slot.date), 'MMM d, yyyy')}
                </span>
                {booking.nailTechId && (() => {
                  const tech = nailTechs.find(t => t.id === booking.nailTechId);
                  if (!tech) return null;
                  
                  // Use muted colors similar to Type badges - assign colors based on tech index
                  const techIds = nailTechs.sort((a, b) => a.name.localeCompare(b.name)).map(t => t.id);
                  const techIndex = techIds.indexOf(tech.id);
                  const mutedColors = [
                    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
                    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
                    { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
                    { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
                    { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
                    { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
                    { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
                    { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
                  ];
                  const color = mutedColors[techIndex % mutedColors.length];
                  
                  return (
                    <span
                      className={`inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-semibold border ${color.bg} ${color.text} ${color.border}`}
                    >
                      Ms. {tech.name}
                    </span>
                  );
                })()}
              </div>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {getTimeRange(booking)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">N/A</span>
          )}
        </td>
        <td className="px-3 py-3 align-middle">
          <span className="text-xs text-slate-700 truncate block max-w-full">{getCustomerName(booking)}</span>
        </td>
        <td className="px-3 py-3 align-middle">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-700 whitespace-nowrap">
              {booking.serviceType ? serviceLabels[booking.serviceType] || booking.serviceType : 'N/A'}
            </span>
            {booking.serviceLocation && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                  booking.serviceLocation === 'homebased_studio'
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-teal-100 text-teal-800'
                }`}
                title={booking.serviceLocation === 'homebased_studio' ? 'Studio St' : 'Home Service'}
              >
                {booking.serviceLocation === 'homebased_studio' ? 'ST' : 'HS'}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 align-middle">
          <span className="text-xs text-slate-600 whitespace-nowrap">{getCustomerPhone(booking)}</span>
        </td>
        <td className="px-3 py-3 align-middle">
          {clientType ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                clientType === 'repeat'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {clientType === 'repeat' ? 'Repeat' : 'New'}
            </span>
          ) : (
            <span className="text-xs text-slate-400">N/A</span>
          )}
        </td>
        <td className="px-3 py-3 align-middle">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
              statusColors[booking.status] || 'bg-gray-100 text-gray-800 border-gray-200'
            }`}
          >
            {stageLabel}
          </span>
        </td>
        <td className="px-1 py-3 whitespace-nowrap text-center align-middle w-full">
          <div className="flex justify-center items-center w-full">
            {!isDone && (
              <>
                {(onMakeQuotation || onReschedule || onCancel || (booking.customerData && Object.keys(booking.customerData).length > 0)) && (
                  <div
                    className="relative"
                    ref={(el: HTMLDivElement | null) => {
                      dropdownRefs.current[`desktop-${booking.id}`] = el;
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const button = e.currentTarget;
                        const rect = button.getBoundingClientRect();
                        if (openDropdownId === `desktop-${booking.id}`) {
                          setOpenDropdownId(null);
                          setDropdownPosition(null);
                        } else {
                          setOpenDropdownId(`desktop-${booking.id}`);
                          setDropdownPosition({
                            top: rect.bottom + 4,
                            right: window.innerWidth - rect.right,
                          });
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-full border-2 border-slate-300 bg-white px-1.5 py-1 text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 min-w-[32px]"
                      aria-label="Actions menu"
                    >
                      <IoEllipsisVertical className="w-4 h-4 flex-shrink-0" />
                    </button>
                    {openDropdownId === `desktop-${booking.id}` && dropdownPosition && typeof window !== 'undefined' && createPortal(
                      <div 
                        className="dropdown-menu fixed w-40 rounded-lg border border-slate-200 bg-white shadow-2xl z-[9999]"
                        style={{
                          top: `${Math.min(window.innerHeight - 150, dropdownPosition.top)}px`,
                          right: `${Math.max(20, dropdownPosition.right)}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          {booking.customerData && Object.keys(booking.customerData).length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setResponseModalBooking(booking);
                                setOpenDropdownId(null);
                                setDropdownPosition(null);
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <IoEyeOutline className="w-4 h-4" />
                              View Response
                            </button>
                          )}
                          {onMakeQuotation && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMakeQuotation(booking.id);
                                setOpenDropdownId(null);
                                setDropdownPosition(null);
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <IoDocumentTextOutline className="w-4 h-4 text-rose-600" />
                              {booking.invoice ? 'Requote' : 'Quotation'}
                            </button>
                          )}
                          {onReschedule && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onReschedule(booking.id);
                                setOpenDropdownId(null);
                                setDropdownPosition(null);
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <IoCalendarOutline className="w-4 h-4" />
                              Reschedule
                            </button>
                          )}
                          {onSplitReschedule && (booking.serviceType === 'mani_pedi' || (booking.linkedSlotIds && booking.linkedSlotIds.length > 0)) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSplitReschedule(booking.id);
                                setOpenDropdownId(null);
                                setDropdownPosition(null);
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-purple-700 hover:bg-purple-50 flex items-center gap-2"
                            >
                              <IoRefreshOutline className="w-4 h-4" />
                              Split Reschedule
                            </button>
                          )}
                          {onUpdatePayment && booking.invoice && (() => {
                            const { balance } = getFinanceSummary(booking);
                            const isAwaitingPayment = (booking.paymentStatus === 'unpaid' || booking.paymentStatus === 'partial') && balance > 0;
                            return isAwaitingPayment ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBookingForPayment(booking);
                                  setPaymentModalOpen(true);
                                  setOpenDropdownId(null);
                                  setDropdownPosition(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                              >
                                <IoCashOutline className="w-4 h-4" />
                                Update Payment
                              </button>
                            ) : null;
                          })()}
                          {booking.status !== 'cancelled' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBookingForServiceChange(booking);
                                setServiceTypeModalOpen(true);
                                setOpenDropdownId(null);
                                setDropdownPosition(null);
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <IoSparkles className="w-4 h-4" />
                              Change Service
                            </button>
                          )}
                          {onCancel && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCancel(booking.id);
                                setOpenDropdownId(null);
                                setDropdownPosition(null);
                              }}
                              className="w-full text-left px-4 py-2 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2"
                            >
                              <IoCloseCircleOutline className="w-4 h-4" />
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
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
        <div className="flex flex-wrap gap-3 items-start sm:items-center">
          {/* Filter field selector */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] sm:text-xs text-slate-500 font-medium">Field:</label>
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
                  setStatusFilter('all');
                }
                if (value !== 'date') {
                  setFilterPeriod('all');
                  setMonthFilter('all');
                }
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
            >
              <option value="status">Status</option>
              {nailTechs.length > 0 && <option value="nailTech">Nail tech</option>}
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
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
            <div className="flex items-center gap-2">
              <label className="text-[11px] sm:text-xs text-slate-500 font-medium">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="all">All statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="done">Done</option>
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
                    setFilterPeriod(e.target.value as FilterPeriod);
                    setMonthFilter('all'); // Reset month filter when changing period
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">Upcoming</option>
                  <option value="month">This month</option>
                </select>
              </div>

              {/* Month filter */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] sm:text-xs text-slate-500">Month:</label>
                <select
                  value={monthFilter}
                  onChange={(e) =>
                    setMonthFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as MonthFilter))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] sm:text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
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
          <div className="md:hidden space-y-3">
            {todayBookings.map((booking) => renderBookingCard(booking, 'border-blue-200', 'bg-blue-50'))}
          </div>

          {/* Tablet & Desktop Table View for Today */}
          <div className="hidden md:block rounded-2xl border-2 border-blue-200 bg-blue-50 shadow-sm overflow-hidden">
            <div className="w-full">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>
                <thead className="bg-blue-100 border-b border-blue-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle">Booking ID</th>
                    <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle w-[32px]"></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle whitespace-nowrap">Date & Time</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle whitespace-nowrap">Customer Name</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle">Service</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle">Contact</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle whitespace-nowrap">Type</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle">Status</th>
                    <th className="px-1 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-200">
                  {todayBookings.map((booking) => renderBookingTableRow(booking))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Bookings Table - Always Visible */}
      {thisWeekBookings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Upcoming Bookings</span>
            <span className="text-sm font-normal text-slate-500">({thisWeekBookings.length})</span>
          </h2>
          
          {/* Mobile Card View for Upcoming */}
          <div className="md:hidden space-y-3">
            {thisWeekBookings.map((booking) => renderBookingCard(booking, 'border-emerald-200', 'bg-emerald-50'))}
          </div>

          {/* Tablet & Desktop Table View for Upcoming */}
          <div className="hidden md:block rounded-2xl border-2 border-emerald-200 bg-emerald-50 shadow-sm overflow-hidden">
            <div className="w-full">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>
                <thead className="bg-emerald-100 border-b border-emerald-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle">Booking ID</th>
                    <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle w-[32px]"></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle whitespace-nowrap">Date & Time</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle whitespace-nowrap">Customer Name</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle">Service</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle">Contact</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle whitespace-nowrap">Type</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle">Status</th>
                    <th className="px-1 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 align-middle"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-200">
                  {thisWeekBookings.map((booking) => renderBookingTableRow(booking))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* All Bookings Table - Show when date filter is 'all' or when filtered */}
      {(filterPeriod === 'all' || monthFilter !== 'all') && filteredBookings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>All Bookings</span>
            <span className="text-sm font-normal text-slate-500">({filteredBookings.length})</span>
          </h2>
          
          {/* Mobile Card View for All Bookings */}
          <div className="md:hidden space-y-3">
            {filteredBookings.map((booking) => renderBookingCard(booking, 'border-slate-300', 'bg-white'))}
          </div>

          {/* Tablet & Desktop Table View for All Bookings */}
          <div className="hidden md:block rounded-2xl border-2 border-slate-300 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
            <div className="w-full">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 align-middle">Booking ID</th>
                    <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 align-middle w-[32px]"></th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 align-middle whitespace-nowrap">Date & Time</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 align-middle whitespace-nowrap">Customer Name</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 align-middle">Service</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 align-middle">Contact</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 align-middle whitespace-nowrap">Type</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 align-middle">Status</th>
                    <th className="px-1 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 align-middle"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {filteredBookings.map((booking) => renderBookingTableRow(booking))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {todayBookings.length === 0 && thisWeekBookings.length === 0 && (filterPeriod !== 'all' && monthFilter === 'all' ? true : filteredBookings.length === 0) && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center text-xs sm:text-sm text-slate-500 shadow-sm">
          No bookings found.
        </div>
      )}


      {/* Form Response Modal */}
      <FormResponseModal
        open={!!responseModalBooking}
        booking={responseModalBooking ?? null}
        onClose={() => setResponseModalBooking(null)}
      />

      {/* Payment Modal for bookings view */}
      {onUpdatePayment && (
        <PaymentModal
          open={paymentModalOpen}
          booking={selectedBookingForPayment}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedBookingForPayment(null);
          }}
          onSubmit={async (amountPaid) => {
            if (!selectedBookingForPayment) return;

            const total = selectedBookingForPayment.invoice?.total || 0;
            const deposit = selectedBookingForPayment.depositAmount || 0;
            const balance = total - deposit;
            const totalPaid = (selectedBookingForPayment.paidAmount || 0) + amountPaid;
            const tipAmount = totalPaid > balance ? totalPaid - balance : 0;
            const paymentStatus = totalPaid >= balance ? 'paid' : 'partial';

            await onUpdatePayment(
              selectedBookingForPayment.id,
              paymentStatus,
              totalPaid,
              tipAmount,
            );

            // Close modal after successful payment update
            setPaymentModalOpen(false);
            setSelectedBookingForPayment(null);
          }}
        />
      )}
      {serviceTypeModalOpen && selectedBookingForServiceChange && (
        <ChangeServiceTypeModal
          open={serviceTypeModalOpen}
          booking={selectedBookingForServiceChange}
          slots={slots}
          onClose={() => {
            setServiceTypeModalOpen(false);
            setSelectedBookingForServiceChange(null);
          }}
          onConfirm={async (newServiceType) => {
            try {
              const response = await fetch(`/api/bookings/${selectedBookingForServiceChange.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'update_service_type',
                  serviceType: newServiceType,
                }),
              });

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update service type');
              }

              if (onServiceTypeChange) {
                onServiceTypeChange();
              }
            } catch (error: any) {
              throw error;
            }
          }}
        />
      )}
    </div>
  );
}

