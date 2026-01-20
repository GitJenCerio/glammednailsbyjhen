import { NextResponse } from 'next/server';
import { getEligibleBookingsForRelease, manuallyReleaseBookings } from '@/lib/services/bookingService';
import { extractCustomerInfo, getCustomerById } from '@/lib/services/customerService';
import { getSlotsByIds } from '@/lib/services/slotService';
import type { BookingWithSlot, Slot } from '@/lib/types';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

/**
 * GET: Get bookings eligible for manual release
 * Returns bookings that are pending_form status and no form synced
 * Includes slot information for display
 */
export async function GET() {
  try {
    const eligibleBookings = await getEligibleBookingsForRelease();

    const customerIdsToFetch = Array.from(new Set(
      eligibleBookings
        .map((booking) => booking.customerId)
        .filter((id) => id && id !== 'PENDING_FORM_SUBMISSION')
    ));
    const customers = await Promise.all(
      customerIdsToFetch.map(async (id) => {
        const customer = await getCustomerById(id);
        return customer ? [id, customer] as const : null;
      })
    );
    const customersById = new Map(customers.filter(Boolean) as Array<readonly [string, any]>);

    // PERF: only fetch the specific slots we need (instead of loading all slots)
    const slotIdsToFetch = eligibleBookings.flatMap((b) => [
      b.slotId,
      ...(b.linkedSlotIds || []),
      ...(b.pairedSlotId ? [b.pairedSlotId] : []),
    ]);
    const slots = await getSlotsByIds(slotIdsToFetch);
    const slotsById = new Map(slots.map((s) => [s.id, s]));
    
    // Enrich bookings with slot information
    const bookingsWithSlots: BookingWithSlot[] = eligibleBookings
      .map(booking => {
        const slot = slotsById.get(booking.slotId);
        if (!slot) {
          // If slot not found, skip this booking (shouldn't happen but handle gracefully)
          // Return null to filter it out
          return null;
        }
        
        const linkedSlots = (booking.linkedSlotIds || [])
          .map((id) => slotsById.get(id))
          .filter((s): s is Slot => !!s);

        const customer = customersById.get(booking.customerId);
        const customerInfoFromData = booking.customerData
          ? extractCustomerInfo(booking.customerData, booking.customerDataOrder)
          : null;
        const customerNameFromData = customerInfoFromData?.name || null;
        const socialMediaFromData = customerInfoFromData?.socialMediaName || null;
        const resolvedCustomerName =
          (customer?.name && customer.name !== 'Unknown Customer' ? customer.name : null) ||
          (customerNameFromData && customerNameFromData !== 'Unknown Customer' ? customerNameFromData : null) ||
          socialMediaFromData;
        
        const result = {
          ...booking,
          slot,
          linkedSlots: linkedSlots.length > 0 ? linkedSlots : undefined,
          pairedSlot: linkedSlots[0],
          customerName: resolvedCustomerName || undefined,
        } as BookingWithSlot & { customerName?: string };
        
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

