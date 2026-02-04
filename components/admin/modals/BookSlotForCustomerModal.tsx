'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Customer, Slot, ServiceType, NailTech, BlockedDate } from '@/lib/types';
import { format, startOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, endOfMonth, isSameMonth, isSameDay } from 'date-fns';
import { IoClose, IoCalendarOutline, IoTimeOutline } from 'react-icons/io5';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import { formatTime12Hour } from '@/lib/utils';
import { SLOT_TIMES, getNextSlotTime } from '@/lib/constants/slots';

type BookSlotForCustomerModalProps = {
  open: boolean;
  customer: Customer | null;
  slots: Slot[];
  blockedDates: BlockedDate[];
  nailTechs: NailTech[];
  selectedNailTechId: string | null;
  onClose: () => void;
  onConfirm: (slotId: string, serviceType: ServiceType, linkedSlotIds: string[], serviceLocation: 'homebased_studio' | 'home_service') => Promise<void>;
};

const serviceLabels: Record<ServiceType, string> = {
  manicure: 'Manicure only (1 slot)',
  pedicure: 'Pedicure only (1 slot)',
  mani_pedi: 'Mani + Pedi (2 slots)',
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

function getRequiredSlotCount(serviceType: ServiceType): number {
  switch (serviceType) {
    case 'mani_pedi':
    case 'home_service_2slots':
      return 2;
    case 'home_service_3slots':
      return 3;
    default:
      return 1;
  }
}

export function BookSlotForCustomerModal({
  open,
  customer,
  slots,
  blockedDates,
  nailTechs,
  selectedNailTechId,
  onClose,
  onConfirm,
}: BookSlotForCustomerModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedService, setSelectedService] = useState<ServiceType>('manicure');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [linkedSlots, setLinkedSlots] = useState<Slot[]>([]);
  const [serviceLocation, setServiceLocation] = useState<'homebased_studio' | 'home_service'>('homebased_studio');
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && customer) {
      // Reset state when modal opens
      setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
      setCurrentMonth(startOfMonth(new Date()));
      setSelectedService('manicure');
      setSelectedSlot(null);
      setLinkedSlots([]);
      setServiceLocation('homebased_studio');
      setError(null);
    }
  }, [open, customer]);

  // Filter slots by selected date and nail tech
  const availableSlotsForDate = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return slots.filter(
      (slot) =>
        slot.date === selectedDate &&
        slot.date >= today &&
        slot.status === 'available' &&
        (!selectedNailTechId || slot.nailTechId === selectedNailTechId) &&
        !blockedDates.some(
          (block) => slot.date >= block.startDate && slot.date <= block.endDate
        )
    );
  }, [slots, selectedDate, selectedNailTechId, blockedDates]);

  // Check if selected slot can accommodate the service
  useEffect(() => {
    if (!selectedSlot) {
      setLinkedSlots([]);
      return;
    }

    const requiredSlots = getRequiredSlotCount(selectedService);
    if (requiredSlots === 1) {
      setLinkedSlots([]);
      return;
    }

    // Get all slots for this date and same nail tech
    const slotsForDate = slots
      .filter((s) => s.date === selectedSlot.date && s.nailTechId === selectedSlot.nailTechId)
      .sort((a, b) => a.time.localeCompare(b.time));

    const collected: Slot[] = [];
    let referenceSlot = selectedSlot;

    for (let step = 1; step < requiredSlots; step += 1) {
      let nextSlot: Slot | null = null;
      let currentCheckTime = referenceSlot.time.trim();

      while (!nextSlot) {
        const nextTime = getNextSlotTime(currentCheckTime);
        if (!nextTime) {
          setError(`This service requires ${requiredSlots} consecutive slots, but there aren't enough slots available after ${formatTime12Hour(selectedSlot.time)}.`);
          setLinkedSlots([]);
          return;
        }

        const normalizedNextTime = nextTime.trim();
        const slotAtTime = slotsForDate.find(
          (candidate) => candidate.time.trim() === normalizedNextTime && candidate.status === 'available'
        );

        if (slotAtTime) {
          const isBlocked = blockedDates.some(
            (block) => slotAtTime.date >= block.startDate && slotAtTime.date <= block.endDate
          );
          if (isBlocked) {
            setError(`This service requires ${requiredSlots} consecutive slots, but the slot at ${formatTime12Hour(nextTime)} is blocked.`);
            setLinkedSlots([]);
            return;
          }
          nextSlot = slotAtTime;
          break;
        }

        currentCheckTime = normalizedNextTime;
      }

      if (!nextSlot) {
        setError(`This service requires ${requiredSlots} consecutive slots, but there aren't enough slots available.`);
        setLinkedSlots([]);
        return;
      }

      collected.push(nextSlot);
      referenceSlot = nextSlot;
    }

    setLinkedSlots(collected);
    setError(null);
  }, [selectedSlot, selectedService, slots, blockedDates]);

  const handleSelectSlot = (slot: Slot) => {
    if (slot.status !== 'available') return;
    setSelectedSlot(slot);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !customer) return;

    const requiredSlots = getRequiredSlotCount(selectedService);
    if (requiredSlots > 1 && linkedSlots.length !== requiredSlots - 1) {
      setError(`This service requires ${requiredSlots} consecutive slots. Please select a different time.`);
      return;
    }

    setIsBooking(true);
    setError(null);

    try {
      const linkedSlotIds = linkedSlots.map((slot) => slot.id);
      await onConfirm(selectedSlot.id, selectedService, linkedSlotIds, serviceLocation);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create booking. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  if (!open || !customer) return null;

  const requiredSlots = getRequiredSlotCount(selectedService);
  const canProceed = selectedSlot && (requiredSlots === 1 || linkedSlots.length === requiredSlots - 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-xl shadow-slate-900/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors z-10"
          aria-label="Close"
          type="button"
        >
          <IoClose className="w-6 h-6 text-slate-600" />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-2 pr-10">Book Slot for {customer.name}</h2>
          <p className="text-sm text-slate-600 mb-6">
            Select a date, time, and service to create a booking for this customer.
          </p>

          <div className="space-y-6">
            {/* Service Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Service Location
              </label>
              <select
                value={serviceLocation}
                onChange={(e) => setServiceLocation(e.target.value as 'homebased_studio' | 'home_service')}
                className="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="homebased_studio">Homebased Studio</option>
                <option value="home_service">Home Service (+₱1,000)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Service Type
              </label>
              <select
                value={selectedService}
                onChange={(e) => {
                  setSelectedService(e.target.value as ServiceType);
                  setSelectedSlot(null);
                  setLinkedSlots([]);
                  setError(null);
                }}
                className="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {serviceLocation === 'homebased_studio' ? (
                  <>
                    <option value="manicure">{serviceLabels.manicure}</option>
                    <option value="pedicure">{serviceLabels.pedicure}</option>
                    <option value="mani_pedi">{serviceLabels.mani_pedi}</option>
                  </>
                ) : (
                  <>
                    <option value="mani_pedi">{serviceLabels.mani_pedi}</option>
                    <option value="home_service_2slots">{serviceLabels.home_service_2slots}</option>
                    <option value="home_service_3slots">{serviceLabels.home_service_3slots}</option>
                  </>
                )}
              </select>
            </div>

            {/* Calendar */}
            <div>
              <CalendarGrid
                referenceDate={currentMonth}
                slots={slots.filter((slot) => slot.status === 'available')}
                blockedDates={blockedDates}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onChangeMonth={setCurrentMonth}
                nailTechName={selectedNailTechId ? `Ms. ${nailTechs.find(t => t.id === selectedNailTechId)?.name || ''}` : undefined}
              />
            </div>

            {/* Available Slots */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Available Slots for {format(new Date(selectedDate), 'EEEE, MMM d')}
              </label>
              {availableSlotsForDate.length === 0 ? (
                <p className="text-sm text-slate-500 p-4 border-2 border-dashed border-slate-300 rounded-xl">
                  No available slots for this date. Please select another date.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableSlotsForDate.map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSelectSlot(slot)}
                        className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{formatTime12Hour(slot.time)}</span>
                          {isSelected && <span className="text-xs text-indigo-600 font-medium">Selected</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Slot Info */}
            {selectedSlot && (
              <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4">
                <p className="font-semibold text-indigo-900 mb-2">Selected Booking:</p>
                <p className="text-sm text-indigo-800">
                  <strong>Date:</strong> {format(new Date(selectedSlot.date), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm text-indigo-800">
                  <strong>Time:</strong> {formatTime12Hour(selectedSlot.time)}
                  {linkedSlots.length > 0 && (
                    <>
                      {' → '}
                      {linkedSlots.map((s) => formatTime12Hour(s.time)).join(' → ')}
                    </>
                  )}
                </p>
                <p className="text-sm text-indigo-800">
                  <strong>Service:</strong> {serviceLabels[selectedService]}
                </p>
                {requiredSlots > 1 && (
                  <p className="text-xs text-indigo-700 mt-2">
                    This booking will use {requiredSlots} consecutive time slots.
                  </p>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4">
                <p className="text-sm text-rose-800">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isBooking}
                className="px-4 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canProceed || isBooking}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isBooking ? 'Creating Booking...' : 'Create Booking'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

