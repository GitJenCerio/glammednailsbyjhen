import { listBookings } from '../lib/services/bookingService';
import { listSlots, getSlotById, getSlotsByDate } from '../lib/services/slotService';
import { getPreviousSlotTime } from '../lib/constants/slots';
import { adminDb } from '../lib/firebaseAdmin';

async function restoreSlots() {
  const bookings = await listBookings();
  const allSlots = await listSlots();

  const statusCounts = bookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {});

  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const existingSlotIds = new Set(allSlots.map((s) => s.id));

  const bookingsWithMissingSlots = confirmedBookings.filter(
    (booking) => !existingSlotIds.has(booking.slotId)
  );

  const restoredSlots: any[] = [];
  const failedSlots: any[] = [];

  for (const booking of bookingsWithMissingSlots) {
    try {
      let existingSlot = await getSlotById(booking.slotId);

      if (existingSlot) {
        restoredSlots.push({
          slotId: booking.slotId,
          bookingId: booking.bookingId,
          action: 'found',
          slot: existingSlot,
        });
        continue;
      }

      let inferredDate: string | null = null;
      let inferredTime: string | null = null;
      const linkedSlotIds = booking.linkedSlotIds || [];

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
        } catch {
          // Continue to next linked slot
        }
      }

      if (inferredDate && linkedSlotsFound.length > 0) {
        linkedSlotsFound.sort((a, b) => a.time.localeCompare(b.time));
        const earliestLinkedSlot = linkedSlotsFound[0];
        if (earliestLinkedSlot.time) {
          const prevTime = getPreviousSlotTime(earliestLinkedSlot.time);
          inferredTime = prevTime || earliestLinkedSlot.time;
        }
      } else if (booking.createdAt && booking.nailTechId) {
        const createdDate = new Date(booking.createdAt);
        const dateStr = createdDate.toISOString().split('T')[0];
        try {
          const slotsOnDate = await getSlotsByDate(dateStr, booking.nailTechId);
          const confirmedSlotsOnDate = slotsOnDate.filter((s) => s.status === 'confirmed');
          if (confirmedSlotsOnDate.length > 0) {
            inferredDate = dateStr;
            confirmedSlotsOnDate.sort((a, b) => a.time.localeCompare(b.time));
            inferredTime = confirmedSlotsOnDate[0].time;
          }
        } catch {
          // Continue
        }
      }

      if (inferredDate && inferredTime && booking.nailTechId) {
        const slotRef = adminDb.collection('slots').doc(booking.slotId);
        const slotDoc = await slotRef.get();

        if (slotDoc.exists) {
          existingSlot = await getSlotById(booking.slotId);
        } else {
          const slotData = {
            date: inferredDate,
            time: inferredTime,
            status: 'confirmed' as const,
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
        }
      } else {
        failedSlots.push({
          slotId: booking.slotId,
          bookingId: booking.bookingId,
          reason: `Cannot create slot - no date/time available. Linked slots: ${
            linkedSlotIds.length > 0 ? linkedSlotIds.join(', ') : 'none'
          }. Booking created: ${booking.createdAt || 'unknown'}`,
        });
      }
    } catch (error: any) {
      failedSlots.push({
        slotId: booking.slotId,
        bookingId: booking.bookingId,
        reason: error.message || 'Failed to restore slot',
      });
    }
  }

  return {
    totalBookings: bookings.length,
    bookingStatusCounts: statusCounts,
    totalConfirmedBookings: confirmedBookings.length,
    bookingsWithMissingSlots: bookingsWithMissingSlots.length,
    restored: restoredSlots.length,
    failed: failedSlots.length,
    restoredSlots,
    failedSlots,
  };
}

restoreSlots()
  .then((result) => {
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error restoring slots:', error);
    process.exit(1);
  });
