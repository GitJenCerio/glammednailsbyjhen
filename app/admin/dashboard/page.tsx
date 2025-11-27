'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import type { BlockedDate, Booking, BookingWithSlot, Slot } from '@/lib/types';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import { SlotCard } from '@/components/admin/SlotCard';
import { SlotEditorModal } from '@/components/admin/modals/SlotEditorModal';
import { BlockDateModal } from '@/components/admin/modals/BlockDateModal';
import { BookingList } from '@/components/admin/BookingList';
import { BookingDetailPanel } from '@/components/admin/BookingDetailPanel';
import { ServicesManager } from '@/components/admin/ServicesManager';

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'customers', label: 'Customers' },
  { id: 'services', label: 'Services' },
] as const;

type AdminSection = (typeof navItems)[number]['id'];

export default function AdminDashboard() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [blockDefaults, setBlockDefaults] = useState<{ start?: string | null; end?: string | null }>({});
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('bookings');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [slotsRes, blocksRes, bookingsRes] = await Promise.all([
        fetch('/api/slots').then((res) => res.json()),
        fetch('/api/blocks').then((res) => res.json()),
        fetch('/api/bookings').then((res) => res.json()),
      ]);
      setSlots(slotsRes.slots);
      setBlockedDates(blocksRes.blockedDates);
      setBookings(bookingsRes.bookings);
    } catch (error) {
      console.error('Failed to load admin data', error);
      setToast('Unable to load data. Check your backend configuration.');
    } finally {
      setLoading(false);
    }
  }

  const selectedSlots = useMemo(() => slots.filter((slot) => slot.date === selectedDate), [slots, selectedDate]);

  const bookingsWithSlots = useMemo<BookingWithSlot[]>(() => {
    const list: BookingWithSlot[] = [];
    bookings.forEach((booking) => {
      const slot = slots.find((candidate) => candidate.id === booking.slotId);
      if (!slot) return;
      const pairedSlot = booking.pairedSlotId
        ? slots.find((candidate) => candidate.id === booking.pairedSlotId)
        : undefined;
      list.push({ ...booking, slot, pairedSlot });
    });
    return list;
  }, [bookings, slots]);

  const selectedBooking =
    bookingsWithSlots.find((booking) => booking.id === selectedBookingId) ?? bookingsWithSlots[0] ?? null;

  async function handleSaveSlot(payload: { date: string; time: string; status: Slot['status']; notes?: string }) {
    const url = editingSlot ? `/api/slots/${editingSlot.id}` : '/api/slots';
    const method = editingSlot ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    setEditingSlot(null);
    await loadData();
    setToast('Slot saved.');
  }

  async function handleDeleteSlot(slot: Slot) {
    if (!confirm('Delete this slot?')) return;
    await fetch(`/api/slots/${slot.id}`, { method: 'DELETE' });
    await loadData();
    setToast('Slot deleted.');
  }

  async function handleBlockDates(payload: { startDate: string; endDate: string; scope: BlockedDate['scope']; reason?: string }) {
    const res = await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    await loadData();
    setToast('Dates blocked.');
  }

  async function handleConfirmBooking(id: string) {
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm' }),
    });
    await loadData();
    setToast('Booking confirmed.');
  }

  async function handleSyncSheets() {
    const res = await fetch('/api/google/sync', { method: 'POST' });
    const data = await res.json();
    await loadData();
    setToast(`Processed ${data.processed} new form responses.`);
  }

  const renderBookingsSection = () => (
    <>
      {toast && (
        <div className="mb-6 rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {toast}
          <button className="ml-4 text-xs uppercase" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      )}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <CalendarGrid
              referenceDate={currentMonth}
              slots={slots}
              blockedDates={blockedDates}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onChangeMonth={setCurrentMonth}
            />

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <header className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Slots</p>
                  <h2 className="text-2xl font-semibold">{format(new Date(selectedDate), 'EEEE, MMM d')}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSlot(null);
                    setSlotModalOpen(true);
                  }}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-slate-900"
                >
                  Add slot
                </button>
              </header>

              <div className="space-y-4">
                {selectedSlots.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                    No slots yet. Create one to open this day for booking.
                  </div>
                )}
                {selectedSlots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onEdit={(value) => {
                      setEditingSlot(value);
                      setSlotModalOpen(true);
                    }}
                    onDelete={handleDeleteSlot}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <header className="mb-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Blocked dates</p>
                <h2 className="text-2xl font-semibold">Overrides</h2>
              </header>
              <div className="space-y-3">
                {blockedDates.length === 0 && <p className="text-sm text-slate-500">No blocked dates.</p>}
                {blockedDates.map((block) => (
                  <div key={block.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                    <p className="text-sm font-semibold text-rose-700">
                      {block.startDate} → {block.endDate}
                    </p>
                    <p className="text-xs text-rose-500 capitalize">Scope: {block.scope}</p>
                    {block.reason && <p className="text-xs text-rose-700">{block.reason}</p>}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <BookingList
              bookings={bookingsWithSlots}
              onSelect={(booking) => setSelectedBookingId(booking.id)}
              selectedId={selectedBooking?.id ?? null}
            />
            <BookingDetailPanel
              booking={selectedBooking ?? null}
              slotLabel={
                selectedBooking?.slot ? `${selectedBooking.slot.date} · ${selectedBooking.slot.time}` : undefined
              }
              onConfirm={handleConfirmBooking}
            />
          </div>
        </div>
      )}
    </>
  );

  const renderPlaceholder = (title: string, body: string) => (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
    </div>
  );

  const sectionDescription: Record<AdminSection, string> = {
    overview: 'High-level metrics coming soon.',
    bookings: 'Create slots, block dates, and track booking statuses.',
    customers: 'See relationship insights and client history.',
    services: 'Manage offerings, durations, and pricing.',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white px-6 py-8 lg:flex">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">Glammed Nails</p>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={[
                  'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  activeSection === item.id
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'text-slate-500 hover:bg-slate-100',
                ].join(' ')}
              >
                {item.label}
                {item.id === 'bookings' && (
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-xs',
                      activeSection === 'bookings' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600',
                    ].join(' ')}
                  >
                    {bookings.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dashboard</p>
              <h1 className="text-3xl font-semibold text-slate-900">
                {activeSection === 'bookings' ? 'Booking control center' : sectionDescription[activeSection]}
              </h1>
              {activeSection !== 'bookings' && (
                <p className="text-sm text-slate-500">Use the navigation to access the booking workflow.</p>
              )}
            </div>
            {activeSection === 'bookings' && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setBlockDefaults({
                      start: selectedDate,
                      end: selectedDate,
                    });
                    setBlockModalOpen(true);
                  }}
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:border-rose-600"
                >
                  Block selected date
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
                    const end = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), 'yyyy-MM-dd');
                    setBlockDefaults({ start, end });
                    setBlockModalOpen(true);
                  }}
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:border-rose-600"
                >
                  Block entire month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSlot(null);
                    setSlotModalOpen(true);
                  }}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white"
                >
                  New slot
                </button>
                <button
                  type="button"
                  onClick={handleSyncSheets}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-slate-900"
                >
                  Sync Google Sheet
                </button>
              </div>
            )}
          </header>

          {activeSection === 'bookings' ? (
            renderBookingsSection()
          ) : activeSection === 'services' ? (
            <ServicesManager />
          ) : (
            renderPlaceholder(
              activeSection === 'overview'
                ? 'Overview coming soon'
                : activeSection === 'customers'
                  ? 'Customer insights'
                  : 'Service catalog',
              sectionDescription[activeSection],
            )
          )}
        </main>
      </div>

      <SlotEditorModal
        open={slotModalOpen}
        slot={editingSlot}
        defaultDate={selectedDate}
        onClose={() => {
          setSlotModalOpen(false);
          setEditingSlot(null);
        }}
        onSubmit={handleSaveSlot}
      />

      <BlockDateModal
        open={blockModalOpen}
        initialStart={blockDefaults.start ?? selectedDate}
        initialEnd={blockDefaults.end ?? selectedDate}
        onClose={() => setBlockModalOpen(false)}
        onSubmit={handleBlockDates}
      />
    </div>
  );
}

