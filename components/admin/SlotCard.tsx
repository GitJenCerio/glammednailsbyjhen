import type { Slot, Booking, NailTech } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';
import { IoCreateOutline, IoTrashOutline } from 'react-icons/io5';

type SlotCardProps = {
  slot: Slot;
  booking?: Booking | null;
  customer?: { name: string } | null;
  nailTech?: NailTech | null;
  onEdit: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
};

export function SlotCard({ slot, booking, customer, nailTech, onEdit, onDelete }: SlotCardProps) {
  const isConfirmed = slot.status === 'confirmed';
  
  // Get customer full name - prioritize Customer object, then booking customerData
  const customerName = customer?.name ||
                       booking?.customerData?.['Full Name'] || 
                       booking?.customerData?.['fullName'] || 
                       booking?.customerData?.['Full name'] ||
                       booking?.customerData?.['FULL NAME'] ||
                       booking?.customerData?.['Name'] || 
                       booking?.customerData?.['name'] ||
                       booking?.customerData?.['NAME'] ||
                       // Try combining first and last name if they exist separately
                       (booking?.customerData?.['First Name'] && booking?.customerData?.['Last Name'] 
                         ? `${booking.customerData['First Name']} ${booking.customerData['Last Name']}`.trim()
                         : null) ||
                       (booking?.customerData?.['firstName'] && booking?.customerData?.['lastName']
                         ? `${booking.customerData['firstName']} ${booking.customerData['lastName']}`.trim()
                         : null) ||
                       null;
  
  // Get service location
  const serviceLocation = booking?.serviceLocation === 'home_service' ? 'Home Service' : 
                         booking?.serviceLocation === 'homebased_studio' ? 'Studio' : 
                         null;

  const getStatusColor = () => {
    switch (slot.status) {
      case 'confirmed':
        return 'border-slate-700 bg-slate-50';
      case 'pending':
        return 'border-amber-300 bg-amber-50';
      case 'blocked':
        return 'border-rose-300 bg-rose-50';
      default:
        return 'border-emerald-300 bg-emerald-50';
    }
  };

  return (
    <div className={`relative flex flex-col gap-3 rounded-xl sm:rounded-2xl border-2 ${getStatusColor()} p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-200`}>
      {slot.slotType === 'with_squeeze_fee' && (
        <div className="absolute top-2 right-2 inline-flex items-center justify-center px-1 py-0.5 rounded bg-purple-500 border border-purple-700">
          <span className="text-[8px] sm:text-[9px] font-semibold text-white leading-none">SQ</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <p className="text-sm sm:text-base font-bold text-slate-900">{formatTime12Hour(slot.time)}</p>
        {slot.status === 'confirmed' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-slate-700 text-white border border-slate-800">
            Confirmed
          </span>
        )}
        {slot.status === 'available' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-emerald-500 text-white border border-emerald-600">
            Available
          </span>
        )}
      </div>
      {isConfirmed && customerName && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <p className="font-semibold text-slate-900">{customerName}</p>
            {serviceLocation && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-blue-200 text-blue-900 border border-blue-300">
                {serviceLocation}
              </span>
            )}
          </div>
          {nailTech && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] text-slate-500">Nail Tech:</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-purple-200 text-purple-900 border border-purple-300">
                {nailTech.fullName}
              </span>
            </div>
          )}
        </div>
      )}
      {slot.notes && <p className="text-xs sm:text-sm text-slate-600 break-words font-medium">{slot.notes}</p>}
      {!isConfirmed && (
        <div className="flex gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onEdit(slot)}
            className="rounded-full border-2 border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 touch-manipulation active:scale-[0.98] hover:bg-blue-100 transition-all"
            title="Edit"
          >
            <IoCreateOutline className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(slot)}
            className="rounded-full border-2 border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 touch-manipulation active:scale-[0.98] hover:bg-red-100 transition-all"
            title="Delete"
          >
            <IoTrashOutline className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

