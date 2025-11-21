import type { Booking, BookingStatus, Slot } from '@/lib/types';

type BookingRow = Booking & { slot?: Slot; pairedSlot?: Slot };

type BookingListProps = {
  bookings: BookingRow[];
  onSelect: (booking: BookingRow) => void;
  selectedId: string | null;
};

const statusLabels: Record<BookingStatus, string> = {
  pending_form: 'Awaiting Form',
  pending_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
};

export function BookingList({ bookings, onSelect, selectedId }: BookingListProps) {
  const grouped = bookings.reduce<Record<BookingStatus, BookingRow[]>>(
    (acc, booking) => {
      acc[booking.status].push(booking);
      return acc;
    },
    { pending_form: [], pending_payment: [], confirmed: [] },
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Bookings</p>
        <h2 className="text-2xl font-semibold">Status overview</h2>
      </header>

      <div className="space-y-8">
        {(Object.keys(grouped) as BookingStatus[]).map((status) => (
          <div key={status}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold capitalize">{statusLabels[status]}</span>
              <span className="text-slate-500">{grouped[status].length} bookings</span>
            </div>
            <div className="space-y-2">
              {grouped[status].length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No bookings.</div>
              )}
              {grouped[status].map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onSelect(booking)}
                  className={[
                    'w-full rounded-2xl border px-4 py-3 text-left transition',
                    selectedId === booking.id ? 'border-slate-900 shadow-lg' : 'border-slate-200 hover:border-slate-900',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{booking.bookingId}</p>
                      {booking.slot && (
                        <p className="text-xs text-slate-500">
                          {booking.slot.date} · {booking.slot.time}
                        </p>
                      )}
                      {booking.serviceType && (
                        <p className="text-xs text-slate-400">
                          {serviceLabels[booking.serviceType] ?? booking.serviceType}
                          {booking.serviceType === 'mani_pedi' && booking.slot && (
                            <>
                              {' '}
                              ({booking.slot.time}
                              {booking.pairedSlot ? ` + ${booking.pairedSlot.time}` : ''})
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="text-xs uppercase tracking-wide text-slate-500">{booking.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

