import { NextResponse } from 'next/server';
import { getBookingById } from '@/lib/services/bookingService';
import { getSlotById, getSlotsByDate, listSlots } from '@/lib/services/slotService';
import { adminDb } from '@/lib/firebaseAdmin';
import type { Slot } from '@/lib/types';

// Prevent caching in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId } = body;
    
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    // Find booking by bookingId (not document ID)
    const bookings = await import('@/lib/services/bookingService').then(m => m.listBookings());
    const booking = bookings.find(b => b.bookingId === bookingId);
    
    if (!booking) {
      return NextResponse.json({ error: `Booking ${bookingId} not found` }, { status: 404 });
    }

    // Check if slot exists
    let slot = await getSlotById(booking.slotId);
    
    if (slot) {
      return NextResponse.json({
        success: true,
        message: `Slot ${booking.slotId} already exists`,
        booking: booking,
        slot: slot,
      });
    }

    // Slot doesn't exist - try to find date/time from customerData first, then linked slots
    let inferredDate: string | null = null;
    let inferredTime: string | null = null;
    const linkedSlotIds = booking.linkedSlotIds || [];
    
    // FIRST PRIORITY: Check customerData for appointment date (this is the actual appointment date)
    if (booking.customerData) {
      // Try various possible field names for appointment date
      const appointmentDateField = 
        booking.customerData['Appointment Date (Autofill)'] ||
        booking.customerData['Appointment Date'] ||
        booking.customerData['appointment date'] ||
        booking.customerData['AppointmentDate'] ||
        booking.customerData['Date'] ||
        booking.customerData['date'];
      
      if (appointmentDateField) {
        try {
          // Parse the date - could be in various formats like "Tuesday, January 13, 2026"
          const dateStr = String(appointmentDateField).trim();
          let parsedDate: Date | null = null;
          
          // Try parsing with Date constructor (handles most formats)
          parsedDate = new Date(dateStr);
          
          // If that failed, try parsing manually for format like "Tuesday, January 13, 2026"
          if (isNaN(parsedDate.getTime())) {
            // Try to extract date parts from format like "Tuesday, January 13, 2026"
            const dateMatch = dateStr.match(/(\w+day),\s+(\w+)\s+(\d+),\s+(\d+)/);
            if (dateMatch) {
              const [, , monthName, day, year] = dateMatch;
              const monthMap: Record<string, number> = {
                'January': 0, 'February': 1, 'March': 2, 'April': 3,
                'May': 4, 'June': 5, 'July': 6, 'August': 7,
                'September': 8, 'October': 9, 'November': 10, 'December': 11
              };
              const month = monthMap[monthName] ?? 0;
              parsedDate = new Date(parseInt(year), month, parseInt(day));
            }
          }
          
          // Check if we got a valid date
          if (parsedDate && !isNaN(parsedDate.getTime())) {
            // Format as YYYY-MM-DD
            const year = parsedDate.getFullYear();
            const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const day = String(parsedDate.getDate()).padStart(2, '0');
            inferredDate = `${year}-${month}-${day}`;
          }
        } catch (e) {
          console.warn('Failed to parse appointment date from customerData:', appointmentDateField, e);
        }
      }
      
      // Also check for time in customerData
      const appointmentTimeField =
        booking.customerData['Appointment Time (AutoFill)'] ||
        booking.customerData['Appointment Time (Autofill)'] ||
        booking.customerData['Appointment Time'] ||
        booking.customerData['Time'] ||
        booking.customerData['time'] ||
        booking.customerData['AppointmentTime'];
      
      if (appointmentTimeField && !inferredTime) {
        const timeStr = String(appointmentTimeField).trim();
        // Try to parse time formats like "8:00 AM" or "10:00"
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2];
          const ampm = timeMatch[3]?.toUpperCase();
          
          // Convert 12-hour to 24-hour format
          if (ampm === 'PM' && hours !== 12) {
            hours += 12;
          } else if (ampm === 'AM' && hours === 12) {
            hours = 0;
          }
          
          // Format as HH:MM (24-hour format)
          inferredTime = `${String(hours).padStart(2, '0')}:${minutes}`;
        } else {
          // Try to find just HH:MM pattern
          const simpleTimeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
          if (simpleTimeMatch) {
            inferredTime = simpleTimeMatch[0];
          }
        }
      }
    }
    
    // SECOND PRIORITY: Try to find linked slots to infer date/time if not found in customerData
    const linkedSlotsFound: Slot[] = [];
    
    if (!inferredDate || !inferredTime) {
      // First, try to fetch linked slots directly by ID
      for (const linkedId of linkedSlotIds) {
        try {
          const linkedSlot = await getSlotById(linkedId);
          if (linkedSlot) {
            linkedSlotsFound.push(linkedSlot);
          }
        } catch (e) {
          // Continue to next linked slot
        }
      }
      
      // If linked slots weren't found by ID, search through all slots
      if (linkedSlotsFound.length === 0 && linkedSlotIds.length > 0) {
        try {
          const allSlots = await listSlots();
          for (const linkedId of linkedSlotIds) {
            const foundSlot = allSlots.find(s => s.id === linkedId);
            if (foundSlot) {
              linkedSlotsFound.push(foundSlot);
            }
          }
        } catch (e) {
          console.warn('Failed to list all slots:', e);
        }
      }
      
      // If we found linked slots, use their date/time (if not already found in customerData)
      if (linkedSlotsFound.length > 0) {
        // Sort linked slots by time to find the earliest one
        linkedSlotsFound.sort((a, b) => a.time.localeCompare(b.time));
        const earliestLinkedSlot = linkedSlotsFound[0];
        
        // Use the linked slot's date if we don't have one from customerData
        if (!inferredDate) {
          inferredDate = earliestLinkedSlot.date;
        }
        
        // The primary slot is usually before the first linked slot
        if (!inferredTime) {
          const { getPreviousSlotTime } = await import('@/lib/constants/slots');
          if (earliestLinkedSlot.time) {
            const prevTime = getPreviousSlotTime(earliestLinkedSlot.time);
            if (prevTime) {
              inferredTime = prevTime;
            } else {
              inferredTime = earliestLinkedSlot.time;
            }
          }
        }
      }
    }
    
    // If still no date/time, we cannot create the slot
    if (!inferredDate || !inferredTime) {
      return NextResponse.json({
        error: `Cannot create slot - unable to determine appointment date/time. Checked customerData and linked slots (${linkedSlotIds.length > 0 ? linkedSlotIds.join(', ') : 'none'}).`,
        booking: booking,
        linkedSlotIds: linkedSlotIds,
        customerDataKeys: booking.customerData ? Object.keys(booking.customerData) : [],
      }, { status: 400 });
    }
    
    // If we have date/time, create the missing slot
    if (inferredDate && inferredTime && booking.nailTechId) {
      try {
        const slotRef = adminDb.collection('slots').doc(booking.slotId);
        const slotData = {
          date: inferredDate,
          time: inferredTime,
          status: 'confirmed' as const,
          nailTechId: booking.nailTechId,
          createdAt: booking.createdAt || new Date().toISOString(),
          updatedAt: booking.updatedAt || new Date().toISOString(),
        };
        
        await slotRef.set(slotData);
        slot = await getSlotById(booking.slotId);
        
        if (slot) {
          return NextResponse.json({
            success: true,
            message: `Successfully created slot ${booking.slotId} for booking ${bookingId}`,
            booking: booking,
            slot: slot,
            action: 'created',
          });
        }
      } catch (createError: any) {
        return NextResponse.json({
          error: `Failed to create slot: ${createError.message || 'Unknown error'}`,
        }, { status: 500 });
      }
    }
    
    // Cannot create without date/time
    return NextResponse.json({
      error: `Cannot create slot - no date/time available. Linked slots: ${linkedSlotIds.length > 0 ? linkedSlotIds.join(', ') : 'none'}`,
      booking: booking,
      linkedSlotIds: linkedSlotIds,
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('Error recovering booking:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to recover booking' },
      { status: 500 }
    );
  }
}
