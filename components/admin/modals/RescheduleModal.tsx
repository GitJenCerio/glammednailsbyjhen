'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, isSameMonth, isSameDay } from 'date-fns';
import type { Booking, Slot, BlockedDate } from '@/lib/types';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import { SlotCard } from '@/components/admin/SlotCard';
import { SLOT_TIMES, getNextSlotTime } from '@/lib/constants/slots';
import { formatTime12Hour } from '@/lib/utils';

type RescheduleModalProps = {
  open: boolean;
  booking: Booking | null;
  slots: Slot[];
  blockedDates: BlockedDate[];
  onClose: () => void;
  onReschedule: (bookingId: string, newSlotId: string, linkedSlotIds?: string[]) => Promise<void>;
  onSlotsUpdate?: () => void; // Callback to refresh slots after creation
};

export function RescheduleModal({ open, booking, slots, blockedDates, onReschedule, onClose, onSlotsUpdate }: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null); // For times that don't have slots yet
  const [linkedSlots, setLinkedSlots] = useState<Slot[]>([]);
  const [linkedTimes, setLinkedTimes] = useState<string[]>([]); // For times that don't have slots yet
  const [rescheduling, setRescheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingSlots, setCreatingSlots] = useState(false);

  useEffect(() => {
    if (open && booking) {
      // Set initial date to booking's current date
      const bookingSlot = slots.find(s => s.id === booking.slotId);
      if (bookingSlot) {
        setSelectedDate(bookingSlot.date);
        setCurrentMonth(startOfMonth(new Date(bookingSlot.date)));
      }
      setSelectedSlot(null);
      setSelectedTime(null);
      setLinkedSlots([]);
      setLinkedTimes([]);
      setError(null);
    }
  }, [open, booking, slots]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const isDateBlocked = useMemo(() => {
    return blockedDates.some(
      (block) => selectedDate >= block.startDate && selectedDate <= block.endDate
    );
  }, [selectedDate, blockedDates]);

  const isDateValid = selectedDate >= today && !isDateBlocked;

  const availableSlotsForDate = useMemo(() => {
    if (!isDateValid) return [];
    return slots.filter(
      (slot) =>
        slot.date === selectedDate &&
        slot.status === 'available' &&
        slot.nailTechId === booking?.nailTechId
    );
  }, [slots, selectedDate, booking?.nailTechId, isDateValid]);

  // Get all slots for the selected date (including booked ones) for the same nail tech
  const allSlotsForDate = useMemo(() => {
    if (!isDateValid) return [];
    return slots.filter(
      (slot) =>
        slot.date === selectedDate &&
        slot.nailTechId === booking?.nailTechId
    );
  }, [slots, selectedDate, booking?.nailTechId, isDateValid]);

  // Get all possible time slots for the selected date
  const allTimeSlots = useMemo(() => {
    return SLOT_TIMES.map((time) => {
      const existingSlot = allSlotsForDate.find(
        (slot) => slot.time.trim() === time.trim()
      );
      const isBlocked = isDateBlocked;
      const isAvailable = existingSlot?.status === 'available' && !isBlocked;
      const isBooked = existingSlot && existingSlot.status !== 'available';
      
      return {
        time,
        slot: existingSlot || null,
        exists: !!existingSlot,
        isAvailable,
        isBooked,
        isBlocked,
      };
    });
  }, [allSlotsForDate, isDateBlocked]);

  const getRequiredSlotCount = (serviceType?: string): number => {
    if (serviceType === 'mani_pedi') return 2;
    if (serviceType === 'home_service_2slots') return 2;
    if (serviceType === 'home_service_3slots') return 3;
    return 1;
  };

  const canSlotAccommodateService = useCallback((slot: Slot, requiredSlots: number): boolean => {
    if (requiredSlots === 1) return true;

    // Get all slots for this date and same nail tech, sorted by time
    const slotsForDate = slots
      .filter((s) => s.date === slot.date && s.nailTechId === slot.nailTechId)
      .sort((a, b) => a.time.localeCompare(b.time));

    let referenceSlot = slot;
    // Consecutive means: available slots with no booked/blocked slots in between
    // We skip over slot times that don't exist in the schedule at all
    for (let step = 1; step < requiredSlots; step += 1) {
      let nextSlot: Slot | null = null;
      let currentCheckTime = referenceSlot.time.trim();
      
      // Keep looking for the next available slot in sequence
      while (!nextSlot) {
        const nextTime = getNextSlotTime(currentCheckTime);
        if (!nextTime) {
          // No more slot times in the sequence
          return false;
        }
        
        // Check if a slot exists at this time (normalize time strings for comparison)
        const normalizedNextTime = nextTime.trim();
        const slotAtTime = slotsForDate.find(
          (candidate) => candidate.time.trim() === normalizedNextTime
        );
        
        if (slotAtTime) {
          // Slot exists at this time
          // Check if blocked
          const isBlocked = blockedDates.some(
            (block) => slotAtTime.date >= block.startDate && slotAtTime.date <= block.endDate
          );
          if (isBlocked) {
            // Blocked slot breaks consecutiveness
            return false;
          }
          
          // Check status
          if (slotAtTime.status === 'available') {
            // Found the next available slot - this is consecutive
            nextSlot = slotAtTime;
            break;
          } else {
            // Slot exists but is not available (pending, confirmed, blocked, etc.)
            // This breaks consecutiveness - there's a gap
            return false;
          }
        }
        // Slot doesn't exist at this time - skip it (not a gap, just not created)
        // Continue to next time in sequence
        currentCheckTime = normalizedNextTime;
      }
      
      if (!nextSlot) {
        // Couldn't find the next available slot
        return false;
      }
      referenceSlot = nextSlot;
    }
    return true;
  }, [blockedDates, slots]);

  // Handle slot/time selection and find linked slots
  useEffect(() => {
    if (!booking) return;

    const requiredSlots = getRequiredSlotCount(booking.serviceType);
    const currentTime = selectedSlot?.time || selectedTime;
    
    if (!currentTime) {
      setLinkedSlots([]);
      setLinkedTimes([]);
      return;
    }

    if (requiredSlots === 1) {
      setLinkedSlots([]);
      setLinkedTimes([]);
      return;
    }

    // Find consecutive slots/times
    const linked: Slot[] = [];
    const linkedTimesList: string[] = [];
    let currentCheckTime = currentTime.trim();

    for (let step = 1; step < requiredSlots; step += 1) {
      const nextTime = getNextSlotTime(currentCheckTime);
      if (!nextTime) {
        break;
      }

      const normalizedNextTime = nextTime.trim();
      const existingSlot = allSlotsForDate.find(
        (slot) => slot.time.trim() === normalizedNextTime
      );

      if (existingSlot) {
        // Slot exists - check if it's available
        const isBlocked = blockedDates.some(
          (block) => existingSlot.date >= block.startDate && existingSlot.date <= block.endDate
        );
        
        if (!isBlocked && existingSlot.status === 'available') {
          linked.push(existingSlot);
          currentCheckTime = normalizedNextTime;
        } else {
          // Slot is blocked or booked - can't use it
          break;
        }
      } else {
        // Slot doesn't exist - we can create it
        linkedTimesList.push(normalizedNextTime);
        currentCheckTime = normalizedNextTime;
      }
    }

    setLinkedSlots(linked);
    setLinkedTimes(linkedTimesList);
    setError(null);
  }, [selectedSlot, selectedTime, booking, allSlotsForDate, blockedDates]);

  const createSlotIfNeeded = async (date: string, time: string, nailTechId: string): Promise<Slot> => {
    // Check if slot already exists
    const existingSlot = allSlotsForDate.find(
      (slot) => slot.time.trim() === time.trim()
    );
    
    if (existingSlot) {
      return existingSlot;
    }

    // Create new slot
    const response = await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        time,
        nailTechId,
        status: 'available',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create slot');
    }

    const data = await response.json();
    return data.slot;
  };

  const handleReschedule = async () => {
    if (!booking) return;
    
    const requiredSlots = getRequiredSlotCount(booking.serviceType);
    const currentTime = selectedSlot?.time || selectedTime;
    
    if (!currentTime) {
      setError('Please select a time slot.');
      return;
    }

    // Validate that we have all required consecutive slots/times
    if (requiredSlots > 1) {
      const totalSlots = (selectedSlot ? 1 : 0) + linkedSlots.length;
      const totalTimes = (selectedTime ? 1 : 0) + linkedTimes.length;
      if (totalSlots + totalTimes !== requiredSlots) {
        setError(`This service requires ${requiredSlots} consecutive slots. Please select a time that has ${requiredSlots} consecutive available slots.`);
        return;
      }
    }

    setRescheduling(true);
    setCreatingSlots(true);
    setError(null);

    try {
      const nailTechId = booking.nailTechId || '';
      if (!nailTechId) {
        throw new Error('Nail tech ID is required');
      }

      // Create slots if they don't exist
      let primarySlot: Slot;
      if (selectedSlot) {
        primarySlot = selectedSlot;
      } else if (selectedTime) {
        primarySlot = await createSlotIfNeeded(selectedDate, selectedTime, nailTechId);
      } else {
        throw new Error('No slot or time selected');
      }

      // Create linked slots if needed
      const linkedSlotIds: string[] = [];
      
      // Add existing linked slots
      for (let i = 0; i < linkedSlots.length; i++) {
        linkedSlotIds.push(linkedSlots[i].id);
      }

      // Create new linked slots for times that don't have slots yet
      for (let i = 0; i < linkedTimes.length; i++) {
        const linkedSlot = await createSlotIfNeeded(selectedDate, linkedTimes[i], nailTechId);
        linkedSlotIds.push(linkedSlot.id);
      }

      // Refresh slots to get the latest data (including newly created slots)
      if (onSlotsUpdate) {
        await onSlotsUpdate();
        // Small delay to ensure database consistency
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await onReschedule(booking.id, primarySlot.id, linkedSlotIds.length > 0 ? linkedSlotIds : undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule booking.');
    } finally {
      setRescheduling(false);
      setCreatingSlots(false);
    }
  };

  if (!open || !booking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-xl my-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold">Reschedule Booking</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-slate-50 rounded-xl">
            <p className="text-xs sm:text-sm font-semibold mb-1">Current Booking:</p>
            <p className="text-xs sm:text-sm text-slate-600">
              {booking.bookingId} - {booking.slotId && slots.find(s => s.id === booking.slotId) 
                ? `${format(new Date(slots.find(s => s.id === booking.slotId)!.date), 'MMM d, yyyy')} at ${formatTime12Hour(slots.find(s => s.id === booking.slotId)!.time)}`
                : 'N/A'}
            </p>
            {(() => {
              const requiredSlots = getRequiredSlotCount(booking.serviceType);
              if (requiredSlots > 1) {
                return (
                  <p className="text-xs sm:text-sm text-blue-600 mt-2 font-medium">
                    ℹ️ This booking requires {requiredSlots} consecutive slots. Select a time slot that has {requiredSlots} consecutive available slots from the same nail tech.
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Calendar */}
            <div>
              <CalendarGrid
                referenceDate={currentMonth}
                slots={slots}
                blockedDates={blockedDates}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onChangeMonth={setCurrentMonth}
              />
            </div>

            {/* Time Slots Selection */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                Select Time for {format(new Date(selectedDate), 'MMM d, yyyy')}
              </h3>
              {!isDateValid ? (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs sm:text-sm text-amber-800">
                    {selectedDate < today 
                      ? 'Cannot select a past date.' 
                      : 'This date is blocked or unavailable.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allTimeSlots.map((timeSlot) => {
                      const isSelected = selectedSlot?.id === timeSlot.slot?.id || 
                                       (selectedTime && selectedTime.trim() === timeSlot.time.trim());
                      const requiredSlots = getRequiredSlotCount(booking.serviceType);
                      const canSelect = !timeSlot.isBooked && !timeSlot.isBlocked;
                      
                      // Check if this time can accommodate the service
                      let canAccommodate = canSelect;
                      if (requiredSlots > 1 && canSelect) {
                        // Check if we have enough consecutive slots/times
                        const totalAvailable = (selectedSlot || selectedTime ? 1 : 0) + linkedSlots.length + linkedTimes.length;
                        // We'll validate this on selection
                        canAccommodate = true; // Allow selection, we'll validate in handleReschedule
                      }

                      return (
                        <button
                          key={timeSlot.time}
                          type="button"
                          onClick={() => {
                            if (!canSelect) {
                              setError(timeSlot.isBooked 
                                ? 'This time slot is already booked.' 
                                : 'This time slot is blocked.');
                              return;
                            }

                            if (timeSlot.slot) {
                              setSelectedSlot(timeSlot.slot);
                              setSelectedTime(null);
                            } else {
                              setSelectedTime(timeSlot.time);
                              setSelectedSlot(null);
                            }
                            setError(null);
                          }}
                          disabled={!canSelect}
                          className={`rounded-lg border-2 p-2.5 sm:p-3 text-center transition-all ${
                            isSelected
                              ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                              : canSelect
                                ? 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-md hover:bg-slate-50'
                                : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-50'
                          }`}
                          title={
                            !canSelect 
                              ? (timeSlot.isBooked ? 'Booked' : 'Blocked')
                              : !timeSlot.exists 
                                ? 'Click to create slot'
                                : ''
                          }
                        >
                          <span className="text-xs sm:text-sm font-semibold block">
                            {formatTime12Hour(timeSlot.time)}
                          </span>
                          {!timeSlot.exists && canSelect && (
                            <span className="text-[9px] text-blue-600 mt-1 block font-medium">
                              New
                            </span>
                          )}
                          {timeSlot.isBooked && (
                            <span className="text-[9px] text-rose-600 mt-1 block">
                              Booked
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {((selectedSlot || selectedTime) && (() => {
                const requiredSlots = getRequiredSlotCount(booking.serviceType);
                const currentTime = selectedSlot?.time || selectedTime;
                if (!currentTime) return null;
                const allTimes = [currentTime, ...linkedTimes];
                const allSlots = selectedSlot ? [selectedSlot, ...linkedSlots] : [];
                
                if (requiredSlots > 1 && (allSlots.length + allTimes.length) === requiredSlots) {
                  const lastTime = linkedTimes.length > 0 
                    ? linkedTimes[linkedTimes.length - 1] 
                    : (linkedSlots.length > 0 ? linkedSlots[linkedSlots.length - 1].time : currentTime);
                  
                  return (
                    <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <p className="text-xs sm:text-sm font-semibold text-emerald-900 mb-2">
                        Selected {requiredSlots} Consecutive {requiredSlots === 1 ? 'Slot' : 'Slots'}:
                      </p>
                      <div className="space-y-1">
                        {allTimes.map((time, index) => {
                          if (!time) return null;
                          const slot = allSlots.find(s => s.time.trim() === time.trim());
                          return (
                            <p key={time} className="text-xs sm:text-sm text-emerald-700">
                              {index + 1}. {formatTime12Hour(time)}
                              {!slot && <span className="text-blue-600 ml-1">(will create)</span>}
                            </p>
                          );
                        })}
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-600 mt-2 font-medium">
                        Time Range: {formatTime12Hour(currentTime)} - {formatTime12Hour(lastTime)}
                      </p>
                    </div>
                  );
                }
                return null;
              })())}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 rounded-xl">
              <p className="text-xs sm:text-sm text-rose-600">{error}</p>
            </div>
          )}

          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-full border border-slate-200 px-4 py-2 text-xs sm:text-sm font-semibold hover:border-slate-900 touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReschedule}
              disabled={(!selectedSlot && !selectedTime) || rescheduling || !isDateValid || (() => {
                const requiredSlots = getRequiredSlotCount(booking.serviceType);
                if (requiredSlots > 1) {
                  const totalSlots = (selectedSlot ? 1 : 0) + linkedSlots.length;
                  const totalTimes = (selectedTime ? 1 : 0) + linkedTimes.length;
                  return (totalSlots + totalTimes) !== requiredSlots;
                }
                return false;
              })()}
              className="w-full sm:w-auto rounded-full bg-slate-900 px-6 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-50 touch-manipulation"
            >
              {rescheduling 
                ? (creatingSlots ? 'Creating slots...' : 'Rescheduling...') 
                : 'Reschedule Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

