/**
 * Booking Cache for bookingId lookups
 * 
 * Caches booking lookups by bookingId to reduce Firestore reads.
 * The bookingId lookup query was called 48,590 times - this cache will
 * dramatically reduce those reads.
 */

interface CachedBooking {
  booking: any;
  timestamp: number;
}

class BookingCache {
  private cache: Map<string, CachedBooking> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes cache
  private readonly MAX_SIZE = 1000; // Max 1000 cached bookings

  get(bookingId: string): any | null {
    const cached = this.cache.get(bookingId);
    
    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(bookingId);
      return null;
    }

    return cached.booking;
  }

  set(bookingId: string, booking: any): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_SIZE) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(bookingId, {
      booking,
      timestamp: Date.now(),
    });
  }

  invalidate(bookingId: string): void {
    this.cache.delete(bookingId);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const bookingCache = new BookingCache();
