'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAllSlots, getAllBookings, addSlot, deleteSlot, updateBooking, updateSlot } from '@/lib/bookings';
import type { Slot, Booking } from '@/lib/types';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'slots' | 'bookings'>('slots');
  const [showAddSlot, setShowAddSlot] = useState(false);
  const router = useRouter();

  const [newSlot, setNewSlot] = useState({
    date: '',
    time: '',
    service: '',
    available: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/admin');
      }
    });

    loadData();
    return () => unsubscribe();
  }, [router]);

  async function loadData() {
    try {
      const allSlots = await getAllSlots();
      const allBookings = await getAllBookings();
      setSlots(allSlots);
      setBookings(allBookings);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.push('/admin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  async function handleAddSlot() {
    if (!newSlot.date || !newSlot.time || !newSlot.service) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await addSlot(newSlot);
      setNewSlot({ date: '', time: '', service: '', available: true });
      setShowAddSlot(false);
      await loadData();
    } catch (error) {
      console.error('Error adding slot:', error);
      alert('Failed to add slot');
    }
  }

  async function handleDeleteSlot(slotId: string) {
    if (!confirm('Are you sure you want to delete this slot?')) return;

    try {
      await deleteSlot(slotId);
      await loadData();
    } catch (error) {
      console.error('Error deleting slot:', error);
      alert('Failed to delete slot');
    }
  }

  async function handleUpdateBooking(bookingId: string, status: 'confirmed' | 'cancelled') {
    try {
      await updateBooking(bookingId, { status });
      await loadData();
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Failed to update booking');
    }
  }

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-acollia">Admin Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] transition-all duration-300"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-6 py-2 font-medium transition-colors ${
              activeTab === 'slots'
                ? 'bg-black text-white border-2 border-black'
                : 'bg-white text-black border-2 border-black hover:bg-gray-50'
            }`}
          >
            Manage Slots ({slots.length})
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-6 py-2 font-medium transition-colors ${
              activeTab === 'bookings'
                ? 'bg-black text-white border-2 border-black'
                : 'bg-white text-black border-2 border-black hover:bg-gray-50'
            }`}
          >
            Manage Bookings ({bookings.length})
          </button>
        </div>

        {/* Slots Tab */}
        {activeTab === 'slots' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-lg p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-heading">Available Slots</h2>
              <button
                onClick={() => setShowAddSlot(!showAddSlot)}
                className="px-4 py-2 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] transition-all duration-300"
              >
                {showAddSlot ? 'Cancel' : '+ Add Slot'}
              </button>
            </div>

            {showAddSlot && (
              <div className="bg-gray-50 p-6 rounded-lg mb-6 space-y-4">
                <h3 className="text-lg font-medium">Add New Slot</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input
                      type="date"
                      value={newSlot.date}
                      onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Time</label>
                    <input
                      type="time"
                      value={newSlot.time}
                      onChange={(e) => setNewSlot({ ...newSlot, time: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Service</label>
                    <input
                      type="text"
                      value={newSlot.service}
                      onChange={(e) => setNewSlot({ ...newSlot, service: e.target.value })}
                      placeholder="e.g., Russian Manicure"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddSlot}
                  className="px-4 py-2 bg-black text-white font-medium hover:bg-gray-800 transition-colors"
                >
                  Add Slot
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Time</th>
                    <th className="text-left py-3 px-4">Service</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">{format(new Date(slot.date), 'MMM d, yyyy')}</td>
                      <td className="py-3 px-4">{slot.time}</td>
                      <td className="py-3 px-4">{slot.service}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          slot.available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {slot.available ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Pending Bookings */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-heading mb-4">Pending Bookings ({pendingBookings.length})</h2>
              <div className="space-y-4">
                {pendingBookings.length === 0 ? (
                  <p className="text-gray-500">No pending bookings</p>
                ) : (
                  pendingBookings.map((booking) => (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{booking.name}</p>
                          <p className="text-sm text-gray-600">{booking.contact}</p>
                          <p className="text-sm">{booking.service}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(booking.date), 'MMM d, yyyy')} at {booking.time}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateBooking(booking.id, 'confirmed')}
                            className="px-4 py-1 bg-green-600 text-white text-sm font-medium hover:bg-green-700 rounded"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleUpdateBooking(booking.id, 'cancelled')}
                            className="px-4 py-1 bg-red-600 text-white text-sm font-medium hover:bg-red-700 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Confirmed Bookings */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-heading mb-4">Confirmed Bookings ({confirmedBookings.length})</h2>
              <div className="space-y-4">
                {confirmedBookings.length === 0 ? (
                  <p className="text-gray-500">No confirmed bookings</p>
                ) : (
                  confirmedBookings.map((booking) => (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                      <div>
                        <p className="font-medium">{booking.name}</p>
                        <p className="text-sm text-gray-600">{booking.contact}</p>
                        <p className="text-sm">{booking.service}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(booking.date), 'MMM d, yyyy')} at {booking.time}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cancelled Bookings */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-heading mb-4">Cancelled Bookings ({cancelledBookings.length})</h2>
              <div className="space-y-4">
                {cancelledBookings.length === 0 ? (
                  <p className="text-gray-500">No cancelled bookings</p>
                ) : (
                  cancelledBookings.map((booking) => (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4 opacity-50">
                      <div>
                        <p className="font-medium">{booking.name}</p>
                        <p className="text-sm text-gray-600">{booking.contact}</p>
                        <p className="text-sm">{booking.service}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(booking.date), 'MMM d, yyyy')} at {booking.time}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

