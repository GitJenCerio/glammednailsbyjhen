'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { format, startOfMonth } from 'date-fns';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CalendarGrid } from '@/components/admin/calendar/CalendarGrid';
import type { Slot, BlockedDate, ServiceType } from '@/lib/types';
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

  // Get all slots for this date
  const slotsForDate = allSlots.filter((s) => s.date === slot.date);

  let referenceSlot = slot;
  // Consecutive means: available slots with no booked slots in between
  // We skip over slot times that don't exist in the schedule at all
  for (let step = 1; step < requiredSlots; step += 1) {
    let nextSlot: Slot | null = null;
    let currentCheckTime = referenceSlot.time;
    let foundBookedSlot = false;
    
    // Keep looking for the next available slot, checking for booked slots in between
    while (!nextSlot) {
      const nextTime = getNextSlotTime(currentCheckTime);
      if (!nextTime) return false; // No more slot times
      
      // Check if a slot exists at this time
      const slotAtTime = slotsForDate.find(
        (candidate) => candidate.time === nextTime
      );
      
      if (slotAtTime) {
        // Slot exists - check if blocked
        const isBlocked = blockedDates.some(
          (block) => slotAtTime.date >= block.startDate && slotAtTime.date <= block.endDate
        );
        if (isBlocked) return false;
        
        // If it's booked (not available), there's a gap
        if (slotAtTime.status !== 'available') {
          foundBookedSlot = true;
          // Continue checking - maybe there are more available slots after this booked one
        } else {
          // Found an available slot
          nextSlot = slotAtTime;
          // If we found a booked slot before this, that's a gap
          if (foundBookedSlot) return false;
          break;
        }
      }
      // Slot doesn't exist at this time - skip it (not a gap, just not created)
      
      currentCheckTime = nextTime;
    }
    
    if (!nextSlot) return false;
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
        className="bg-slate-100 border-2 border-slate-300 rounded-lg max-w-md w-full p-4 sm:p-6 md:p-8 shadow-xl shadow-slate-900/20 my-4 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-xl sm:text-2xl font-heading font-semibold mb-3 sm:mb-4">Book This Slot</h3>
        <div className="space-y-2.5 sm:space-y-3 mb-4 sm:mb-6">
          <div>
            <span className="text-sm sm:text-base text-gray-600">Date:</span>
            <p className="font-medium text-sm sm:text-base">{format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div>
            <span className="text-sm sm:text-base text-gray-600">Time:</span>
            {requiresMultipleSlots && linkedSlots.length > 0 ? (
              <div className="mt-1">
                <p className="font-medium text-sm sm:text-base">
                  {formatTime12Hour(slot.time)}
                  {linkedSlots.map((linkedSlot) => (
                    <span key={linkedSlot.id}> → {formatTime12Hour(linkedSlot.time)}</span>
                  ))}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                  This booking will use {requiredSlots} consecutive time slots: <strong>{formatTime12Hour(slot.time)}</strong>
                  {linkedSlots.map((linkedSlot) => (
                    <span key={linkedSlot.id}> and <strong>{formatTime12Hour(linkedSlot.time)}</strong></span>
                  ))}
                </p>
              </div>
            ) : (
              <p className="font-medium text-sm sm:text-base">{formatTime12Hour(slot.time)}</p>
            )}
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
            <div className="rounded-xl sm:rounded-2xl border-2 border-blue-200 bg-blue-50 px-3 sm:px-4 py-2 text-xs sm:text-sm text-blue-900">
              <p className="font-semibold">New Client</p>
              <p className="text-[10px] sm:text-xs mt-1">Please fill out the booking form after confirming this slot.</p>
            </div>
          )}
          {requiresMultipleSlots && missingLinkedSlots && (
            <div className="rounded-2xl border-2 border-rose-400 bg-rose-200 px-4 py-3 text-sm text-rose-800">
              <p>This service requires <strong>{requiredSlots} consecutive slots</strong>. Please select a different time or date where {requiredSlots} consecutive slots are available.</p>
            </div>
          )}
          {serviceMessage && !missingLinkedSlots && (
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
            ₱500 deposit upon booking is required to reserve your desired date and time, it is consumable and non-refundable. (NO DEPOSIT, NO APPOINTMENT)
          </p>
        </div>

        <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-600 leading-relaxed">
          This slot is available. Click &ldquo;Proceed to Booking Form&rdquo; and you&rsquo;ll be redirected to our Google Form to finish your reservation.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 sm:py-2 border-2 border-black text-black font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation text-sm sm:text-base"
          >
            Close
          </button>
          <button
            onClick={onProceed}
            disabled={disableProceed}
            className="flex-1 px-4 py-3 sm:py-2 bg-black text-white font-medium border-2 border-white shadow-[0_0_0_2px_#000000] hover:bg-white hover:text-black hover:border hover:border-black hover:shadow-[0_0_0_2px_#ffffff,0_0_0_3px_#000000] active:scale-[0.98] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation text-sm sm:text-base"
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
  const serviceOptions = SERVICE_OPTIONS[serviceLocation];

  useEffect(() => {
    if (!serviceOptions.some((option) => option.value === selectedService)) {
      setSelectedService(serviceOptions[0].value);
    }
  }, [serviceLocation, serviceOptions, selectedService]);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh slots every 30 seconds to show updated slot status (pending slots should disappear)
  // Increased interval for better performance - cache headers help with freshness
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(false); // Don't show loading spinner on auto-refresh
    }, 30000); // 30 seconds - balance between freshness and performance

    return () => clearInterval(interval);
  }, []);

  async function loadData(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      // Add cache-busting timestamp to ensure fresh data
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/availability?t=${timestamp}`, {
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

    // Get all slots for this date to help with debugging
    const slotsForDate = slots.filter((s) => s.date === selectedSlot.date);

    // Check for consecutive slots starting from the selected slot
    // Consecutive means: available slots with no booked slots in between
    // We skip over slot times that don't exist in the schedule at all
    for (let step = 1; step < requiredSlots; step += 1) {
      // Find the next slot that exists in the schedule, checking all times in sequence
      let nextSlotAny: Slot | null = null;
      let currentCheckTime = referenceSlot.time;
      let foundBookedSlot = false;
      let bookedSlotTime: string | null = null;
      
      // Keep looking for the next available slot, checking for booked slots in between
      while (!nextSlotAny) {
        const nextTime = getNextSlotTime(currentCheckTime);
        if (!nextTime) {
          // No more slot times in the predefined sequence
          break;
        }
        
        // Check if a slot exists at this time
        const slotAtTime = slotsForDate.find(
          (candidate) => candidate.time === nextTime
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
          
          // If it's booked (not available), there's a gap
          if (slotAtTime.status !== 'available') {
            foundBookedSlot = true;
            bookedSlotTime = nextTime;
            // Continue checking - maybe there are more available slots after this booked one
          } else {
            // Found an available slot
            nextSlotAny = slotAtTime;
            // If we found a booked slot before this, that's a problem
            if (foundBookedSlot) {
              errorMessage = `This service requires ${requiredSlots} consecutive slots, but there is a booked slot at ${formatTime12Hour(bookedSlotTime!)} between the slots. There is a gap in the consecutive slots. Please select a different time or date.`;
              nextSlotAny = null; // Reset so we break out
              break;
            }
            break;
          }
        }
        // Slot doesn't exist at this time - skip it (not a gap, just not created)
        
        currentCheckTime = nextTime;
      }

      // If we couldn't find the next available slot
      if (!nextSlotAny) {
        if (foundBookedSlot && bookedSlotTime) {
          // We already set the error message above
          break;
        }
        const availableTimes = slotsForDate
          .filter((s) => s.status === 'available')
          .map((s) => formatTime12Hour(s.time))
          .join(', ');
        errorMessage = `This service requires ${requiredSlots} consecutive available slots starting from ${formatTime12Hour(selectedSlot.time)}, but there aren't enough slots available after this time. Available slots on this date: ${availableTimes || 'none'}. Please select a different time or date.`;
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

    setLinkedSlots(collected);
    const lastSlot = collected[collected.length - 1];
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
  const disableProceed =
    !selectedSlot ||
    missingLinkedSlots ||
    (hasSqueezeFee && !squeezeFeeAcknowledged) ||
    isBooking;

  const handleSelectSlot = (slot: Slot) => {
    if (slot.status !== 'available') return;
    setSelectedService('manicure');
    setClientType('new');
    setRepeatClientEmail('');
    setRepeatClientName(null);
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
      // Fetch fresh slot data directly (don't rely on state updates)
      const timestamp = new Date().getTime();
      const availabilityController = new AbortController();
      const availabilityTimeout = setTimeout(() => availabilityController.abort(), 10000);
      
      let availabilityResponse: Response;
      try {
        availabilityResponse = await fetch(`/api/availability?t=${timestamp}`, { 
          cache: 'no-store',
          signal: availabilityController.signal 
        });
        clearTimeout(availabilityTimeout);
      } catch (error: any) {
        clearTimeout(availabilityTimeout);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - please try again');
        }
        throw error;
      }
      
      if (!availabilityResponse.ok) {
        throw new Error('Unable to verify slot availability. Please try again.');
      }
      
      const availabilityData = await availabilityResponse.json();
      const freshSlots = availabilityData.slots || [];
      
      // Verify the selected slot still exists and is available after refresh
      const refreshedSlot = freshSlots.find((s: Slot) => s.id === selectedSlot.id);
      if (!refreshedSlot) {
        alert('This slot is no longer available. Please select another slot.');
        setSelectedSlot(null);
        setLinkedSlots([]);
        setIsBooking(false);
        // Refresh the UI
        await loadData(false);
        return;
      }
      
      if (refreshedSlot.status !== 'available') {
        alert(`This slot is no longer available (status: ${refreshedSlot.status}). Please select another slot.`);
        setSelectedSlot(null);
        setLinkedSlots([]);
        setIsBooking(false);
        // Refresh the UI
        await loadData(false);
        return;
      }
      
      // Update selectedSlot to use refreshed data
      setSelectedSlot(refreshedSlot);
      
      const requiredSlots = getRequiredSlotCount(selectedService);
      const linkedSlotIds = linkedSlots.map((slot) => {
        const refreshedLinkedSlot = freshSlots.find((s: Slot) => s.id === slot.id);
        if (!refreshedLinkedSlot || refreshedLinkedSlot.status !== 'available') {
          return null;
        }
        return refreshedLinkedSlot.id;
      }).filter((id): id is string => id !== null);

      if (requiredSlots > 1 && linkedSlotIds.length !== requiredSlots - 1) {
        setServiceMessage('This service requires consecutive slots. Please choose another time or date.');
        setLinkedSlots([]);
        setIsBooking(false);
        // Refresh the UI
        await loadData(false);
        return;
      }

      // Create booking with timeout
      const bookingController = new AbortController();
      const bookingTimeout = setTimeout(() => bookingController.abort(), 15000);
      
      let bookingResponse: Response;
      try {
        bookingResponse = await fetch('/api/bookings', {
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
          }),
          signal: bookingController.signal,
        });
        clearTimeout(bookingTimeout);
      } catch (error: any) {
        clearTimeout(bookingTimeout);
        if (error.name === 'AbortError') {
          throw new Error('Booking request timed out. Please try again.');
        }
        throw error;
      }

      if (!bookingResponse.ok) {
        const errorData = await bookingResponse.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Slot is no longer available.';
        // Check if it's a race condition (slot already booked)
        if (errorMessage.includes('no longer available') || errorMessage.includes('not available')) {
          throw new Error('This slot was just booked by another customer. Please select a different time slot.');
        }
        throw new Error(errorMessage);
      }

      const data = await bookingResponse.json();
      
      if (!data.googleFormUrl) {
        throw new Error('Booking created but redirect URL is missing. Please contact support.');
      }
      
      // Immediately refresh slots before redirecting so other users see updated status
      // This helps prevent double-booking by updating the slot status to 'pending' quickly
      loadData(false).catch(() => {
        // Silently fail - we're redirecting anyway
      });
      
      // Redirect to Google Form - booking is successfully reserved
      window.location.href = data.googleFormUrl;
      // Note: We don't reset state here since we're redirecting
    } catch (error: any) {
      console.error('Error creating booking:', error);
      const errorMessage = error.message || 'Unable to complete booking. Please try again.';
      alert(errorMessage);
      
      // Refresh the UI to show updated slot status
      loadData(false).catch(() => {
        // Silently fail if refresh fails
      });
      
      // Reset selection to allow user to pick a new slot
      setSelectedSlot(null);
      setLinkedSlots([]);
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
            Select an available time slot to proceed with your booking
          </p>

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

          {loading ? (
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
        disableProceed={disableProceed}
        isBooking={isBooking}
        onClose={() => {
          setSelectedSlot(null);
          setSelectedService('manicure');
          setClientType('new');
          setRepeatClientEmail('');
          setRepeatClientName(null);
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

