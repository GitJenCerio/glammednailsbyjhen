export interface Slot {
  id: string;
  date: string; // ISO date string
  time: string; // e.g., "09:00"
  service: string;
  available: boolean;
  createdAt?: Date;
}

export interface Booking {
  id: string;
  name: string;
  contact: string;
  service: string;
  date: string; // ISO date string
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  formLink?: string;
  bookingId?: string; // Unique booking ID for tracking
  createdAt?: Date;
}

export interface Service {
  name: string;
  duration: number; // in minutes
}

