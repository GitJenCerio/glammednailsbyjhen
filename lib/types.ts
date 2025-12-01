export type SlotStatus = 'available' | 'blocked' | 'pending' | 'confirmed';
export type BookingStatus = 'pending_form' | 'pending_payment' | 'confirmed';
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

export interface Booking {
  id: string;
  slotId: string;
  pairedSlotId?: string | null;
  linkedSlotIds?: string[];
  bookingId: string;
  status: BookingStatus;
  serviceType?: ServiceType;
  clientType?: 'new' | 'repeat';
  serviceLocation?: 'homebased_studio' | 'home_service';
  customerData?: Record<string, string>;
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

export type SlotInput = Omit<Slot, 'id' | 'createdAt' | 'updatedAt'>;
export type BlockedDateInput = Omit<BlockedDate, 'id' | 'createdAt' | 'updatedAt'>;

