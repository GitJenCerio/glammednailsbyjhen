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

