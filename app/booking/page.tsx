'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import type { Slot, BlockedDate, ServiceType } from '@/lib/types';
import { getNextSlotTime } from '@/lib/constants/slots';

const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'manicure', label: 'Manicure only (1 slot)' },
  { value: 'pedicure', label: 'Pedicure only (1 slot)' },
  { value: 'mani_pedi', label: 'Mani + Pedi (2 slots)' },
];

interface SlotModalProps {
  slot: Slot | null;
  serviceType: ServiceType;
  onServiceChange: (value: ServiceType) => void;
  serviceOptions: { value: ServiceType; label: string }[];
  pairedSlot: Slot | null;
  serviceMessage: string | null;
  disableProceed: boolean;
  onClose: () => void;
  onProceed: () => void;
}

function SlotModal({
  slot,
  serviceType,
  onServiceChange,
  serviceOptions,
  pairedSlot,
  serviceMessage,
  disableProceed,
  onClose,
  onProceed,
}: SlotModalProps) {
  if (!slot) return null;

  const doubleSlotUnavailable =
    serviceType === 'mani_pedi' && (!pairedSlot || pairedSlot.status !== 'available');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-lg max-w-md w-full p-8 shadow-xl"
      >
        <h3 className="text-2xl font-heading font-semibold mb-4">Book This Slot</h3>
        
        <div className="space-y-3 mb-6">
          <div>
            <span className="text-gray-600">Date:</span>
            <p className="font-medium">{format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div>
            <span className="text-gray-600">Time:</span>
            <p className="font-medium">{slot.time}</p>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>
            <p className="font-medium capitalize">{slot.status}</p>
          </div>
          <div>
            <span className="text-gray-600">Notes:</span>
            <p className="font-medium">{slot.notes || 'No notes'}</p>
          </div>
          <div>
            <span className="text-gray-600">Service:</span>
            <select
              value={serviceType}
              onChange={(e) => onServiceChange(e.target.value as ServiceType)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
            >
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {serviceType === 'mani_pedi' && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                doubleSlotUnavailable
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-emerald-100 bg-emerald-50 text-emerald-800'
              }`}
            >
              {serviceMessage ? <p>{serviceMessage}</p> : null}
            </div>
          )}
        </div>

        <p className="mb-6 text-sm text-gray-600">
          This slot is available. Click “Proceed to Booking Form” and you’ll be redirected to our Google Form to finish your reservation.
        </p>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-black text-black font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onProceed}
            disabled={disableProceed}
            className="flex-1 px-4 py-2 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
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
  const [pairedSlot, setPairedSlot] = useState<Slot | null>(null);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);

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
      setPairedSlot(null);
      setServiceMessage(null);
      return;
    }

    if (selectedService === 'mani_pedi') {
      const nextTime = getNextSlotTime(selectedSlot.time);
      const nextSlot =
        nextTime && selectedSlot
          ? slots.find((candidate) => candidate.date === selectedSlot.date && candidate.time === nextTime) ?? null
          : null;
      setPairedSlot(nextSlot);
      if (!nextSlot) {
        setServiceMessage('This service requires the next slot, but it is not available in the schedule. Please pick another time or date.');
      } else if (nextSlot.status !== 'available') {
        setServiceMessage('This service requires two consecutive slots, but the next slot is already taken. Please select another time or date.');
      } else {
        setServiceMessage(`This service will use ${selectedSlot.time} and ${nextSlot.time}.`);
      }
    } else {
      setPairedSlot(null);
      setServiceMessage(null);
    }
  }, [selectedSlot, selectedService, slots]);

  const availableSlotsForDate = useMemo(
    () => slots.filter((slot) => slot.date === selectedDate && slot.status === 'available'),
    [slots, selectedDate],
  );

  const requiresDouble = selectedService === 'mani_pedi';
  const disableProceed =
    !selectedSlot || (requiresDouble && (!pairedSlot || pairedSlot.status !== 'available'));

  const handleSelectSlot = (slot: Slot) => {
    if (slot.status !== 'available') return;
    setSelectedService('manicure');
    setPairedSlot(null);
    setServiceMessage(null);
    setSelectedSlot(slot);
  };

  async function handleProceedToBooking() {
    if (!selectedSlot) return;
    const requiresDouble = selectedService === 'mani_pedi';
    const pairedSlotId = requiresDouble ? pairedSlot?.id : undefined;

    if (requiresDouble && (!pairedSlotId || pairedSlot?.status !== 'available')) {
      setServiceMessage('This service requires two consecutive slots. Please choose another time or date.');
      return;
    }

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          serviceType: selectedService,
          pairedSlotId,
        }),
      });

      if (!response.ok) {
        throw new Error('Slot is no longer available.');
      }

      const data = await response.json();
      window.location.href = data.googleFormUrl;
      setSelectedSlot(null);
      setSelectedService('manicure');
      setPairedSlot(null);
      setServiceMessage(null);
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
      
      <section className="section-padding pt-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl font-acollia text-center mb-4">
            Book Your Appointment
          </h1>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Select an available time slot to proceed with your booking
          </p>

          {loading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black" />
            </div>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
                <CalendarGrid
                  referenceDate={currentMonth}
                  slots={slots}
                  blockedDates={blockedDates}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onChangeMonth={setCurrentMonth}
                />

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <header className="mb-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Available slots</p>
                    <h2 className="text-2xl font-semibold">
                      {format(new Date(selectedDate), 'EEEE, MMM d')}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Tap a time to reserve it instantly.
                    </p>
                  </header>

                  <div className="space-y-3">
                    {availableSlotsForDate.length === 0 && (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                        No available slots for this day. Choose another date on the calendar.
                      </p>
                    )}
                    {availableSlotsForDate.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSelectSlot(slot)}
                        className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Available</p>
                        <p className="text-lg font-semibold text-emerald-900">{slot.time}</p>
                        {slot.notes && <p className="text-sm text-emerald-700">{slot.notes}</p>}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-8 text-center text-sm text-gray-600">
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
        serviceOptions={SERVICE_OPTIONS}
        pairedSlot={pairedSlot}
        serviceMessage={serviceMessage}
        disableProceed={disableProceed}
        onClose={() => {
          setSelectedSlot(null);
          setSelectedService('manicure');
          setPairedSlot(null);
          setServiceMessage(null);
        }}
        onProceed={handleProceedToBooking}
      />

      <Footer />
    </main>
  );
}

