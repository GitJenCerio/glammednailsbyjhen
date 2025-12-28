export type SlotStatus = 'available' | 'blocked' | 'pending' | 'confirmed';
export type BookingStatus = 'pending_form' | 'pending_payment' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export type ServiceType = 'manicure' | 'pedicure' | 'mani_pedi' | 'home_service_2slots' | 'home_service_3slots';

export interface QuoteItem {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
}

export interface Invoice {
  items: QuoteItem[];
  total: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Slot {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: SlotStatus;
  slotType?: 'regular' | 'with_squeeze_fee' | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedDate {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string | null;
  scope: 'single' | 'range' | 'month';
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  socialMediaName?: string; // FB name / Instagram name
  referralSource?: string; // How did you find out about glammednails
  isRepeatClient?: boolean; // Mark customers imported from old sheets as repeat clients
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  slotId: string;
  pairedSlotId?: string | null;
  linkedSlotIds?: string[];
  bookingId: string;
  customerId: string; // Required: every booking must have a customer
  nailTechId?: string; // Optional: link booking to a nail tech
  status: BookingStatus;
  serviceType?: ServiceType;
  clientType?: 'new' | 'repeat';
  serviceLocation?: 'homebased_studio' | 'home_service';
  // Assistant / commission (e.g. sister who helped with the booking)
  assistantName?: string; // e.g. 'Sister'
  assistantCommissionRate?: number; // e.g. 0.1 for 10%
  customerData?: Record<string, string>; // Keep for backward compatibility and form data
  customerDataOrder?: string[]; // Preserves the exact order of fields from the form
  formResponseId?: string;
  dateChanged?: boolean;
  timeChanged?: boolean;
  validationWarnings?: string[];
  invoice?: Invoice;
  paymentStatus?: PaymentStatus;
  paidAmount?: number;
  depositAmount?: number;
  tipAmount?: number;
  // Payment date tracking (when payments were actually received)
  depositDate?: string; // ISO date string when deposit was paid
  paidDate?: string; // ISO date string when full/partial payment was made
  tipDate?: string; // ISO date string when tip was received
  // Payment method tracking
  depositPaymentMethod?: 'PNB' | 'CASH' | 'GCASH'; // Payment method for deposit
  paidPaymentMethod?: 'PNB' | 'CASH' | 'GCASH'; // Payment method for total payment
  createdAt: string;
  updatedAt: string;
}

export interface BookingWithSlot extends Booking {
  slot: Slot;
  pairedSlot?: Slot;
  linkedSlots?: Slot[];
}

export interface BookingWithCustomer extends Booking {
  customer?: Customer;
}

export type SlotInput = Omit<Slot, 'id' | 'createdAt' | 'updatedAt'>;
export type BlockedDateInput = Omit<BlockedDate, 'id' | 'createdAt' | 'updatedAt'>;
export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

// Nail Tech Types
export type ServiceLocationAvailability = 'studio_only' | 'home_service_only' | 'both';
export type PricingRuleType = 'base_rate' | 'percentage_modifier';

// Available time slots (matching system slots)
export const NAIL_TECH_TIME_SLOTS = ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] as const;
export type NailTechTimeSlot = (typeof NAIL_TECH_TIME_SLOTS)[number];

export interface DayAvailability {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  enabled: boolean;
  availableSlots: NailTechTimeSlot[]; // Array of time slots available on this day
}

export interface PricingRule {
  type: PricingRuleType;
  value: number; // Base rate amount OR percentage (e.g., 0.3 for 30% off)
}

export interface NailTech {
  id: string;
  fullName: string;
  role?: string; // e.g., 'Senior', 'Junior'
  isActive: boolean;
  serviceLocationAvailability: ServiceLocationAvailability;
  availability: DayAvailability[]; // Array of 7 days (Sunday to Saturday)
  pricingRule?: PricingRule;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type NailTechInput = Omit<NailTech, 'id' | 'createdAt' | 'updatedAt'>;

export type AnalyticsEventType = 'page_view' | 'book_now_click' | 'booking_started' | 'booking_completed';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  page?: string;
  referrer?: string;
  userAgent?: string;
  timestamp: string;
  sessionId?: string;
  bookingId?: string;
  createdAt: string;
}

