'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import type { Slot, BlockedDate, ServiceType } from '@/lib/types';
import { getNextSlotTime } from '@/lib/constants/slots';
import { formatTime12Hour } from '@/lib/utils';

const SERVICE_OPTIONS: Record<ServiceLocation, { value: ServiceType; label: string }[]> = {
  homebased_studio: [
    { value: 'manicure', label: 'Manicure only (1 slot)' },
    { value: 'pedicure', label: 'Pedicure only (1 slot)' },
    { value: 'mani_pedi', label: 'Mani + Pedi (2 slots)' },
  ],
  home_service: [
    { value: 'mani_pedi', label: 'Mani + Pedi (2 slots)' },
    { value: 'home_service_2slots', label: 'Home Service (2 pax)' },
    { value: 'home_service_3slots', label: 'Home Service (3 pax)' },
  ],
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

type ClientType = 'new' | 'repeat';
type ServiceLocation = 'homebased_studio' | 'home_service';

interface SlotModalProps {
  slot: Slot | null;
  serviceType: ServiceType;
  onServiceChange: (value: ServiceType) => void;
  serviceOptions: { value: ServiceType; label: string }[];
  linkedSlots: Slot[];
  serviceMessage: string | null;
  clientType: ClientType;
  onClientTypeChange: (value: ClientType) => void;
  serviceLocation: ServiceLocation;
  onServiceLocationChange: (value: ServiceLocation) => void;
  squeezeFeeAcknowledged: boolean;
  onSqueezeFeeAcknowledgedChange: (value: boolean) => void;
  disableProceed: boolean;
  onClose: () => void;
  onProceed: () => void;
}

function SlotModal({
  slot,
  serviceType,
  onServiceChange,
  serviceOptions,
  linkedSlots,
  serviceMessage,
  clientType,
  onClientTypeChange,
  serviceLocation,
  onServiceLocationChange,
  squeezeFeeAcknowledged,
  onSqueezeFeeAcknowledgedChange,
  disableProceed,
  onClose,
  onProceed,
}: SlotModalProps) {
  if (!slot) return null;

  const requiredSlots = getRequiredSlotCount(serviceType);
  const requiresMultipleSlots = requiredSlots > 1;
  const missingLinkedSlots = requiresMultipleSlots && linkedSlots.length !== requiredSlots - 1;
  const hasSqueezeFee = slot.slotType === 'with_squeeze_fee';
  const isHomeService = serviceLocation === 'home_service';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-100 border-2 border-slate-300 rounded-lg max-w-md w-full p-4 sm:p-6 md:p-8 shadow-xl shadow-slate-900/20 my-4 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-xl sm:text-2xl font-heading font-semibold mb-3 sm:mb-4">Book This Slot</h3>
        
        <div className="space-y-2.5 sm:space-y-3 mb-4 sm:mb-6">
          <div>
            <span className="text-sm sm:text-base text-gray-600">Date:</span>
            <p className="font-medium text-sm sm:text-base">{format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div>
            <span className="text-sm sm:text-base text-gray-600">Time:</span>
            <p className="font-medium text-sm sm:text-base">{formatTime12Hour(slot.time)}</p>
          </div>
          <div>
            <span className="text-sm sm:text-base text-gray-600">Service Location:</span>
            <select
              value={serviceLocation}
              onChange={(e) => onServiceLocationChange(e.target.value as ServiceLocation)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-sm sm:text-base touch-manipulation"
            >
              <option value="homebased_studio">Homebased Studio</option>
              <option value="home_service">Home Service (+₱1,000)</option>
            </select>
            {isHomeService && (
              <p className="mt-1.5 text-[10px] sm:text-xs text-amber-700">
                ⚠️ Home service bookings require Mani + Pedi or a Home Service package (2 or 3 consecutive slots).
              </p>
            )}
          </div>
          <div>
            <span className="text-sm sm:text-base text-gray-600">Service:</span>
            <select
              value={serviceType}
              onChange={(e) => onServiceChange(e.target.value as ServiceType)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-sm sm:text-base touch-manipulation"
            >
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-sm sm:text-base text-gray-600">Client Type:</span>
            <select
              value={clientType}
              onChange={(e) => onClientTypeChange(e.target.value as ClientType)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-sm sm:text-base touch-manipulation"
            >
              <option value="new">New Client</option>
              <option value="repeat">Repeat Client</option>
            </select>
          </div>
          {requiresMultipleSlots && (
            <div
              className={`rounded-2xl border-2 px-4 py-3 text-sm ${
                missingLinkedSlots
                  ? 'border-rose-400 bg-rose-200 text-rose-800'
                  : 'border-emerald-400 bg-emerald-200 text-emerald-800'
              }`}
            >
              {serviceMessage ? (
                <p>{serviceMessage}</p>
              ) : missingLinkedSlots ? (
                <p>This service requires consecutive slots. Please select a different time or date.</p>
              ) : null}
            </div>
          )}
        </div>

        {hasSqueezeFee && (
          <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border-2 border-purple-400 bg-purple-200 px-3 sm:px-4 py-2.5 sm:py-3">
            <p className="text-xs sm:text-sm font-semibold text-purple-900 mb-2">⚠️ Squeeze-in Fee</p>
            <p className="text-[10px] sm:text-xs text-purple-900 leading-relaxed mb-3">
              This slot has a squeeze-in fee of ₱500. This is an additional charge on top of the regular service fee.
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={squeezeFeeAcknowledged}
                onChange={(e) => onSqueezeFeeAcknowledgedChange(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-2 border-purple-600 text-purple-600 focus:ring-purple-500 focus:ring-2"
              />
              <span className="text-[10px] sm:text-xs text-purple-900 font-medium">
                I understand and agree to pay the ₱500 squeeze-in fee for this slot.
              </span>
            </label>
          </div>
        )}

        <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border-2 border-amber-400 bg-amber-200 px-3 sm:px-4 py-2.5 sm:py-3">
          <p className="text-xs sm:text-sm font-semibold text-amber-900 mb-1">Deposit Required</p>
          <p className="text-[10px] sm:text-xs text-amber-900 leading-relaxed">
            ₱500 deposit upon booking is required to reserve your desired date and time, it is consumable and non-refundable. (NO DEPOSIT, NO APPOINTMENT)
          </p>
        </div>

        <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-600 leading-relaxed">
          This slot is available. Click "Proceed to Booking Form" and you'll be redirected to our Google Form to finish your reservation.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 sm:py-2 border-2 border-black text-black font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation text-sm sm:text-base"
          >
            Close
          </button>
          <button
            onClick={onProceed}
            disabled={disableProceed}
            className="flex-1 px-4 py-3 sm:py-2 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] active:scale-[0.98] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation text-sm sm:text-base"
          >
            Proceed to Booking Form
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function BookingPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedService, setSelectedService] = useState<ServiceType>('manicure');
  const [clientType, setClientType] = useState<ClientType>('new');
  const [serviceLocation, setServiceLocation] = useState<ServiceLocation>('homebased_studio');
  const [linkedSlots, setLinkedSlots] = useState<Slot[]>([]);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [squeezeFeeAcknowledged, setSqueezeFeeAcknowledged] = useState(false);
  const serviceOptions = SERVICE_OPTIONS[serviceLocation];

  useEffect(() => {
    if (!serviceOptions.some((option) => option.value === selectedService)) {
      setSelectedService(serviceOptions[0].value);
    }
  }, [serviceLocation, serviceOptions, selectedService]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/availability');
      const data = await response.json();
      setSlots(data.slots);
      setBlockedDates(data.blockedDates);
    } catch (err) {
      console.error('Error loading availability', err);
      setError('Unable to load availability. Please try again.');
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    if (!selectedSlot) {
      setLinkedSlots([]);
      setServiceMessage(null);
      return;
    }

    const requiredSlots = getRequiredSlotCount(selectedService);
    if (requiredSlots === 1) {
      setLinkedSlots([]);
      setServiceMessage(null);
      return;
    }

    const collected: Slot[] = [];
    let referenceSlot = selectedSlot;
    let errorMessage: string | null = null;

    for (let step = 1; step < requiredSlots; step += 1) {
      const nextTime = getNextSlotTime(referenceSlot.time);
      if (!nextTime) {
        errorMessage = 'This service requires additional consecutive slots, but there are no more later slots available.';
        break;
      }

      const nextSlot =
        slots.find((candidate) => candidate.date === selectedSlot.date && candidate.time === nextTime) ?? null;

      if (!nextSlot) {
        errorMessage = 'This service requires the next slot, but it is not available in the schedule. Please pick another time or date.';
        break;
      }

      if (nextSlot.status !== 'available') {
        errorMessage = 'This service requires consecutive slots, but one of them is already taken. Please select another time or date.';
        break;
      }

      collected.push(nextSlot);
      referenceSlot = nextSlot;
    }

    if (errorMessage) {
      setLinkedSlots([]);
      setServiceMessage(errorMessage);
      return;
    }

    setLinkedSlots(collected);
    const lastSlot = collected[collected.length - 1];
    const serviceLabel =
      serviceOptions.find((option) => option.value === selectedService)?.label ?? 'This service';
    setServiceMessage(
      `${serviceLabel} will use ${formatTime12Hour(selectedSlot.time)}${lastSlot ? ` to ${formatTime12Hour(lastSlot.time)}` : ''}.`,
    );
  }, [selectedSlot, selectedService, slots, serviceOptions]);

  const availableSlotsForDate = useMemo(
    () => slots.filter((slot) => slot.date === selectedDate && slot.status === 'available'),
    [slots, selectedDate],
  );

  const requiredSlots = getRequiredSlotCount(selectedService);
  const hasSqueezeFee = selectedSlot?.slotType === 'with_squeeze_fee';
  const missingLinkedSlots = requiredSlots > 1 && linkedSlots.length !== requiredSlots - 1;
  const disableProceed =
    !selectedSlot ||
    missingLinkedSlots ||
    (hasSqueezeFee && !squeezeFeeAcknowledged);

  const handleSelectSlot = (slot: Slot) => {
    if (slot.status !== 'available') return;
    setSelectedService('manicure');
    setClientType('new');
    setServiceLocation('homebased_studio');
    setLinkedSlots([]);
    setServiceMessage(null);
    setSqueezeFeeAcknowledged(false);
    setSelectedSlot(slot);
  };

  async function handleProceedToBooking() {
    if (!selectedSlot) return;
    const requiredSlots = getRequiredSlotCount(selectedService);
    const linkedSlotIds = linkedSlots.map((slot) => slot.id);

    if (requiredSlots > 1 && linkedSlotIds.length !== requiredSlots - 1) {
      setServiceMessage('This service requires consecutive slots. Please choose another time or date.');
      return;
    }

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          serviceType: selectedService,
          pairedSlotId: linkedSlotIds[0],
          linkedSlotIds,
          clientType,
          serviceLocation,
        }),
      });

      if (!response.ok) {
        throw new Error('Slot is no longer available.');
      }

      const data = await response.json();
      window.location.href = data.googleFormUrl;
      setSelectedSlot(null);
      setSelectedService('manicure');
      setClientType('new');
      setServiceLocation('homebased_studio');
      setLinkedSlots([]);
      setServiceMessage(null);
      setSqueezeFeeAcknowledged(false);
      await loadData();
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('This slot is no longer available. Please pick another slot.');
      await loadData();
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />
      
      <section className="mt-24 sm:mt-28 md:mt-32 lg:mt-36 pt-4 sm:pt-6 md:pt-8 px-4 sm:px-6 pb-8 sm:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          <h1 id="booking-heading" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-acollia text-center mb-3 sm:mb-4 px-2 sm:px-4 text-slate-900 scroll-mt-24 sm:scroll-mt-28">
            Book Your Appointment
          </h1>
          <p className="text-center text-gray-600 mb-6 sm:mb-8 md:mb-12 max-w-2xl mx-auto px-4 text-sm sm:text-base">
            Select an available time slot to proceed with your booking
          </p>

          {loading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr,1fr]">
                <CalendarGrid
                  referenceDate={currentMonth}
                  slots={slots}
                  blockedDates={blockedDates}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onChangeMonth={setCurrentMonth}
                />

                <section className="rounded-2xl sm:rounded-3xl border-2 border-slate-300 bg-slate-100 p-4 sm:p-6 shadow-md shadow-slate-900/10">
                  <header className="mb-3 sm:mb-4">
                    <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-500">Available slots</p>
                    <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-900">
                      {format(new Date(selectedDate), 'EEEE, MMM d')}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Tap a time to reserve it instantly.
                    </p>
                  </header>

                  <div className="space-y-3">
                    {availableSlotsForDate.length === 0 && (
                      <p className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        No available slots for this day. Choose another date on the calendar.
                      </p>
                    )}
                    {availableSlotsForDate.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSelectSlot(slot)}
                        className="w-full rounded-xl sm:rounded-2xl border-2 border-emerald-400 bg-emerald-200 px-3 sm:px-4 py-3 sm:py-3.5 text-left transition-all hover:border-emerald-600 hover:bg-emerald-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500 touch-manipulation"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-700 font-semibold">Available</p>
                          {slot.slotType === 'with_squeeze_fee' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-purple-200 text-purple-900 border border-purple-300">
                              ₱500 Squeeze-in Fee
                            </span>
                          )}
                        </div>
                        <p className="text-base sm:text-lg font-semibold text-emerald-900">{formatTime12Hour(slot.time)}</p>
                        {slot.notes && <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">{slot.notes}</p>}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-600 px-4">
                {error ? (
                  <p className="text-red-600">{error}</p>
                ) : (
                  <p>Green cards are open slots. Pink dates are blocked.</p>
                )}
              </div>
            </>
          )}
        </motion.div>
      </section>

      <SlotModal
        slot={selectedSlot}
        serviceType={selectedService}
        onServiceChange={setSelectedService}
        serviceOptions={serviceOptions}
        linkedSlots={linkedSlots}
        serviceMessage={serviceMessage}
        clientType={clientType}
        onClientTypeChange={setClientType}
        serviceLocation={serviceLocation}
        onServiceLocationChange={setServiceLocation}
        squeezeFeeAcknowledged={squeezeFeeAcknowledged}
        onSqueezeFeeAcknowledgedChange={setSqueezeFeeAcknowledged}
        disableProceed={disableProceed}
        onClose={() => {
          setSelectedSlot(null);
          setSelectedService('manicure');
          setClientType('new');
          setServiceLocation('homebased_studio');
          setLinkedSlots([]);
          setServiceMessage(null);
          setSqueezeFeeAcknowledged(false);
        }}
        onProceed={handleProceedToBooking}
      />

      <Footer />
    </main>
  );
}

