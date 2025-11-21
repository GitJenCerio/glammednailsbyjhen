import type { Booking } from '@/lib/types';

type BookingDetailPanelProps = {
  booking: Booking | null;
  slotLabel?: string;
  pairedSlotLabel?: string;
  onConfirm: (bookingId: string) => Promise<void>;
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
};

export function BookingDetailPanel({ booking, slotLabel, pairedSlotLabel, onConfirm }: BookingDetailPanelProps) {
  if (!booking) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Select a booking to see details.</p>
      </div>
    );
  }

  const entries = Object.entries(booking.customerData ?? {});

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Booking</p>
        <h2 className="text-2xl font-semibold">{booking.bookingId}</h2>
        {slotLabel && <p className="text-sm text-slate-500">{slotLabel}</p>}
        {pairedSlotLabel && <p className="text-sm text-slate-500">+ {pairedSlotLabel}</p>}
        {booking.serviceType && (
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {serviceLabels[booking.serviceType] ?? booking.serviceType}
          </p>
        )}
      </header>

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 p-4 text-sm">
          <p className="font-semibold">Status</p>
          <p className="capitalize text-slate-600">{booking.status.replace('_', ' ')}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 text-sm">
          <p className="font-semibold mb-2">Customer responses</p>
          {entries.length === 0 && <p className="text-slate-500">Waiting for form submission.</p>}
          {entries.length > 0 && (
            <dl className="space-y-2">
              {entries.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{key}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {booking.status === 'pending_payment' && (
        <button
          type="button"
          onClick={() => onConfirm(booking.id)}
          className="mt-6 w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
        >
          Confirm booking
        </button>
      )}
    </div>
  );
}

