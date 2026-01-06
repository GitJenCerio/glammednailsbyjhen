'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { format, startOfMonth } from 'date-fns';
import { motion } from 'framer-motion';
import { IoClose } from 'react-icons/io5';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import type { Slot, BlockedDate, ServiceType, NailTech } from '@/lib/types';
import { getNextSlotTime, SLOT_TIMES } from '@/lib/constants/slots';
import { formatTime12Hour } from '@/lib/utils';

const SERVICE_OPTIONS: Record<ServiceLocation, { value: ServiceType; label: string }[]> = {
  homebased_studio: [
    { value: 'manicure', label: 'Manicure only (1 slot)' },
    { value: 'pedicure', label: 'Pedicure only (1 slot)' },
    { value: 'mani_pedi', label: 'Mani + Pedi (2 slots)' },
  ],
  home_service: [
    { value: 'mani_pedi', label: 'Mani + Pedi (2 slots)' },
    { value: 'home_service_2slots', label: 'Home Service (2 pax)' },
    { value: 'home_service_3slots', label: 'Home Service (3 pax)' },
  ],
};

function getRequiredSlotCount(serviceType: ServiceType): number {
  switch (serviceType) {
    case 'mani_pedi':
    case 'home_service_2slots':
      return 2;
    case 'home_service_3slots':
      return 3;
    default:
      return 1;
  }
}

function canSlotAccommodateService(
  slot: Slot,
  serviceType: ServiceType,
  allSlots: Slot[],
  blockedDates: BlockedDate[] = []
): boolean {
  const requiredSlots = getRequiredSlotCount(serviceType);
  if (requiredSlots === 1) return true;

  // Get all slots for this date and same nail tech, sorted by time
  const slotsForDate = allSlots
    .filter((s) => s.date === slot.date && s.nailTechId === slot.nailTechId)
    .sort((a, b) => a.time.localeCompare(b.time));

  let referenceSlot = slot;
  // Consecutive means: available slots with no booked/blocked slots in between
  // We skip over slot times that don't exist in the schedule at all
  for (let step = 1; step < requiredSlots; step += 1) {
    let nextSlot: Slot | null = null;
    let currentCheckTime = referenceSlot.time.trim();
    
    // Keep looking for the next available slot in sequence
    while (!nextSlot) {
      const nextTime = getNextSlotTime(currentCheckTime);
      if (!nextTime) {
        // No more slot times in the sequence
        return false;
      }
      
      // Check if a slot exists at this time (normalize time strings for comparison)
      const normalizedNextTime = nextTime.trim();
      const slotAtTime = slotsForDate.find(
        (candidate) => candidate.time.trim() === normalizedNextTime
      );
      
      if (slotAtTime) {
        // Slot exists at this time
        // Check if blocked
        const isBlocked = blockedDates.some(
          (block) => slotAtTime.date >= block.startDate && slotAtTime.date <= block.endDate
        );
        if (isBlocked) {
          // Blocked slot breaks consecutiveness
          return false;
        }
        
        // Check status
        if (slotAtTime.status === 'available') {
          // Found the next available slot - this is consecutive
          nextSlot = slotAtTime;
          break;
        } else {
          // Slot exists but is not available (pending, confirmed, blocked, etc.)
          // This breaks consecutiveness - there's a gap
          return false;
        }
      }
      // Slot doesn't exist at this time - skip it (not a gap, just not created)
      // Continue to next time in sequence
      
      currentCheckTime = normalizedNextTime;
    }
    
    if (!nextSlot) {
      // Couldn't find the next available slot
      return false;
    }
    referenceSlot = nextSlot;
  }
  return true;
}

type ClientType = 'new' | 'repeat';
type ServiceLocation = 'homebased_studio' | 'home_service';

interface SlotModalProps {
  slot: Slot | null;
  serviceType: ServiceType;
  onServiceChange: (value: ServiceType) => void;
  serviceOptions: { value: ServiceType; label: string }[];
  linkedSlots: Slot[];
  serviceMessage: string | null;
  clientType: ClientType;
  onClientTypeChange: (value: ClientType) => void;
  repeatClientEmail: string;
  onRepeatClientEmailChange: (value: string) => void;
  repeatClientName: string | null;
  onRepeatClientNameChange: (value: string | null) => void;
  repeatClientError: string | null;
  setRepeatClientError: (value: string | null) => void;
  isCheckingCustomer: boolean;
  setIsCheckingCustomer: (value: boolean) => void;
  serviceLocation: ServiceLocation;
  onServiceLocationChange: (value: ServiceLocation) => void;
  squeezeFeeAcknowledged: boolean;
  onSqueezeFeeAcknowledgedChange: (value: boolean) => void;
  socialMediaName: string;
  onSocialMediaNameChange: (value: string) => void;
  disableProceed: boolean;
  onClose: () => void;
  onProceed: () => void;
}

