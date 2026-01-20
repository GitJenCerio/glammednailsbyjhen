import { NextResponse } from 'next/server';
import { listBookings } from '@/lib/services/bookingService';
import { getSlotById, getSlotsByDate } from '@/lib/services/slotService';
import { listBlockedDates } from '@/lib/services/blockService';
import { listSlots } from '@/lib/services/slotService';

// Prevent caching in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    const [bookings, allSlots, blocks] = await Promise.all([
      listBookings(),
      listSlots(),
      listBlockedDates(),
    ]);

    // Find confirmed bookings with missing slots
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
    const existingSlotIds = new Set(allSlots.map(s => s.id));
    
    const bookingsWithMissingSlots = confirmedBookings.filter(
      booking => !existingSlotIds.has(booking.slotId)
    );

    const restoredSlots: any[] = [];
    const failedSlots: any[] = [];

    for (const booking of bookingsWithMissingSlots) {
      try {
        // Try to fetch the slot directly from Firebase by ID
        let existingSlot = await getSlotById(booking.slotId);
        
        if (existingSlot) {
          // Slot exists in Firebase but wasn't in the list - restored successfully
          restoredSlots.push({
            slotId: booking.slotId,
            bookingId: booking.bookingId,
            action: 'found',
            slot: existingSlot,
          });
        } else {
          // Slot doesn't exist in Firebase - try to find it or create it
          // First, try to find linked slots to infer date/time
          let inferredDate: string | null = null;
          let inferredTime: string | null = null;
          const linkedSlotIds = booking.linkedSlotIds || [];
          
          // Try to find linked slots to infer date/time
          const linkedSlotsFound: any[] = [];
          for (const linkedId of linkedSlotIds) {
            try {
              const linkedSlot = await getSlotById(linkedId);
              if (linkedSlot) {
                linkedSlotsFound.push(linkedSlot);
                if (!inferredDate) {
                  inferredDate = linkedSlot.date;
                }
              }
            } catch (e) {
              // Continue to next linked slot
            }
          }
          
          // If we found linked slots, infer the primary slot time
          if (inferredDate && linkedSlotsFound.length > 0) {
            // Sort linked slots by time to find the earliest one
            linkedSlotsFound.sort((a, b) => a.time.localeCompare(b.time));
            const earliestLinkedSlot = linkedSlotsFound[0];
            
            // The primary slot is usually before the first linked slot
            // Try to get the previous time slot
            const { getPreviousSlotTime } = await import('@/lib/constants/slots');
            if (earliestLinkedSlot.time) {
              const prevTime = getPreviousSlotTime(earliestLinkedSlot.time);
              if (prevTime) {
                inferredTime = prevTime;
              } else {
                // If no previous time, use the same time as earliest linked slot
                inferredTime = earliestLinkedSlot.time;
              }
            }
          } else {
            // No linked slots found - check if there are any confirmed slots on the same day
            // for this nail tech that might help us infer the date
            // Try searching for confirmed slots by date around the booking creation date
            if (booking.createdAt && booking.nailTechId) {
              const createdDate = new Date(booking.createdAt);
              const dateStr = createdDate.toISOString().split('T')[0];
              
              // Check if there are slots on this date for this nail tech
              try {
                const slotsOnDate = await getSlotsByDate(dateStr, booking.nailTechId);
                const confirmedSlotsOnDate = slotsOnDate.filter(s => s.status === 'confirmed');
                
                if (confirmedSlotsOnDate.length > 0) {
                  // Use the date from found slots and try to infer time
                  inferredDate = dateStr;
                  // Use the earliest time from confirmed slots as a starting point
                  confirmedSlotsOnDate.sort((a, b) => a.time.localeCompare(b.time));
                  inferredTime = confirmedSlotsOnDate[0].time;
                }
              } catch (e) {
                // Continue
              }
            }
          }
          
          // If we have date/time (from linked slots or inferred), create the missing slot
          if (inferredDate && inferredTime && booking.nailTechId) {
            try {
              // Create slot with the exact ID that the booking references
              const { adminDb } = await import('@/lib/firebaseAdmin');
              const slotRef = adminDb.collection('slots').doc(booking.slotId);
              
              // Check if slot already exists (might have been created by another process)
              const slotDoc = await slotRef.get();
              if (slotDoc.exists) {
                // Slot was just created - fetch it
                existingSlot = await getSlotById(booking.slotId);
              } else {
                // Create new slot with the inferred date/time
                const slotData = {
                  date: inferredDate,
                  time: inferredTime,
                  status: 'confirmed' as const, // Confirmed booking means confirmed slot
                  nailTechId: booking.nailTechId,
                  createdAt: booking.createdAt || new Date().toISOString(),
                  updatedAt: booking.updatedAt || new Date().toISOString(),
                };
                
                await slotRef.set(slotData);
                existingSlot = await getSlotById(booking.slotId);
              }
              
              if (existingSlot) {
                restoredSlots.push({
                  slotId: booking.slotId,
                  bookingId: booking.bookingId,
                  action: slotDoc.exists ? 'found' : 'created',
                  slot: existingSlot,
                });
                console.log(`✅ ${slotDoc.exists ? 'Found' : 'Created'} slot ${booking.slotId} (${inferredDate} ${inferredTime}) for confirmed booking ${booking.bookingId}`);
              }
            } catch (createError: any) {
              failedSlots.push({
                slotId: booking.slotId,
                bookingId: booking.bookingId,
                reason: `Failed to create slot: ${createError.message || 'Unknown error'}`,
              });
            }
          } else {
            // Cannot create without date/time
            failedSlots.push({
              slotId: booking.slotId,
              bookingId: booking.bookingId,
              reason: `Cannot create slot - no date/time available. Linked slots: ${linkedSlotIds.length > 0 ? linkedSlotIds.join(', ') : 'none'}. Booking created: ${booking.createdAt || 'unknown'}`,
            });
          }
        }
      } catch (error: any) {
        failedSlots.push({
          slotId: booking.slotId,
          bookingId: booking.bookingId,
          reason: error.message || 'Failed to restore slot',
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalConfirmedBookings: confirmedBookings.length,
      bookingsWithMissingSlots: bookingsWithMissingSlots.length,
      restored: restoredSlots.length,
      failed: failedSlots.length,
      restoredSlots,
      failedSlots,
    });
  } catch (error: any) {
    console.error('Error restoring slots:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restore slots' },
      { status: 500 }
    );
  }
}

