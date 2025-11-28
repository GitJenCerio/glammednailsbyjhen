
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
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

export function BookingDetailPanel({ booking, slotLabel, pairedSlotLabel, onConfirm }: BookingDetailPanelProps) {
  if (!booking) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md shadow-slate-900/5">
        <p className="text-xs sm:text-sm text-slate-500">Select a booking to see details.</p>
      </div>
    );
  }

  const entries = Object.entries(booking.customerData ?? {});

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md shadow-slate-900/5">
      <header className="mb-3 sm:mb-4">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">Booking</p>
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold break-words">{booking.bookingId}</h2>
        {slotLabel && <p className="text-xs sm:text-sm text-slate-500 break-words">{slotLabel}</p>}
        {pairedSlotLabel && <p className="text-xs sm:text-sm text-slate-500 break-words">+ {pairedSlotLabel}</p>}
        {booking.serviceType && (
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">
            {serviceLabels[booking.serviceType] ?? booking.serviceType}
          </p>
        )}
      </header>

      <div className="space-y-2.5 sm:space-y-3">
        {(booking.dateChanged || booking.timeChanged || booking.validationWarnings) && (
          <div className="rounded-xl sm:rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 sm:p-4 text-xs sm:text-sm">
            <p className="font-semibold text-amber-900 mb-1.5 sm:mb-2">⚠️ Warning: Date/Time Changed</p>
            {booking.validationWarnings && booking.validationWarnings.length > 0 ? (
              <ul className="list-disc list-inside space-y-0.5 sm:space-y-1 text-amber-800">
                {booking.validationWarnings.map((warning, index) => (
                  <li key={index} className="break-words">{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="text-amber-800 break-words">
                {booking.dateChanged && 'Date was changed from the original booking.'}
                {booking.timeChanged && 'Time was changed from the original booking.'}
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-xs sm:text-sm shadow-sm shadow-slate-900/5">
          <p className="font-semibold">Status</p>
          <p className="capitalize text-slate-600">{booking.status.replace('_', ' ')}</p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 text-xs sm:text-sm shadow-sm shadow-slate-900/5">
          <p className="font-semibold mb-1.5 sm:mb-2">Customer responses</p>
          {entries.length === 0 && <p className="text-slate-500">Waiting for form submission.</p>}
          {entries.length > 0 && (
            <dl className="space-y-1.5 sm:space-y-2">
              {entries.map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-3">
                  <dt className="text-slate-500 break-words">{key}</dt>
                  <dd className="font-medium break-words sm:text-right">{value}</dd>
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
          className="mt-4 sm:mt-6 w-full rounded-full bg-emerald-600 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white touch-manipulation active:scale-[0.98]"
        >
          Confirm booking
        </button>
      )}
    </div>
  );
}

