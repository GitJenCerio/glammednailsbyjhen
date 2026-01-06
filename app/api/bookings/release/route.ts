import { NextResponse } from 'next/server';
import { getEligibleBookingsForRelease, manuallyReleaseBookings } from '@/lib/services/bookingService';
import { listSlots } from '@/lib/services/slotService';
import type { BookingWithSlot, Slot } from '@/lib/types';

/**
 * GET: Get bookings eligible for manual release
 * Returns bookings that are 2+ hours old, pending_form status, and no form synced
 * Includes slot information for display
 */
export async function GET() {
  try {
    const eligibleBookings = await getEligibleBookingsForRelease();
    const slots = await listSlots();
    
    // Enrich bookings with slot information
    const bookingsWithSlots: BookingWithSlot[] = eligibleBookings
      .map(booking => {
        const slot = slots.find(s => s.id === booking.slotId);
        if (!slot) {
          // If slot not found, skip this booking (shouldn't happen but handle gracefully)
          // Return null to filter it out
          return null;
        }
        
        const linkedSlots = (booking.linkedSlotIds || [])
          .map(id => slots.find(s => s.id === id))
          .filter((s): s is Slot => s !== undefined);
        
        const result: BookingWithSlot = {
          ...booking,
          slot,
          linkedSlots: linkedSlots.length > 0 ? linkedSlots : undefined,
          pairedSlot: linkedSlots[0],
        };
        
        return result;
      })
      .filter((booking): booking is BookingWithSlot => booking !== null);
    
    return NextResponse.json({ bookings: bookingsWithSlots });
  } catch (error: any) {
    console.error('Error getting eligible bookings:', error);
    return NextResponse.json({ error: error.message ?? 'Failed to get eligible bookings' }, { status: 500 });
  }
}

/**
 * POST: Manually release selected bookings
 * Body: { bookingIds: string[] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingIds } = body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return NextResponse.json({ error: 'bookingIds array is required' }, { status: 400 });
    }

    const result = await manuallyReleaseBookings(bookingIds);
    return NextResponse.json({ 
      success: true, 
      released: result.released,
      message: `Released ${result.released} booking(s)` 
    });
  } catch (error: any) {
    console.error('Error releasing bookings:', error);
    return NextResponse.json({ error: error.message ?? 'Failed to release bookings' }, { status: 500 });
  }
}

