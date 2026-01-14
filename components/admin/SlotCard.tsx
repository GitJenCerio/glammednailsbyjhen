import { useState, useRef, useEffect } from 'react';
import type { Slot, Booking, ServiceType, NailTech } from '@/lib/types';
import { formatTime12Hour, getNailTechColorClasses } from '@/lib/utils';
import { IoCreateOutline, IoTrashOutline, IoEyeOutline, IoDocumentTextOutline, IoEllipsisVertical } from 'react-icons/io5';

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
  onSlotClick?: (slot: Slot) => void;
  nailTechs?: NailTech[];
  selectedNailTechId?: string | null;
  allNailTechIds?: string[]; // Sorted list of all nail tech IDs for consistent color assignment
};

export function SlotCard({ slot, booking, customer, onEdit, onDelete, onView, onMakeQuotation, onSlotClick, nailTechs = [], selectedNailTechId, allNailTechIds }: SlotCardProps) {
  const isConfirmed = slot.status === 'confirmed';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);
  
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
  const serviceLocation = booking?.serviceLocation === 'home_service' ? 'HS' : 
                         booking?.serviceLocation === 'homebased_studio' ? 'ST' : 
                         null;
  
  // Get service type label
  const serviceTypeLabel = booking?.serviceType ? serviceLabels[booking.serviceType] || booking.serviceType : null;
  
  // Get nail tech info for this slot
  const slotNailTech = slot.nailTechId ? nailTechs.find(t => t.id === slot.nailTechId) : null;
  // Show badge when slot has a nail tech assigned (always show it, even when filtering)
  const showNailTechBadge = !!slotNailTech;

  const getStatusColor = () => {
    // Check booking status first for colored cards
    if (booking) {
      switch (booking.status) {
        case 'pending_form':
          return 'border-yellow-400 bg-yellow-50';
        case 'pending_payment':
          return 'border-blue-400 bg-blue-50';
        case 'confirmed':
          return 'border-slate-700 bg-slate-50';
        case 'cancelled':
          return 'border-gray-300 bg-gray-50';
        default:
          break;
      }
    }
    
    // Fall back to slot status if no booking or booking status doesn't match
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
    <div 
      className={`relative flex flex-col gap-3 rounded-xl sm:rounded-2xl border-2 ${getStatusColor()} p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-200 ${booking ? 'hover:ring-2 hover:ring-slate-400' : ''} ${onSlotClick && !booking ? 'cursor-pointer' : ''} overflow-visible`}
      onClick={(e) => {
        // Only trigger slot click if clicking on the card itself, not on buttons
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('[role="button"]')) {
          return;
        }
        if (onSlotClick && !booking) {
          onSlotClick(slot);
        }
      }}
    >
      {slot.slotType === 'with_squeeze_fee' && (
        <div className="absolute top-2 right-2 z-40 inline-flex items-center justify-center px-1 py-0.5 rounded bg-purple-500 border border-purple-700">
          <span className="text-[8px] sm:text-[9px] font-semibold text-white leading-none">SQ</span>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm sm:text-base font-bold text-slate-900">{formatTime12Hour(slot.time)}</p>
        {booking?.status === 'pending_form' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-yellow-500 text-white border border-yellow-600">
            Pending Form
          </span>
        )}
        {booking?.status === 'pending_payment' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-blue-500 text-white border border-blue-600">
            Pending Payment
          </span>
        )}
        {!booking && slot.status === 'confirmed' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-slate-700 text-white border border-slate-800">
            Confirmed
          </span>
        )}
        {!booking && slot.status === 'pending' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-amber-500 text-white border border-amber-600">
            Pending
          </span>
        )}
        {!booking && slot.status === 'available' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-emerald-500 text-white border border-emerald-600">
            Available
          </span>
        )}
        {booking?.status === 'confirmed' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-slate-700 text-white border border-slate-800">
            Confirmed
          </span>
        )}
        {booking?.status === 'cancelled' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-gray-500 text-white border border-gray-600">
            Cancelled
          </span>
        )}
        {serviceLocation && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold bg-blue-200 text-blue-900 border border-blue-300">
            {serviceLocation}
          </span>
        )}
        {showNailTechBadge && slotNailTech && (() => {
          // Ensure we have allNailTechIds, if not, create it from nailTechs array
          const techIds = allNailTechIds && allNailTechIds.length > 0 
            ? allNailTechIds 
            : nailTechs.sort((a, b) => a.name.localeCompare(b.name)).map(t => t.id);
          // Use pastel colors for nail tech badge
          const pastelColors = [
            { bg: 'bg-blue-200', border: 'border-blue-400', text: 'text-blue-900', bgHex: '#bfdbfe', borderHex: '#60a5fa' },
            { bg: 'bg-purple-200', border: 'border-purple-400', text: 'text-purple-900', bgHex: '#e9d5ff', borderHex: '#c084fc' },
            { bg: 'bg-pink-200', border: 'border-pink-400', text: 'text-pink-900', bgHex: '#fce7f3', borderHex: '#f472b6' },
            { bg: 'bg-indigo-200', border: 'border-indigo-400', text: 'text-indigo-900', bgHex: '#c7d2fe', borderHex: '#818cf8' },
            { bg: 'bg-teal-200', border: 'border-teal-400', text: 'text-teal-900', bgHex: '#99f6e4', borderHex: '#2dd4bf' },
            { bg: 'bg-amber-200', border: 'border-amber-400', text: 'text-amber-900', bgHex: '#fde68a', borderHex: '#fbbf24' },
            { bg: 'bg-rose-200', border: 'border-rose-400', text: 'text-rose-900', bgHex: '#fecdd3', borderHex: '#fb7185' },
            { bg: 'bg-cyan-200', border: 'border-cyan-400', text: 'text-cyan-900', bgHex: '#a5f3fc', borderHex: '#22d3ee' },
            { bg: 'bg-emerald-200', border: 'border-emerald-400', text: 'text-emerald-900', bgHex: '#a7f3d0', borderHex: '#34d399' },
            { bg: 'bg-violet-200', border: 'border-violet-400', text: 'text-violet-900', bgHex: '#ddd6fe', borderHex: '#a78bfa' },
            { bg: 'bg-fuchsia-200', border: 'border-fuchsia-400', text: 'text-fuchsia-900', bgHex: '#f5d0fe', borderHex: '#e879f9' },
            { bg: 'bg-orange-200', border: 'border-orange-400', text: 'text-orange-900', bgHex: '#fed7aa', borderHex: '#fb923c' },
            { bg: 'bg-lime-200', border: 'border-lime-400', text: 'text-lime-900', bgHex: '#d9f99d', borderHex: '#a3e635' },
            { bg: 'bg-sky-200', border: 'border-sky-400', text: 'text-sky-900', bgHex: '#bae6fd', borderHex: '#38bdf8' },
            { bg: 'bg-yellow-200', border: 'border-yellow-400', text: 'text-yellow-900', bgHex: '#fef08a', borderHex: '#facc15' },
          ];
          
          // Get color index based on tech position in sorted list
          let colorIndex = 0;
          if (techIds && techIds.length > 0) {
            const index = techIds.indexOf(slotNailTech.id);
            if (index >= 0) {
              colorIndex = index % pastelColors.length;
            } else {
              // Fallback: use hash function
              let hash = 5381;
              for (let i = 0; i < slotNailTech.id.length; i++) {
                hash = ((hash << 5) + hash) + slotNailTech.id.charCodeAt(i);
              }
              colorIndex = Math.abs(hash) % pastelColors.length;
            }
          } else {
            // Fallback: use hash function
            let hash = 5381;
            for (let i = 0; i < slotNailTech.id.length; i++) {
              hash = ((hash << 5) + hash) + slotNailTech.id.charCodeAt(i);
            }
            colorIndex = Math.abs(hash) % pastelColors.length;
          }
          
          const pastelColor = pastelColors[colorIndex];
          const bgColor = pastelColor.bgHex;
          const borderColor = pastelColor.borderHex;
          
          return (
            <span 
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-semibold border-2 ${pastelColor.bg} ${pastelColor.border} ${pastelColor.text}`}
              style={{
                backgroundColor: bgColor,
                borderColor: borderColor,
              }}
            >
              Ms. {slotNailTech.name}
            </span>
          );
        })()}
      </div>
      {booking && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 flex-wrap">
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
            </div>
            {/* Options dropdown - aligned with details on the right */}
            <div className="relative flex-shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(!dropdownOpen);
                }}
                className="p-1.5 rounded-full hover:bg-slate-200 transition-colors touch-manipulation"
                title="More options"
              >
                <IoEllipsisVertical className="w-5 h-5 text-slate-600" />
              </button>
              
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border-2 border-slate-300 bg-white shadow-xl py-1">
                  {!isConfirmed && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropdownOpen(false);
                          onEdit(slot);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 transition-colors"
                      >
                        <IoCreateOutline className="w-4 h-4 text-blue-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropdownOpen(false);
                          onDelete(slot);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <IoTrashOutline className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                  {booking && slot.status === 'confirmed' && (
                    <>
                      {onView && booking.customerData && Object.keys(booking.customerData).length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen(false);
                            onView(booking);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <IoEyeOutline className="w-4 h-4" />
                          <span>View Form</span>
                        </button>
                      )}
                      {onMakeQuotation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen(false);
                            onMakeQuotation(booking.id);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 transition-colors"
                        >
                          <IoDocumentTextOutline className="w-4 h-4" />
                          <span>{booking.invoice ? 'Requote' : 'Make Quotation'}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
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
      {!booking && (
        <div className="flex justify-end">
          {/* Options dropdown for slots without booking - aligned to the right */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(!dropdownOpen);
              }}
              className="p-1.5 rounded-full hover:bg-slate-200 transition-colors touch-manipulation"
              title="More options"
            >
              <IoEllipsisVertical className="w-5 h-5 text-slate-600" />
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border-2 border-slate-300 bg-white shadow-xl py-1">
                {!isConfirmed && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(false);
                        onEdit(slot);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 transition-colors"
                    >
                      <IoCreateOutline className="w-4 h-4 text-blue-600" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(false);
                        onDelete(slot);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <IoTrashOutline className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {slot.notes && <p className="text-xs sm:text-sm text-slate-600 break-words font-medium">{slot.notes}</p>}
    </div>
  );
}

