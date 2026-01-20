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
};

export function RescheduleModal({ open, booking, slots, blockedDates, onReschedule, onClose }: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [linkedSlots, setLinkedSlots] = useState<Slot[]>([]);
  const [rescheduling, setRescheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && booking) {
      // Set initial date to booking's current date
      const bookingSlot = slots.find(s => s.id === booking.slotId);
      if (bookingSlot) {
        setSelectedDate(bookingSlot.date);
        setCurrentMonth(startOfMonth(new Date(bookingSlot.date)));
      }
      setSelectedSlot(null);
      setLinkedSlots([]);
      setError(null);
    }
  }, [open, booking, slots]);

  const availableSlotsForDate = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return slots.filter(
      (slot) =>
        slot.date === selectedDate &&
        slot.status === 'available' &&
        slot.date >= today &&
        !blockedDates.some(
          (block) => slot.date >= block.startDate && slot.date <= block.endDate
        )
    );
  }, [slots, selectedDate, blockedDates]);

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

  useEffect(() => {
    if (!selectedSlot || !booking) return;

    const requiredSlots = getRequiredSlotCount(booking.serviceType);
    if (requiredSlots === 1) {
      setLinkedSlots([]);
      return;
    }

    if (!canSlotAccommodateService(selectedSlot, requiredSlots)) {
      setError(`This service requires ${requiredSlots} consecutive slots. Please select a different time.`);
      setSelectedSlot(null);
      setLinkedSlots([]);
      return;
    }

    // Get all slots for this date and same nail tech, sorted by time
    const slotsForDate = slots
      .filter((s) => s.date === selectedSlot.date && s.nailTechId === selectedSlot.nailTechId)
      .sort((a, b) => a.time.localeCompare(b.time));

    const linked: Slot[] = [];
    let referenceSlot = selectedSlot;

    for (let step = 1; step < requiredSlots; step += 1) {
      let nextSlot: Slot | null = null;
      let currentCheckTime = referenceSlot.time.trim();
      
      // Keep looking for the next available slot in sequence
      while (!nextSlot) {
        const nextTime = getNextSlotTime(currentCheckTime);
        if (!nextTime) {
          // No more slot times in the sequence
          break;
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
          
          if (!isBlocked && slotAtTime.status === 'available') {
            // Found the next available slot - this is consecutive
            nextSlot = slotAtTime;
            linked.push(nextSlot);
            break;
          } else {
            // Slot is blocked or not available - can't use it
            break;
          }
        }
        // Slot doesn't exist at this time - skip it (not a gap, just not created)
        // Continue to next time in sequence
        currentCheckTime = normalizedNextTime;
      }
      
      if (nextSlot) {
        referenceSlot = nextSlot;
      } else {
        // Couldn't find the next available slot
        break;
      }
    }

    setLinkedSlots(linked);
    setError(null);
  }, [selectedSlot, booking, slots, blockedDates, canSlotAccommodateService]);

  const handleReschedule = async () => {
    if (!booking || !selectedSlot) return;

    const requiredSlots = getRequiredSlotCount(booking.serviceType);
    
    // Validate that we have all required consecutive slots
    if (requiredSlots > 1) {
      const allSelectedSlots = [selectedSlot, ...linkedSlots];
      if (allSelectedSlots.length !== requiredSlots) {
        setError(`This service requires ${requiredSlots} consecutive slots. Please select a slot that has ${requiredSlots} consecutive available slots.`);
        return;
      }
    }

    setRescheduling(true);
    setError(null);

    try {
      const linkedSlotIds = requiredSlots > 1 ? linkedSlots.map(s => s.id) : [];

      await onReschedule(booking.id, selectedSlot.id, linkedSlotIds);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule booking.');
    } finally {
      setRescheduling(false);
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

            {/* Available Slots */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                Available Slots for {format(new Date(selectedDate), 'MMM d, yyyy')}
              </h3>
              {availableSlotsForDate.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-500">No available slots for this date.</p>
              ) : (
                <div className="space-y-2">
                  {availableSlotsForDate.map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    const requiredSlots = getRequiredSlotCount(booking.serviceType);
                    const canAccommodate = canSlotAccommodateService(slot, requiredSlots);

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          if (canAccommodate) {
                            setSelectedSlot(slot);
                            setError(null);
                          } else {
                            setError(`This service requires ${requiredSlots} consecutive slots. This time slot cannot accommodate it.`);
                          }
                        }}
                        disabled={!canAccommodate}
                        className={`w-full rounded-xl sm:rounded-2xl border-2 p-3 sm:p-4 text-left transition-all ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : canAccommodate
                              ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                              : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-semibold">
                            {formatTime12Hour(slot.time)}
                          </span>
                          {!canAccommodate && requiredSlots > 1 && (
                            <span className="text-[10px] text-slate-400">
                              Needs {requiredSlots} slots
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedSlot && (() => {
                const requiredSlots = getRequiredSlotCount(booking.serviceType);
                const allSelectedSlots = [selectedSlot, ...linkedSlots];
                
                if (requiredSlots > 1 && allSelectedSlots.length === requiredSlots) {
                  return (
                    <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <p className="text-xs sm:text-sm font-semibold text-emerald-900 mb-2">
                        Selected {requiredSlots} Consecutive Slots:
                      </p>
                      <div className="space-y-1">
                        {allSelectedSlots.map((slot, index) => (
                          <p key={slot.id} className="text-xs sm:text-sm text-emerald-700">
                            {index + 1}. {formatTime12Hour(slot.time)}
                          </p>
                        ))}
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-600 mt-2 font-medium">
                        Time Range: {formatTime12Hour(selectedSlot.time)} - {formatTime12Hour(linkedSlots[linkedSlots.length - 1].time)}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
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
              disabled={!selectedSlot || rescheduling || (() => {
                const requiredSlots = getRequiredSlotCount(booking.serviceType);
                if (requiredSlots > 1) {
                  return linkedSlots.length !== requiredSlots - 1;
                }
                return false;
              })()}
              className="w-full sm:w-auto rounded-full bg-slate-900 px-6 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-50 touch-manipulation"
            >
              {rescheduling ? 'Rescheduling...' : 'Reschedule Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