function SlotModal({
  slot,
  serviceType,
  onServiceChange,
  serviceOptions,
  linkedSlots,
  serviceMessage,
  clientType,
  onClientTypeChange,
  repeatClientEmail,
  onRepeatClientEmailChange,
  repeatClientName,
  onRepeatClientNameChange,
  repeatClientError,
  setRepeatClientError,
  isCheckingCustomer,
  setIsCheckingCustomer,
  serviceLocation,
  onServiceLocationChange,
  squeezeFeeAcknowledged,
  onSqueezeFeeAcknowledgedChange,
  socialMediaName,
  onSocialMediaNameChange,
  disableProceed,
  isBooking,
  onClose,
  onProceed,
}: SlotModalProps & { isBooking?: boolean }) {
  if (!slot) return null;

  const requiredSlots = getRequiredSlotCount(serviceType);
  const requiresMultipleSlots = requiredSlots > 1;
  const missingLinkedSlots = requiresMultipleSlots && linkedSlots.length !== requiredSlots - 1;
  const hasSqueezeFee = slot.slotType === 'with_squeeze_fee';
  const isHomeService = serviceLocation === 'home_service';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-100 border-2 border-slate-300 rounded-lg max-w-md w-full p-4 sm:p-6 md:p-8 shadow-xl shadow-slate-900/20 my-4 max-h-[90vh] overflow-y-auto relative"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-full hover:bg-slate-200 active:bg-slate-300 transition-colors touch-manipulation"
          aria-label="Close"
        >
          <IoClose className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700" />
        </button>
        <h3 className="text-xl sm:text-2xl font-heading font-semibold mb-3 sm:mb-4 pr-8 sm:pr-10">Book This Slot</h3>
        <div className="space-y-2.5 sm:space-y-3 mb-4 sm:mb-6">
          <div>
            <p className="text-sm sm:text-base">
              <span className="text-gray-600">Date:</span>{' '}
              <span className="font-bold text-black">{format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}</span>
            </p>
          </div>
          <div>
            <p className="text-sm sm:text-base">
              <span className="text-gray-600">Time:</span>{' '}
              {requiresMultipleSlots && linkedSlots.length > 0 ? (
                <>
                  <span className="font-bold text-black">
                    {formatTime12Hour(slot.time)}
                    {linkedSlots.map((linkedSlot) => (
                      <span key={linkedSlot.id}> → {formatTime12Hour(linkedSlot.time)}</span>
                    ))}
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-500 block mt-1">
                    This booking will use {requiredSlots} consecutive time slots: <strong>{formatTime12Hour(slot.time)}</strong>
                    {linkedSlots.map((linkedSlot) => (
                      <span key={linkedSlot.id}> and <strong>{formatTime12Hour(linkedSlot.time)}</strong></span>
                    ))}
                  </span>
                </>
              ) : (
                <span className="font-bold text-black">{formatTime12Hour(slot.time)}</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-sm sm:text-base text-gray-600">Service Location:</span>
            <select
              value={serviceLocation}
              onChange={(e) => onServiceLocationChange(e.target.value as ServiceLocation)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-sm sm:text-base touch-manipulation"
            >
              <option value="homebased_studio">Homebased Studio</option>
              <option value="home_service">Home Service (+₱1,000)</option>
            </select>
            {isHomeService && (
              <p className="mt-1.5 text-[10px] sm:text-xs text-amber-700">
                ⚠️ Home service bookings require Mani + Pedi or a Home Service package (2 or 3 consecutive slots).
              </p>
            )}
          </div>
          <div>
            <span className="text-sm sm:text-base text-gray-600">Service:</span>
            <select
              value={serviceType}
              onChange={(e) => onServiceChange(e.target.value as ServiceType)}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-sm sm:text-base touch-manipulation"
            >
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-sm sm:text-base text-gray-600">Client Type:</span>
            <select
              value={clientType}
              onChange={(e) => {
                onClientTypeChange(e.target.value as ClientType);
                if (e.target.value === 'new') {
                  onRepeatClientNameChange(null);
                  onRepeatClientEmailChange('');
                  onSocialMediaNameChange('');
                }
              }}
              className="mt-1 w-full rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-sm sm:text-base touch-manipulation"
            >
              <option value="new">New Client</option>
              <option value="repeat">Repeat Client</option>
            </select>
          </div>
          {clientType === 'repeat' && (
            <div>
              <label className="text-sm sm:text-base text-gray-600 mb-1 block">
                Enter your email address or contact number to find your account
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={repeatClientEmail}
                  onChange={(e) => {
                    onRepeatClientEmailChange(e.target.value);
                    onRepeatClientNameChange(null);
                    setRepeatClientError(null);
                  }}
                  placeholder="Email or contact number"
                  className="flex-1 mt-1 w-full rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-sm sm:text-base touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const inputValue = repeatClientEmail.trim();
                    if (!inputValue) {
                      return;
                    }
                    
                    setIsCheckingCustomer(true);
                    setRepeatClientError(null);
                    
                    // Determine if it's an email or phone
                    const isEmail = inputValue.includes('@');
                    const searchParams = isEmail 
                      ? `email=${encodeURIComponent(inputValue)}`
                      : `phone=${encodeURIComponent(inputValue)}`;
                    
                    try {
                      const res = await fetch(`/api/customers/find?${searchParams}`);
                      if (res.ok) {
                        const data = await res.json();
                        if (data.found && data.customer?.name) {
                          onRepeatClientNameChange(data.customer.name);
                          setRepeatClientError(null);
                        } else {
                          // Customer not found - show error message
                          onRepeatClientNameChange(null);
                          setRepeatClientError('No existing customer found with this email or contact number. Please select "New Client" if this is your first booking.');
                        }
                      } else {
                        onRepeatClientNameChange(null);
                        setRepeatClientError('Unable to verify customer. Please try again or select "New Client".');
                      }
                    } catch (error) {
                      console.error('Error finding customer:', error);
                      onRepeatClientNameChange(null);
                      setRepeatClientError('Error checking customer. Please try again.');
                    } finally {
                      setIsCheckingCustomer(false);
                    }
                  }}
                  disabled={!repeatClientEmail.trim() || isCheckingCustomer}
                  className="mt-1 px-4 py-2.5 sm:py-2 text-sm sm:text-base font-semibold text-white bg-slate-900 rounded-xl sm:rounded-2xl hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-400 min-w-[100px]"
                >
                  {isCheckingCustomer ? 'Checking...' : 'Confirm'}
                </button>
              </div>
              
              {repeatClientName && (
                <div className="mt-2 rounded-xl sm:rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-3 sm:px-4 py-2.5">
                  <p className="text-[10px] sm:text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                    <span className="text-emerald-600">✓</span>
                    Welcome back, <span className="font-semibold">{repeatClientName}</span>!
                  </p>
                </div>
              )}
              
              {repeatClientError && (
                <div className="mt-2 rounded-xl sm:rounded-2xl border-2 border-amber-200 bg-amber-50 px-3 sm:px-4 py-2.5">
                  <p className="text-[10px] sm:text-xs text-amber-800 font-medium flex items-start gap-1.5">
                    <span className="text-amber-600 mt-0.5">⚠</span>
                    <span>{repeatClientError}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClientTypeChange('new');
                      onRepeatClientEmailChange('');
                      onRepeatClientNameChange(null);
                      setRepeatClientError(null);
                    }}
                    className="mt-2 text-[10px] sm:text-xs text-amber-700 font-semibold underline hover:text-amber-900"
                  >
                    Select &quot;New Client&quot; instead
                  </button>
                </div>
              )}
              
              {!repeatClientName && !repeatClientError && repeatClientEmail.trim() && (
                <p className="mt-1.5 text-[10px] sm:text-xs text-slate-600">
                  Click &quot;Confirm&quot; to verify your account.
                </p>
              )}
              
              {!repeatClientEmail.trim() && (
                <p className="mt-1.5 text-[10px] sm:text-xs text-slate-600">
                  We&apos;ll auto-fill your information if we find your previous booking records.
                </p>
              )}
            </div>
          )}
          {clientType === 'new' && (
            <div>
              <label className="text-sm sm:text-base text-gray-600 mb-1 block">
                Facebook or Instagram Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={socialMediaName}
                onChange={(e) => onSocialMediaNameChange(e.target.value)}
                placeholder="Enter your FB or IG name"
                className="mt-1 w-full rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-sm sm:text-base touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-400"
                required
              />
            </div>
          )}
          {requiresMultipleSlots && missingLinkedSlots && serviceMessage && (serviceMessage.includes('requires') || serviceMessage.includes('consecutive')) && (
            <div className="rounded-2xl border-2 border-rose-400 bg-rose-200 px-4 py-3 text-sm text-rose-800">
              <p>This service requires <strong>{requiredSlots} consecutive slots</strong>. Please select a different time or date where {requiredSlots} consecutive slots are available.</p>
            </div>
          )}
          {serviceMessage && !missingLinkedSlots && !(serviceMessage.includes('requires') && serviceMessage.includes('consecutive') && serviceMessage.includes('Please select')) && (
            <div className="rounded-xl sm:rounded-2xl border-2 border-blue-400 bg-blue-100 px-3 sm:px-4 py-2.5 sm:py-3">
              <p className="text-xs sm:text-sm font-semibold text-blue-900 mb-1">📅 Slot Information</p>
              <p className="text-[10px] sm:text-xs text-blue-900 leading-relaxed">
                {serviceMessage}
              </p>
              {requiresMultipleSlots && linkedSlots.length > 0 && (
                <p className="text-[10px] sm:text-xs text-blue-800 mt-2 italic">
                  This booking will use these consecutive time slots: <strong>{formatTime12Hour(slot.time)}</strong>
                  {linkedSlots.map((linkedSlot) => (
                    <span key={linkedSlot.id}> → <strong>{formatTime12Hour(linkedSlot.time)}</strong></span>
                  ))}
                </p>
              )}
            </div>
          )}
        </div>

        {hasSqueezeFee && (
          <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border-2 border-purple-400 bg-purple-200 px-3 sm:px-4 py-2.5 sm:py-3">
            <p className="text-xs sm:text-sm font-semibold text-purple-900 mb-2">⚠️ Squeeze-in Fee</p>
            <p className="text-[10px] sm:text-xs text-purple-900 leading-relaxed mb-3">
              This slot has a squeeze-in fee of ₱500. This is an additional charge on top of the regular service fee.
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={squeezeFeeAcknowledged}
                onChange={(e) => onSqueezeFeeAcknowledgedChange(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-2 border-purple-600 text-purple-600 focus:ring-purple-500 focus:ring-2"
              />
              <span className="text-[10px] sm:text-xs text-purple-900 font-medium">
                I understand and agree to pay the ₱500 squeeze-in fee for this slot.
              </span>
            </label>
          </div>
        )}

        <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border-2 border-amber-400 bg-amber-200 px-3 sm:px-4 py-2.5 sm:py-3">
          <p className="text-xs sm:text-sm font-semibold text-amber-900 mb-1">Deposit Required</p>
          <p className="text-[10px] sm:text-xs text-amber-900 leading-relaxed">
            ₱500 deposit upon booking is required to reserve your slot, it is consumable and non-refundable. (NO DEPOSIT, NO APPOINTMENT)
          </p>
        </div>

        <div>
          <button
            onClick={onProceed}
            disabled={disableProceed}
            className="w-full px-4 py-3 sm:py-2 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] active:scale-[0.98] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation text-sm sm:text-base"
          >
            {isBooking ? 'Reserving Slot...' : 'Proceed to Booking Form'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function BookingPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [nailTechs, setNailTechs] = useState<NailTech[]>([]);
  const [selectedNailTechId, setSelectedNailTechId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const slotsSectionRef = useRef<HTMLElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedService, setSelectedService] = useState<ServiceType>('manicure');
  const [clientType, setClientType] = useState<ClientType>('new');
  const [repeatClientEmail, setRepeatClientEmail] = useState('');
  const [serviceLocation, setServiceLocation] = useState<ServiceLocation>('homebased_studio');
  const [linkedSlots, setLinkedSlots] = useState<Slot[]>([]);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [squeezeFeeAcknowledged, setSqueezeFeeAcknowledged] = useState(false);
  const [repeatClientName, setRepeatClientName] = useState<string | null>(null);
  const [repeatClientError, setRepeatClientError] = useState<string | null>(null);
  const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);
  const [socialMediaName, setSocialMediaName] = useState('');
  const serviceOptions = SERVICE_OPTIONS[serviceLocation];

  useEffect(() => {
    if (!serviceOptions.some((option) => option.value === selectedService)) {
      setSelectedService(serviceOptions[0].value);
    }
  }, [serviceLocation, serviceOptions, selectedService]);

  useEffect(() => {
    loadNailTechs();
  }, []);

  useEffect(() => {
    if (selectedNailTechId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNailTechId]);

  // Auto-refresh slots every 30 seconds to show updated slot status (pending slots should disappear)
  // Increased interval for better performance - cache headers help with freshness
  useEffect(() => {
    if (!selectedNailTechId) return;
    
    const interval = setInterval(() => {
      loadData(false); // Don't show loading spinner on auto-refresh
    }, 30000); // 30 seconds - balance between freshness and performance

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNailTechId]);

  async function loadNailTechs() {
    try {
      const response = await fetch('/api/nail-techs?activeOnly=true', {
        cache: 'no-store',
      });
      const data = await response.json();
      setNailTechs(data.nailTechs || []);
      
      // Default to first active nail tech (should be Ms. Jhen if migration ran)
      if (data.nailTechs && data.nailTechs.length > 0) {
        const defaultTech = data.nailTechs.find((tech: NailTech) => 
          tech.role === 'Owner' && tech.status === 'Active'
        ) || data.nailTechs[0];
        setSelectedNailTechId(defaultTech.id);
      }
    } catch (err) {
      console.error('Error loading nail techs', err);
      setError('Unable to load nail technicians. Please try again.');
    }
  }

  async function loadData(showLoading = true) {
    if (!selectedNailTechId) return;
    
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      // Add cache-busting timestamp to ensure fresh data
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/availability?t=${timestamp}&nailTechId=${selectedNailTechId}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      setSlots(data.slots);
      setBlockedDates(data.blockedDates);
    } catch (err) {
      console.error('Error loading availability', err);
      setError('Unable to load availability. Please try again.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }


  useEffect(() => {
    if (!selectedSlot) {
      setLinkedSlots([]);
      setServiceMessage(null);
      return;
    }

    const requiredSlots = getRequiredSlotCount(selectedService);
    if (requiredSlots === 1) {
      setLinkedSlots([]);
      setServiceMessage(null);
      return;
    }

    const collected: Slot[] = [];
    let referenceSlot = selectedSlot;
    let errorMessage: string | null = null;

    // Get all slots for this date and same nail tech (only check slots for the chosen nail tech)
    // Sort by time to ensure consistent ordering
    const slotsForDate = slots
      .filter((s) => s.date === selectedSlot.date && s.nailTechId === selectedSlot.nailTechId)
      .sort((a, b) => a.time.localeCompare(b.time));

    // Check for consecutive slots starting from the selected slot
    // Consecutive means: available slots with no booked/blocked slots in between
    // We skip over slot times that don't exist in the schedule at all
    for (let step = 1; step < requiredSlots; step += 1) {
      let nextSlotAny: Slot | null = null;
      let currentCheckTime = referenceSlot.time.trim();
      
      // Keep looking for the next available slot in sequence
      while (!nextSlotAny) {
        const nextTime = getNextSlotTime(currentCheckTime);
        if (!nextTime) {
          // No more slot times in the predefined sequence
          const availableTimes = slotsForDate
            .filter((s) => s.status === 'available' && s.nailTechId === selectedSlot.nailTechId)
            .map((s) => formatTime12Hour(s.time))
            .join(', ');
          errorMessage = `This service requires ${requiredSlots} consecutive available slots starting from ${formatTime12Hour(selectedSlot.time)}, but there aren't enough slots available after this time. Available slots on this date: ${availableTimes || 'none'}. Please select a different time or date.`;
          break;
        }
        
        // Check if a slot exists at this time (normalize time strings for comparison)
        const normalizedNextTime = nextTime.trim();
        const slotAtTime = slotsForDate.find(
          (candidate) => candidate.time.trim() === normalizedNextTime
        );
        
        if (slotAtTime) {
          // Slot exists at this time
          // Check if slot is blocked by a blocked date
          const isBlocked = blockedDates.some(
            (block) => slotAtTime.date >= block.startDate && slotAtTime.date <= block.endDate
          );
          
          if (isBlocked) {
            errorMessage = `This service requires ${requiredSlots} consecutive slots, but the slot at ${formatTime12Hour(nextTime)} is blocked. Please select a different time or date.`;
            break;
          }
          
          // Check status
          if (slotAtTime.status === 'available') {
            // Found the next available slot - this is consecutive
            nextSlotAny = slotAtTime;
            break;
          } else {
            // Slot exists but is not available (pending, confirmed, blocked, etc.)
            // This breaks consecutiveness - there's a gap
            errorMessage = `This service requires ${requiredSlots} consecutive slots, but there is a ${slotAtTime.status} slot at ${formatTime12Hour(nextTime)} between the slots. There is a gap in the consecutive slots. Please select a different time or date.`;
            break;
          }
        }
        // Slot doesn't exist at this time - skip it (not a gap, just not created)
        // Continue to next time in sequence
        
        currentCheckTime = normalizedNextTime;
      }

      // If we couldn't find the next available slot, break with error
      if (!nextSlotAny) {
        break;
      }

      collected.push(nextSlotAny);
      referenceSlot = nextSlotAny;
    }

    if (errorMessage) {
      setLinkedSlots([]);
      setServiceMessage(errorMessage);
      return;
    }

    // Successfully found all required consecutive slots - clear any error messages
    setLinkedSlots(collected);
    const serviceLabel =
      serviceOptions.find((option) => option.value === selectedService)?.label ?? 'This service';
    
    if (requiredSlots > 1) {
      // For multiple slots, show clear explanation
      const allSlots = [selectedSlot, ...collected];
      const slotTimes = allSlots.map(s => formatTime12Hour(s.time)).join(' and ');
      setServiceMessage(
        `This slot selection will use ${slotTimes} for this booking. The system will automatically reserve ${requiredSlots} consecutive time slots for your ${serviceLabel}.`
      );
    } else {
      setServiceMessage(
        `This booking will use the time slot at ${formatTime12Hour(selectedSlot.time)}.`
      );
    }
  }, [selectedSlot, selectedService, slots, serviceOptions, blockedDates]);

  const availableSlotsForDate = useMemo(
    () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      return slots.filter(
        (slot) =>
          slot.date === selectedDate &&
          slot.date >= today &&
          slot.status === 'available' &&
          !blockedDates.some(
            (block) => slot.date >= block.startDate && slot.date <= block.endDate
          )
      );
    },
    [slots, selectedDate, blockedDates],
  );

  // Filter slots that can accommodate the selected service
  const compatibleSlotsForDate = useMemo(
    () => {
      if (!selectedService || getRequiredSlotCount(selectedService) === 1) {
        return availableSlotsForDate;
      }
      return availableSlotsForDate.filter((slot) => canSlotAccommodateService(slot, selectedService, slots, blockedDates));
    },
    [availableSlotsForDate, selectedService, slots, blockedDates],
  );

  // Scroll to show both calendar and slots on mobile when date is selected
  useEffect(() => {
    if (selectedDate) {
      // Only scroll on mobile/tablet (smaller screens)
      const isMobile = window.innerWidth < 1024; // lg breakpoint
      if (isMobile) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          const calendarElement = document.getElementById('booking-calendar');
          if (calendarElement) {
            // Scroll to calendar position but ensure slots are also visible
            // Calculate position to show calendar with some space for slots below
            const calendarTop = calendarElement.getBoundingClientRect().top + window.pageYOffset;
            const headerOffset = 80; // Header height offset
            const scrollPosition = Math.max(0, calendarTop - headerOffset);
            
            window.scrollTo({
              top: scrollPosition,
              behavior: 'smooth'
            });
          }
        }, 100);
      }
    }
  }, [selectedDate]);

  const requiredSlots = getRequiredSlotCount(selectedService);
  const hasSqueezeFee = selectedSlot?.slotType === 'with_squeeze_fee';
  const missingLinkedSlots = requiredSlots > 1 && linkedSlots.length !== requiredSlots - 1;
  const missingSocialMediaName = clientType === 'new' && !socialMediaName.trim();
  const disableProceed =
    !selectedSlot ||
    missingLinkedSlots ||
    (hasSqueezeFee && !squeezeFeeAcknowledged) ||
    missingSocialMediaName ||
    isBooking;

  const handleSelectSlot = (slot: Slot) => {
    if (slot.status !== 'available') return;
    setSelectedService('manicure');
    setClientType('new');
    setRepeatClientEmail('');
    setRepeatClientName(null);
    setSocialMediaName('');
    setServiceLocation('homebased_studio');
    setLinkedSlots([]);
    setServiceMessage(null);
    setSqueezeFeeAcknowledged(false);
    setSelectedSlot(slot);
  };

  async function handleProceedToBooking() {
    if (!selectedSlot || isBooking) return; // Prevent multiple simultaneous bookings
    
    setIsBooking(true);
    try {
      // Refresh slot data before booking to ensure we have the latest status
      await loadData();
      
      // Verify the selected slot still exists and is available after refresh
      const refreshedSlot = slots.find((s) => s.id === selectedSlot.id);
      if (!refreshedSlot) {
        alert('This slot is no longer available. Please select another slot.');
        setSelectedSlot(null);
        setLinkedSlots([]);
        setIsBooking(false);
        return;
      }
      
      if (refreshedSlot.status !== 'available') {
        alert(`This slot is no longer available (status: ${refreshedSlot.status}). Please select another slot.`);
        setSelectedSlot(null);
        setLinkedSlots([]);
        setIsBooking(false);
        return;
      }
      
      // Update selectedSlot to use refreshed data
      setSelectedSlot(refreshedSlot);
      
      const requiredSlots = getRequiredSlotCount(selectedService);
      const linkedSlotIds = linkedSlots.map((slot) => {
        const refreshedLinkedSlot = slots.find((s) => s.id === slot.id);
        if (!refreshedLinkedSlot || refreshedLinkedSlot.status !== 'available') {
          return null;
        }
        return refreshedLinkedSlot.id;
      }).filter((id): id is string => id !== null);

      if (requiredSlots > 1 && linkedSlotIds.length !== requiredSlots - 1) {
        // Re-validate slots after refresh - they might have changed
        // The useEffect will automatically update serviceMessage with the correct validation
        setLinkedSlots([]);
        setIsBooking(false);
        return;
      }

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: refreshedSlot.id,
          serviceType: selectedService,
          pairedSlotId: linkedSlotIds[0],
          linkedSlotIds,
          clientType,
          repeatClientEmail: clientType === 'repeat' ? repeatClientEmail : undefined,
          serviceLocation,
          socialMediaName: clientType === 'new' ? socialMediaName : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Slot is no longer available.';
        // Check if it's a race condition (slot already booked)
        if (errorMessage.includes('no longer available') || errorMessage.includes('not available')) {
          throw new Error('This slot was just booked by another customer. Please select a different time slot.');
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Immediately refresh slots before redirecting so other users see updated status
      // This helps prevent double-booking by updating the slot status to 'pending' quickly
      await loadData(false);
      
      // Small delay to ensure the refresh completes before redirect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Redirect to Google Form - booking is successfully reserved
      window.location.href = data.googleFormUrl;
      // Note: We don't reset state here since we're redirecting
    } catch (error: any) {
      console.error('Error creating booking:', error);
      alert(error.message || 'This slot is no longer available. Please pick another slot.');
      await loadData();
      // Reset selection to allow user to pick a new slot
      setSelectedSlot(null);
      setLinkedSlots([]);
    } finally {
      setIsBooking(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />
      
      <section className="mt-16 sm:mt-28 md:mt-32 lg:mt-36 pt-4 sm:pt-6 md:pt-8 px-2 sm:px-6 pb-8 sm:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          <h1 id="booking-heading" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-acollia text-center mb-3 sm:mb-4 px-2 sm:px-4 text-slate-900 scroll-mt-24 sm:scroll-mt-28">
            Book Your Appointment
          </h1>
          <p className="text-center text-gray-600 mb-4 sm:mb-6 max-w-2xl mx-auto px-2 sm:px-4 text-xs sm:text-base">
            Select your preferred nail technician and an available time slot
          </p>

          {/* Nail Tech Selection */}
          {nailTechs.length > 0 && (
            <div className="mb-6 sm:mb-8 max-w-4xl mx-auto px-2 sm:px-4">
              <div className="rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 sm:px-5 py-3 sm:py-4">
                <label className="block text-sm sm:text-base font-semibold text-slate-900 mb-2">
                  Select Nail Technician
                </label>
                <select
                  value={selectedNailTechId || ''}
                  onChange={(e) => {
                    setSelectedNailTechId(e.target.value);
                    setSelectedSlot(null);
                    setLinkedSlots([]);
                    setServiceMessage(null);
                  }}
                  className="w-full rounded-xl sm:rounded-2xl border-2 border-slate-300 bg-white px-3 py-2.5 sm:py-2 text-sm sm:text-base touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {nailTechs.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      Ms. {tech.name} ({tech.role}){tech.discount != null && tech.discount > 0 ? ` - ${tech.discount}% OFF` : ''} - {tech.serviceAvailability}
                    </option>
                  ))}
                </select>
                {selectedNailTechId && (() => {
                  const selectedTech = nailTechs.find(t => t.id === selectedNailTechId);
                  if (!selectedTech) return null;
                  const hasDiscount = selectedTech.discount !== undefined && selectedTech.discount !== null && selectedTech.discount > 0;
                  return (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs sm:text-sm text-slate-600">
                        Viewing calendar for: <strong>Ms. {selectedTech.name}</strong>
                      </p>
                      {hasDiscount && (
                        <p className="text-xs sm:text-sm font-semibold text-green-600">
                          🎉 Special Offer: {selectedTech.discount}% discount on all services!
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Slot Requirements Notice */}
          <div className="mb-6 sm:mb-8 md:mb-12 max-w-4xl mx-auto px-2 sm:px-4">
            <div className="rounded-xl sm:rounded-2xl border-2 border-blue-300 bg-blue-50 px-4 sm:px-5 py-3 sm:py-4">
              <h3 className="text-xs sm:text-base font-semibold text-blue-900 mb-2 sm:mb-3 flex items-center gap-2">
                <span>Slot Requirements by Service</span>
              </h3>
              <div className="space-y-1.5 sm:space-y-2 text-[10px] sm:text-sm text-blue-800">
                <p><strong>Mani + Pedi, Home Service (2 pax):</strong> 2 consecutive slots required</p>
                <p><strong>Home Service (3 pax):</strong> 3 consecutive slots required</p>
                <div className="mt-2.5 pt-2.5 border-t border-blue-200">
                  <p className="text-[9px] sm:text-xs font-medium italic text-blue-900">
                    <strong>Important:</strong> For services requiring multiple slots, select the <strong>first</strong> slot of the consecutive sequence. The system will automatically book the required consecutive slots for you.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {!selectedNailTechId ? (
            <div className="flex justify-center items-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
                <p className="text-slate-600">Loading nail technicians...</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr,1fr]">
                <div id="booking-calendar" className="scroll-mt-24">
                  <CalendarGrid
                    referenceDate={currentMonth}
                    slots={slots.filter((slot) => slot.status === 'available')}
                    blockedDates={blockedDates}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    onChangeMonth={setCurrentMonth}
                    nailTechName={selectedNailTechId ? `Ms. ${nailTechs.find(t => t.id === selectedNailTechId)?.name || ''}` : undefined}
                  />
                </div>

                <section 
                  ref={slotsSectionRef}
                  className="rounded-2xl sm:rounded-3xl border-2 border-slate-300 bg-slate-100 p-4 sm:p-6 shadow-md shadow-slate-900/10 scroll-mt-24"
                >
                  <header className="mb-3 sm:mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-500">Available slots</p>
                      <button
                        type="button"
                        onClick={() => loadData(true)}
                        disabled={loading}
                        className="text-[10px] sm:text-xs text-slate-600 hover:text-slate-900 underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Refresh slots"
                      >
                        {loading ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>
                    <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-900">
                      {format(new Date(selectedDate), 'EEEE, MMM d')}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Tap a time to reserve it instantly.
                    </p>
                    {selectedService && getRequiredSlotCount(selectedService) > 1 && (
                      <p className="text-[10px] sm:text-xs text-amber-700 mt-1">
                        For {getRequiredSlotCount(selectedService)}-slot services, select the <strong>first</strong> slot of the consecutive sequence (e.g., if you need 3 slots at 8:00 AM, 10:30 AM, 1:00 PM, select 8:00 AM).
                      </p>
                    )}
                  </header>

                  <div className="space-y-3">
                    {availableSlotsForDate.length === 0 && (
                      <p className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        No available slots for this day. Choose another date on the calendar.
                      </p>
                    )}
                    {availableSlotsForDate.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSelectSlot(slot)}
                        className="w-full rounded-xl sm:rounded-2xl border-2 border-emerald-400 bg-emerald-200 px-3 sm:px-4 py-3 sm:py-3.5 text-left transition-all hover:border-emerald-600 hover:bg-emerald-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500 touch-manipulation"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-700 font-semibold">Available</p>
                          {slot.slotType === 'with_squeeze_fee' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-purple-200 text-purple-900 border border-purple-300">
                              ₱500 Squeeze-in Fee
                            </span>
                          )}
                        </div>
                        <p className="text-base sm:text-lg font-semibold text-emerald-900">{formatTime12Hour(slot.time)}</p>
                        {slot.notes && <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">{slot.notes}</p>}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-600 px-2 sm:px-4">
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
        serviceOptions={serviceOptions}
        linkedSlots={linkedSlots}
        serviceMessage={serviceMessage}
        clientType={clientType}
        onClientTypeChange={setClientType}
        repeatClientEmail={repeatClientEmail}
        onRepeatClientEmailChange={setRepeatClientEmail}
        repeatClientName={repeatClientName}
        onRepeatClientNameChange={setRepeatClientName}
        repeatClientError={repeatClientError}
        setRepeatClientError={setRepeatClientError}
        isCheckingCustomer={isCheckingCustomer}
        setIsCheckingCustomer={setIsCheckingCustomer}
        serviceLocation={serviceLocation}
        onServiceLocationChange={setServiceLocation}
        squeezeFeeAcknowledged={squeezeFeeAcknowledged}
        onSqueezeFeeAcknowledgedChange={setSqueezeFeeAcknowledged}
        socialMediaName={socialMediaName}
        onSocialMediaNameChange={setSocialMediaName}
        disableProceed={disableProceed}
        isBooking={isBooking}
        onClose={() => {
          setSelectedSlot(null);
          setSelectedService('manicure');
          setClientType('new');
          setRepeatClientEmail('');
          setRepeatClientName(null);
          setSocialMediaName('');
          setServiceLocation('homebased_studio');
          setLinkedSlots([]);
          setServiceMessage(null);
          setSqueezeFeeAcknowledged(false);
        }}
        onProceed={handleProceedToBooking}
      />

      <Footer />
    </main>
  );
}

