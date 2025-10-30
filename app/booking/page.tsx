'use client';

import { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, SlotInfo, Event, View } from 'react-big-calendar';
import type { CalendarProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAllSlots, getAllBookings, createBooking, getBookingsForSlot } from '@/lib/bookings';
import type { Slot, Booking } from '@/lib/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
});

interface SlotModalProps {
  slot: Slot | null;
  onClose: () => void;
  onProceed: () => void;
}

function SlotModal({ slot, onClose, onProceed }: SlotModalProps) {
  if (!slot) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-lg max-w-md w-full p-8 shadow-xl"
      >
        <h3 className="text-2xl font-heading font-semibold mb-4">Slot Details</h3>
        
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
            <span className="text-gray-600">Service:</span>
            <p className="font-medium">{slot.service}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-black text-black font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onProceed}
            className="flex-1 px-4 py-2 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] transition-all duration-300"
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
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const allSlots = await getAllSlots();
      const allBookings = await getAllBookings();
      
      // Get confirmed bookings
      const confirmed = allBookings.filter(b => b.status === 'confirmed');
      
      setSlots(allSlots);
      setConfirmedBookings(confirmed);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Convert slots to calendar events
  const events: Event[] = slots.map(slot => ({
    id: slot.id,
    title: slot.available ? `${slot.service} - ${slot.time}` : 'Unavailable',
    start: new Date(`${slot.date}T${slot.time}`),
    end: new Date(new Date(`${slot.date}T${slot.time}`).getTime() + 60 * 60 * 1000), // 1 hour
    resource: slot,
  }));

  const eventPropGetter = (event: Event) => {
    const slot = event.resource as Slot;
    
    // Check if slot is booked/confirmed
    const isUnavailable = !slot.available || 
      confirmedBookings.some(b => b.date === slot.date && b.time === slot.time && b.status === 'confirmed');
    
    return {
      style: {
        backgroundColor: isUnavailable ? '#cccccc' : '#000000',
        color: isUnavailable ? '#666666' : '#ffffff',
        cursor: isUnavailable ? 'not-allowed' : 'pointer',
      },
    };
  };

  const handleSelectSlot = async (slotInfo: SlotInfo) => {
    const selectedDate = format(slotInfo.start, 'yyyy-MM-dd');
    const selectedTime = format(slotInfo.start, 'HH:mm');
    
    // Find the matching slot
    const slot = slots.find(s => s.date === selectedDate && s.time === selectedTime);
    
    if (!slot) return;
    
    // Check if slot is available
    const isUnavailable = !slot.available || 
      confirmedBookings.some(b => b.date === slot.date && b.time === slot.time && b.status === 'confirmed');
    
    if (isUnavailable) return;
    
    setSelectedSlot(slot);
  };

  async function handleProceedToBooking() {
    if (!selectedSlot) return;

    // Generate unique booking ID
    const bookingId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create pending booking
    try {
      // Get the Google Form URL from environment
      const googleFormUrl = process.env.NEXT_PUBLIC_GOOGLE_FORM_URL || '';
      const fullFormUrl = googleFormUrl.includes('entry.') 
        ? `${googleFormUrl}${googleFormUrl.includes('?') ? '&' : '?'}bookingId=${bookingId}`
        : googleFormUrl;
      
      // This would create a booking in Firestore - for now we'll redirect
      // In production, you'd create the booking first
      window.open(fullFormUrl, '_blank');
      
      setSelectedSlot(null);
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('There was an error processing your booking. Please try again.');
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-6">
              {/* @ts-ignore - react-big-calendar has compatibility issues with React types */}
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
                onSelectSlot={handleSelectSlot}
                selectable
                eventPropGetter={eventPropGetter}
                defaultView="month"
                views={['month', 'week', 'day', 'agenda']}
              />
            </div>
          )}

          <div className="mt-8 text-center text-sm text-gray-600">
            <p>Available slots are shown in black. Unavailable slots are greyed out.</p>
          </div>
        </motion.div>
      </section>

      <SlotModal
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        onProceed={handleProceedToBooking}
      />

      <Footer />
    </main>
  );
}

