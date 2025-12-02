'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, isSameMonth, isSameDay } from 'date-fns';
import type { Booking, Slot, BlockedDate } from '@/lib/types';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import { SlotCard } from '@/components/admin/SlotCard';
import { SLOT_TIMES } from '@/lib/constants/slots';
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
    if (serviceType === 'home_service_2slots') return 2;
    if (serviceType === 'home_service_3slots') return 3;
    return 1;
  };

  const canSlotAccommodateService = useCallback((slot: Slot, requiredSlots: number): boolean => {
    if (requiredSlots === 1) return true;

    const slotTimes = SLOT_TIMES;
    const currentIndex = slotTimes.indexOf(slot.time as any);
    if (currentIndex === -1) return false;

    let foundSlots = [slot];
    let currentSlotIndex = currentIndex;

    for (let i = 1; i < requiredSlots; i++) {
      currentSlotIndex++;
      if (currentSlotIndex >= slotTimes.length) return false;

      const nextTime = slotTimes[currentSlotIndex];
      const nextSlot = slots.find(
        (s) => s.date === slot.date && s.time === nextTime
      );

      if (!nextSlot) {
        // Slot time doesn't exist - skip it and continue
        continue;
      }

      if (nextSlot.status !== 'available') {
        return false; // Slot is booked or blocked
      }

      if (blockedDates.some(
        (block) => nextSlot.date >= block.startDate && nextSlot.date <= block.endDate
      )) {
        return false; // Slot is in a blocked date range
      }

      foundSlots.push(nextSlot);
    }

    return foundSlots.length === requiredSlots;
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

    const slotTimes = SLOT_TIMES;
    const currentIndex = slotTimes.indexOf(selectedSlot.time as any);
    const linked: Slot[] = [];
    let currentSlotIndex = currentIndex;

    for (let i = 1; i < requiredSlots; i++) {
      currentSlotIndex++;
      if (currentSlotIndex < slotTimes.length) {
        const nextTime = slotTimes[currentSlotIndex];
        const nextSlot = slots.find(
          (s) => s.date === selectedSlot.date && s.time === nextTime && s.status === 'available'
        );
        if (nextSlot) {
          linked.push(nextSlot);
        }
      }
    }

    setLinkedSlots(linked);
    setError(null);
  }, [selectedSlot, booking, slots, blockedDates, canSlotAccommodateService]);

  const handleReschedule = async () => {
    if (!booking || !selectedSlot) return;

    setRescheduling(true);
    setError(null);

    try {
      const requiredSlots = getRequiredSlotCount(booking.serviceType);
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

              {selectedSlot && linkedSlots.length > 0 && (
                <div className="mt-4 p-3 bg-emerald-50 rounded-xl">
                  <p className="text-xs sm:text-sm font-semibold text-emerald-900 mb-2">
                    Selected Time Range:
                  </p>
                  <p className="text-xs sm:text-sm text-emerald-700">
                    {formatTime12Hour(selectedSlot.time)} - {formatTime12Hour(linkedSlots[linkedSlots.length - 1].time)}
                  </p>
                </div>
              )}
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
              disabled={!selectedSlot || rescheduling}
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

