'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { format, startOfMonth } from 'date-fns';
import type { Booking, Slot, BlockedDate, NailTech } from '@/lib/types';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import { SLOT_TIMES } from '@/lib/constants/slots';
import { formatTime12Hour } from '@/lib/utils';

type SplitRescheduleModalProps = {
  open: boolean;
  booking: Booking | null;
  slots: Slot[];
  blockedDates: BlockedDate[];
  nailTechs: NailTech[];
  onClose: () => void;
  onSplitReschedule: (
    bookingId: string,
    slot1Id: string,
    slot2Id: string,
    nailTech1Id: string,
    nailTech2Id: string
  ) => Promise<void>;
};

export function SplitRescheduleModal({
  open,
  booking,
  slots,
  blockedDates,
  nailTechs,
  onClose,
  onSplitReschedule,
}: SplitRescheduleModalProps) {
  const [selectedDate1, setSelectedDate1] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDate2, setSelectedDate2] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth1, setCurrentMonth1] = useState(() => startOfMonth(new Date()));
  const [currentMonth2, setCurrentMonth2] = useState(() => startOfMonth(new Date()));
  const [selectedSlot1, setSelectedSlot1] = useState<Slot | null>(null);
  const [selectedSlot2, setSelectedSlot2] = useState<Slot | null>(null);
  const [selectedNailTech1, setSelectedNailTech1] = useState<string>('');
  const [selectedNailTech2, setSelectedNailTech2] = useState<string>('');
  const [rescheduling, setRescheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'slot1' | 'slot2'>('slot1');

  useEffect(() => {
    if (open && booking) {
      // Set initial dates to booking's current date
      const bookingSlot = slots.find(s => s.id === booking.slotId);
      if (bookingSlot) {
        setSelectedDate1(bookingSlot.date);
        setSelectedDate2(bookingSlot.date);
        setCurrentMonth1(startOfMonth(new Date(bookingSlot.date)));
        setCurrentMonth2(startOfMonth(new Date(bookingSlot.date)));
      }
      setSelectedSlot1(null);
      setSelectedSlot2(null);
      setSelectedNailTech1('');
      setSelectedNailTech2('');
      setError(null);
      setActiveTab('slot1');
    }
  }, [open, booking, slots]);

  const availableSlotsForDate1 = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return slots.filter(
      (slot) =>
        slot.date === selectedDate1 &&
        slot.status === 'available' &&
        slot.date >= today &&
        !blockedDates.some(
          (block) => slot.date >= block.startDate && slot.date <= block.endDate
        ) &&
        (selectedNailTech1 ? slot.nailTechId === selectedNailTech1 : true)
    );
  }, [slots, selectedDate1, blockedDates, selectedNailTech1]);

  const availableSlotsForDate2 = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return slots.filter(
      (slot) =>
        slot.date === selectedDate2 &&
        slot.status === 'available' &&
        slot.date >= today &&
        !blockedDates.some(
          (block) => slot.date >= block.startDate && slot.date <= block.endDate
        ) &&
        (selectedNailTech2 ? slot.nailTechId === selectedNailTech2 : true) &&
        // Don't show slot2 if it's the same as slot1
        (selectedSlot1 ? slot.id !== selectedSlot1.id : true)
    );
  }, [slots, selectedDate2, blockedDates, selectedNailTech2, selectedSlot1]);

  const handleReschedule = async () => {
    if (!booking || !selectedSlot1 || !selectedSlot2) {
      setError('Please select both slots.');
      return;
    }

    if (!selectedNailTech1 || !selectedNailTech2) {
      setError('Please select nail techs for both slots.');
      return;
    }

    if (selectedSlot1.id === selectedSlot2.id) {
      setError('Please select different slots for Mani and Pedi.');
      return;
    }

    setRescheduling(true);
    setError(null);

    try {
      await onSplitReschedule(
        booking.id,
        selectedSlot1.id,
        selectedSlot2.id,
        selectedNailTech1,
        selectedNailTech2
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to split reschedule booking.');
    } finally {
      setRescheduling(false);
    }
  };

  if (!open || !booking) return null;

  // Only show for mani_pedi bookings or bookings with linked slots
  const isManiPedi = booking.serviceType === 'mani_pedi' || (booking.linkedSlotIds && booking.linkedSlotIds.length > 0);
  if (!isManiPedi) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-6xl bg-white rounded-2xl sm:rounded-3xl shadow-xl my-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold">Split Reschedule Booking</h2>
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
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              This will split the booking into 2 separate bookings with separate invoices.
            </p>
          </div>

          {/* Tabs for Slot 1 and Slot 2 */}
          <div className="flex gap-2 mb-4 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('slot1')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'slot1'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Slot 1: Manicure
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('slot2')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'slot2'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Slot 2: Pedicure
            </button>
          </div>

          {/* Slot 1 Configuration */}
          {activeTab === 'slot1' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold mb-2">
                  Select Nail Tech for Manicure:
                </label>
                <select
                  value={selectedNailTech1}
                  onChange={(e) => {
                    setSelectedNailTech1(e.target.value);
                    setSelectedSlot1(null);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="">Select nail tech...</option>
                  {nailTechs.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      Ms. {tech.name} ({tech.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                {/* Calendar */}
                <div>
                  <CalendarGrid
                    referenceDate={currentMonth1}
                    slots={slots}
                    blockedDates={blockedDates}
                    selectedDate={selectedDate1}
                    onSelectDate={setSelectedDate1}
                    onChangeMonth={setCurrentMonth1}
                  />
                </div>

                {/* Available Slots */}
                <div>
                  <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                    Available Slots for {format(new Date(selectedDate1), 'MMM d, yyyy')}
                  </h3>
                  {!selectedNailTech1 ? (
                    <p className="text-xs sm:text-sm text-slate-500">Please select a nail tech first.</p>
                  ) : availableSlotsForDate1.length === 0 ? (
                    <p className="text-xs sm:text-sm text-slate-500">No available slots for this date and nail tech.</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {availableSlotsForDate1.map((slot) => {
                        const isSelected = selectedSlot1?.id === slot.id;
                        const slotNailTech = nailTechs.find(t => t.id === slot.nailTechId);

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => {
                              setSelectedSlot1(slot);
                              setError(null);
                            }}
                            className={`w-full rounded-xl sm:rounded-2xl border-2 p-3 sm:p-4 text-left transition-all ${
                              isSelected
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm font-semibold">
                                {formatTime12Hour(slot.time)}
                              </span>
                              {slotNailTech && (
                                <span className="text-[10px] text-slate-500">
                                  Ms. {slotNailTech.name}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {selectedSlot1 && (
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <p className="text-xs sm:text-sm font-semibold text-emerald-900">
                    Selected: {format(new Date(selectedSlot1.date), 'MMM d, yyyy')} at {formatTime12Hour(selectedSlot1.time)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Slot 2 Configuration */}
          {activeTab === 'slot2' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold mb-2">
                  Select Nail Tech for Pedicure:
                </label>
                <select
                  value={selectedNailTech2}
                  onChange={(e) => {
                    setSelectedNailTech2(e.target.value);
                    setSelectedSlot2(null);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="">Select nail tech...</option>
                  {nailTechs.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      Ms. {tech.name} ({tech.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                {/* Calendar */}
                <div>
                  <CalendarGrid
                    referenceDate={currentMonth2}
                    slots={slots}
                    blockedDates={blockedDates}
                    selectedDate={selectedDate2}
                    onSelectDate={setSelectedDate2}
                    onChangeMonth={setCurrentMonth2}
                  />
                </div>

                {/* Available Slots */}
                <div>
                  <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">
                    Available Slots for {format(new Date(selectedDate2), 'MMM d, yyyy')}
                  </h3>
                  {!selectedNailTech2 ? (
                    <p className="text-xs sm:text-sm text-slate-500">Please select a nail tech first.</p>
                  ) : availableSlotsForDate2.length === 0 ? (
                    <p className="text-xs sm:text-sm text-slate-500">No available slots for this date and nail tech.</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {availableSlotsForDate2.map((slot) => {
                        const isSelected = selectedSlot2?.id === slot.id;
                        const slotNailTech = nailTechs.find(t => t.id === slot.nailTechId);

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => {
                              setSelectedSlot2(slot);
                              setError(null);
                            }}
                            className={`w-full rounded-xl sm:rounded-2xl border-2 p-3 sm:p-4 text-left transition-all ${
                              isSelected
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm font-semibold">
                                {formatTime12Hour(slot.time)}
                              </span>
                              {slotNailTech && (
                                <span className="text-[10px] text-slate-500">
                                  Ms. {slotNailTech.name}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {selectedSlot2 && (
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <p className="text-xs sm:text-sm font-semibold text-emerald-900">
                    Selected: {format(new Date(selectedSlot2.date), 'MMM d, yyyy')} at {formatTime12Hour(selectedSlot2.time)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {selectedSlot1 && selectedSlot2 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
              <p className="text-xs sm:text-sm font-semibold text-blue-900 mb-2">Reschedule Summary:</p>
              <div className="space-y-1 text-xs sm:text-sm text-blue-700">
                <p>
                  <strong>Manicure:</strong> {format(new Date(selectedSlot1.date), 'MMM d, yyyy')} at {formatTime12Hour(selectedSlot1.time)} 
                  {selectedNailTech1 && ` - ${nailTechs.find(t => t.id === selectedNailTech1)?.name ? `Ms. ${nailTechs.find(t => t.id === selectedNailTech1)!.name}` : 'N/A'}`}
                </p>
                <p>
                  <strong>Pedicure:</strong> {format(new Date(selectedSlot2.date), 'MMM d, yyyy')} at {formatTime12Hour(selectedSlot2.time)}
                  {selectedNailTech2 && ` - ${nailTechs.find(t => t.id === selectedNailTech2)?.name ? `Ms. ${nailTechs.find(t => t.id === selectedNailTech2)!.name}` : 'N/A'}`}
                </p>
              </div>
            </div>
          )}

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
              disabled={!selectedSlot1 || !selectedSlot2 || !selectedNailTech1 || !selectedNailTech2 || rescheduling}
              className="w-full sm:w-auto rounded-full bg-slate-900 px-6 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-50 touch-manipulation"
            >
              {rescheduling ? 'Rescheduling...' : 'Split & Reschedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

