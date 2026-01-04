import type { Slot, Booking, ServiceType, NailTech } from '@/lib/types';
import { formatTime12Hour, getNailTechColorClasses } from '@/lib/utils';
import { IoCreateOutline, IoTrashOutline, IoEyeOutline, IoDocumentTextOutline } from 'react-icons/io5';

const serviceLabels: Record<ServiceType, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

type SlotCardProps = {
  slot: Slot;
  booking?: Booking | null;
  customer?: { name: string } | null;
  onEdit: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
  onView?: (booking: Booking) => void;
  onMakeQuotation?: (bookingId: string) => void;
  nailTechs?: NailTech[];
  selectedNailTechId?: string | null;
  allNailTechIds?: string[]; // Sorted list of all nail tech IDs for consistent color assignment
};

export function SlotCard({ slot, booking, customer, onEdit, onDelete, onView, onMakeQuotation, nailTechs = [], selectedNailTechId, allNailTechIds }: SlotCardProps) {
  const isConfirmed = slot.status === 'confirmed';
  
  // Get customer full name - prioritize Customer object, then booking customerData
  // Use comprehensive search through customerData fields (matching BookingList logic exactly)
  const getCustomerNameFromData = (data?: Record<string, string>): string | null => {
    if (!data || Object.keys(data).length === 0) return null;
    
    // Helper function to find field by fuzzy matching key names (same as BookingList)
    const findField = (keywords: string[]): string | null => {
      const lowerKeywords = keywords.map(k => k.toLowerCase());
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        // Check if key matches any keyword (partial match or exact match)
        if (lowerKeywords.some(kw => lowerKey.includes(kw) || lowerKey === kw) && value && String(value).trim()) {
          return String(value).trim();
        }
      }
      return null;
    };

    // Try to find full name field first (various formats)
    const fullName = findField(['full name', 'fullname']);
    if (fullName) return fullName;

    // Helper function to find first name (excluding surname/last name fields and social media names)
    const findFirstName = (): string | null => {
      const keywords = ['first name', 'firstname', 'fname', 'given name'];
      const lowerKeywords = keywords.map(k => k.toLowerCase());
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        // Check for explicit first name keywords
        if (lowerKeywords.some(kw => lowerKey.includes(kw) || lowerKey === kw) && value && String(value).trim()) {
          return String(value).trim();
        }
      }
      // Now try "name" but EXCLUDE social media names, surname, last name, etc.
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('name') && 
            !lowerKey.includes('surname') && 
            !lowerKey.includes('last name') && 
            !lowerKey.includes('lastname') &&
            !lowerKey.includes('full name') && 
            !lowerKey.includes('fullname') &&
            !lowerKey.includes('instagram') &&
            !lowerKey.includes('facebook') &&
            !lowerKey.includes('social') &&
            !lowerKey.includes('inquire') &&
            value && String(value).trim()) {
          return String(value).trim();
        }
      }
      return null;
    };

    // Try to find last name/surname (including the exact Google Form field name with autofill text)
    const lastName = findField(['surname', 'last name', 'lastname', 'lname', 'family name']);
    
    // Try to find first name (excluding surname fields)
    const firstName = findFirstName();
    
    // If we found both, combine them
    if (firstName && lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    // If we found only first name or only last name, use it
    if (firstName) return firstName;
    if (lastName) return lastName;
    
    // Last resort: look for any field that might be a name (not email, phone, etc.)
    // Match BookingList logic exactly - fewer exclusions to catch more name variations like "bi rgere"
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      // Skip non-name fields (matching BookingList exclusions - fewer than before)
      if (lowerKey.includes('email') || lowerKey.includes('phone') || lowerKey.includes('contact') || 
          lowerKey.includes('booking') || lowerKey.includes('date') || lowerKey.includes('time') ||
          lowerKey.includes('service') || lowerKey.includes('location') || lowerKey.includes('referral')) {
        continue;
      }
      // If it's a reasonable length, use it (BookingList doesn't check for @ or http - it's more permissive)
      const strValue = String(value).trim();
      if (strValue.length > 0 && strValue.length < 100) {
        return strValue;
      }
    }
    
    return null;
  };

  // Get social media name (Facebook or Instagram) from customerData or customer object
  const getSocialMediaName = (data?: Record<string, string>): string | null => {
    if (!data || Object.keys(data).length === 0) return null;
    
    // Helper function to find field by fuzzy matching key names
    const findField = (keywords: string[]): string | null => {
      const lowerKeywords = keywords.map(k => k.toLowerCase());
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        // Check if key matches any keyword (partial match or exact match)
        if (lowerKeywords.some(kw => lowerKey.includes(kw) || lowerKey === kw) && value && String(value).trim()) {
          return String(value).trim();
        }
      }
      return null;
    };

    // Try to find Facebook name first
    const facebookName = findField(['facebook', 'fb name', 'fb']);
    if (facebookName) return facebookName;

    // Then try Instagram name
    const instagramName = findField(['instagram', 'ig name', 'ig', 'insta']);
    if (instagramName) return instagramName;

    // Try generic social media name
    const socialName = findField(['social media', 'social', 'social media name']);
    if (socialName) return socialName;

    return null;
  };

  // Prioritize customerData over customer object name
  // This is because customerData has the most up-to-date info from the form
  // Only use customer.name if it's not "Unknown Customer" and we don't have customerData
  const nameFromData = getCustomerNameFromData(booking?.customerData);
  const customerNameFromObject = customer?.name && customer.name !== 'Unknown Customer' && customer.name.trim() !== '' 
    ? customer.name 
    : null;
  const customerName = nameFromData || customerNameFromObject || null;
  
  // Get social media name from customerData
  const socialMediaName = getSocialMediaName(booking?.customerData);
  
  // Debug: Log if we have booking but no name found (only in development)
  if (process.env.NODE_ENV === 'development' && booking && !customerName && slot.status === 'confirmed') {
    console.log('SlotCard: Booking found but no customer name extracted', {
      bookingId: booking.bookingId,
      hasCustomerData: !!booking.customerData,
      customerDataKeys: booking.customerData ? Object.keys(booking.customerData) : [],
      customerData: booking.customerData,
      customerName: customer?.name,
    });
  }
  
  // Get service location
  const serviceLocation = booking?.serviceLocation === 'home_service' ? 'Home Service' : 
                         booking?.serviceLocation === 'homebased_studio' ? 'Studio' : 
                         null;
  
  // Get service type label
  const serviceTypeLabel = booking?.serviceType ? serviceLabels[booking.serviceType] || booking.serviceType : null;
  
  // Get nail tech info for this slot (only show when viewing all nail techs)
  const slotNailTech = slot.nailTechId ? nailTechs.find(t => t.id === slot.nailTechId) : null;
  const showNailTechBadge = !selectedNailTechId && slotNailTech;

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
      {showNailTechBadge && slotNailTech && (() => {
        // Ensure we have allNailTechIds, if not, create it from nailTechs array
        const techIds = allNailTechIds && allNailTechIds.length > 0 
          ? allNailTechIds 
          : nailTechs.sort((a, b) => a.name.localeCompare(b.name)).map(t => t.id);
        const colorClasses = getNailTechColorClasses(slotNailTech.id, techIds);
        // Extract text color from color classes (text-white or text-slate-900)
        const textColor = colorClasses.includes('text-slate-900') ? 'text-slate-900' : 'text-white';
        
        // Extract background color for inline style fallback (for production builds)
        const bgColorMap: Record<string, string> = {
          'bg-blue-500': '#3b82f6',
          'bg-purple-500': '#a855f7',
          'bg-pink-500': '#ec4899',
          'bg-indigo-500': '#6366f1',
          'bg-teal-500': '#14b8a6',
          'bg-amber-500': '#f59e0b',
          'bg-rose-500': '#f43f5e',
          'bg-cyan-500': '#06b6d4',
          'bg-emerald-500': '#10b981',
          'bg-violet-500': '#8b5cf6',
          'bg-fuchsia-500': '#d946ef',
          'bg-orange-500': '#f97316',
          'bg-lime-500': '#84cc16',
          'bg-sky-500': '#0ea5e9',
          'bg-yellow-500': '#eab308',
        };
        const bgColorClass = colorClasses.match(/bg-\w+-\d+/)?.[0] || 'bg-blue-500';
        const bgColor = bgColorMap[bgColorClass] || '#3b82f6';
        const borderColorMap: Record<string, string> = {
          'border-blue-700': '#1d4ed8',
          'border-purple-700': '#7e22ce',
          'border-pink-700': '#be185d',
          'border-indigo-700': '#4338ca',
          'border-teal-700': '#0f766e',
          'border-amber-700': '#b45309',
          'border-rose-700': '#be123c',
          'border-cyan-700': '#0e7490',
          'border-emerald-700': '#047857',
          'border-violet-700': '#6d28d9',
          'border-fuchsia-700': '#a21caf',
          'border-orange-700': '#c2410c',
          'border-lime-700': '#65a30d',
          'border-sky-700': '#0369a1',
          'border-yellow-700': '#a16207',
        };
        const borderColorClass = colorClasses.match(/border-\w+-\d+/)?.[0] || 'border-blue-700';
        const borderColor = borderColorMap[borderColorClass] || '#1d4ed8';
        
        return (
          <div 
            className={`absolute top-2 ${slot.slotType === 'with_squeeze_fee' ? 'right-10' : 'right-2'} inline-flex items-center justify-center px-1.5 py-0.5 rounded-full border-2 ${colorClasses}`}
            style={{
              backgroundColor: bgColor,
              borderColor: borderColor,
              color: textColor === 'text-slate-900' ? '#0f172a' : '#ffffff',
            }}
          >
            <span className={`text-[8px] sm:text-[9px] font-semibold leading-none ${textColor}`}>Ms. {slotNailTech.name}</span>
          </div>
        );
      })()}
      <div className="flex items-center gap-2 flex-wrap">
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
      {isConfirmed && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            {customerName ? (
              <p className="font-semibold text-slate-900">
                {customerName}
                {socialMediaName && (
                  <span className="text-slate-600 font-normal"> ({socialMediaName})</span>
                )}
              </p>
            ) : booking?.bookingId ? (
              <p className="font-semibold text-slate-600 italic">{booking.bookingId}</p>
            ) : null}
            {serviceLocation && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-blue-200 text-blue-900 border border-blue-300">
                {serviceLocation}
              </span>
            )}
          </div>
          {serviceTypeLabel && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
                {serviceTypeLabel}
              </span>
            </div>
          )}
        </div>
      )}
      {slot.notes && <p className="text-xs sm:text-sm text-slate-600 break-words font-medium">{slot.notes}</p>}
      {isConfirmed && booking && (
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {onView && booking.customerData && Object.keys(booking.customerData).length > 0 && (
            <button
              type="button"
              onClick={() => onView(booking)}
              className="inline-flex items-center gap-1 rounded-full border-2 border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 touch-manipulation active:scale-[0.98] hover:bg-slate-50 transition-all"
              title="View form response"
            >
              <IoEyeOutline className="w-3 h-3" />
              <span>View</span>
            </button>
          )}
          {onMakeQuotation && (
            <button
              type="button"
              onClick={() => onMakeQuotation(booking.id)}
              className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white touch-manipulation active:scale-[0.98] hover:bg-rose-700 transition-all"
              title="Make quotation"
            >
              <IoDocumentTextOutline className="w-3 h-3" />
              <span>Quote</span>
            </button>
          )}
        </div>
      )}
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

