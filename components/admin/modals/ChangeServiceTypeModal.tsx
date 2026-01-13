'use client';

import { useState, useEffect, useMemo } from 'react';
import { IoClose, IoSparkles, IoCheckmarkCircle, IoWarning } from 'react-icons/io5';
import type { Booking, BookingWithSlot, ServiceType, Slot } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';

type ChangeServiceTypeModalProps = {
  open: boolean;
  booking: BookingWithSlot | null;
  slots: Slot[];
  onClose: () => void;
  onConfirm: (newServiceType: ServiceType) => Promise<void>;
};

const serviceLabels: Record<string, string> = {
  manicure: 'Manicure',
  pedicure: 'Pedicure',
  mani_pedi: 'Mani + Pedi',
  home_service_2slots: 'Home Service (2 pax)',
  home_service_3slots: 'Home Service (3 pax)',
};

const serviceOptions: { value: ServiceType; label: string }[] = [
  { value: 'manicure', label: 'Manicure' },
  { value: 'pedicure', label: 'Pedicure' },
  { value: 'mani_pedi', label: 'Mani + Pedi' },
  { value: 'home_service_2slots', label: 'Home Service (2 pax)' },
  { value: 'home_service_3slots', label: 'Home Service (3 pax)' },
];

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

export function ChangeServiceTypeModal({ open, booking, slots, onClose, onConfirm }: ChangeServiceTypeModalProps) {
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open && booking) {
      setSelectedServiceType(null);
      setError(null);
    }
  }, [open, booking]);

  const currentServiceType = booking?.serviceType;
  const currentRequiredSlots = currentServiceType ? getRequiredSlotCount(currentServiceType) : 0;
  
  const slotAdjustment = useMemo(() => {
    if (!selectedServiceType || !booking) return null;
    
    const newRequiredSlots = getRequiredSlotCount(selectedServiceType);
    const difference = newRequiredSlots - currentRequiredSlots;
    
    // Get current slots
    const currentSlot = slots.find(s => s.id === booking.slotId);
    const currentLinkedSlots = booking.linkedSlotIds
      ? booking.linkedSlotIds.map(id => slots.find(s => s.id === id)).filter(Boolean) as Slot[]
      : booking.pairedSlotId
        ? slots.filter(s => s.id === booking.pairedSlotId)
        : [];
    
    const allCurrentSlots = currentSlot ? [currentSlot, ...currentLinkedSlots] : currentLinkedSlots;
    const sortedSlots = [...allCurrentSlots].sort((a, b) => a.time.localeCompare(b.time));
    const lastSlot = sortedSlots.length > 0 ? sortedSlots[sortedSlots.length - 1] : null;

    if (difference > 0) {
      // Need more slots - will add slots after the last current slot
      return {
        type: 'add' as const,
        count: difference,
        message: `Will add ${difference} additional slot${difference > 1 ? 's' : ''} after the current booking`,
        lastSlot,
      };
    } else if (difference < 0) {
      // Need fewer slots - will release extra slots
      const slotsToRelease = currentLinkedSlots.slice(-Math.abs(difference));
      return {
        type: 'remove' as const,
        count: Math.abs(difference),
        message: `Will release ${Math.abs(difference)} slot${Math.abs(difference) > 1 ? 's' : ''}`,
        slotsToRelease,
      };
    } else {
      // Same number of slots
      return {
        type: 'same' as const,
        count: 0,
        message: 'No slot changes needed',
      };
    }
  }, [selectedServiceType, currentRequiredSlots, booking, slots]);

  if (!open || !booking) return null;

  const handleConfirm = async () => {
    if (!selectedServiceType || selectedServiceType === currentServiceType) {
      return;
    }

    setIsChanging(true);
    setError(null);

    try {
      await onConfirm(selectedServiceType);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update service type');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-black rounded-lg">
              <IoSparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">Change Service Type</h3>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Update booking service and adjust slots</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={isChanging}
          >
            <IoClose className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* Current Service */}
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Current Service</p>
            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs sm:text-sm font-semibold text-slate-900">
                {serviceLabels[currentServiceType] || currentServiceType}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                {currentRequiredSlots} slot{currentRequiredSlots > 1 ? 's' : ''} required
              </p>
            </div>
          </div>

          {/* Service Options */}
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Select New Service</p>
            <div className="space-y-2">
              {serviceOptions.map((option) => {
                const isSelected = selectedServiceType === option.value;
                const isCurrent = option.value === currentServiceType;
                const requiredSlots = getRequiredSlotCount(option.value);
                
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      if (!isCurrent) {
                        setSelectedServiceType(option.value);
                        setError(null);
                      }
                    }}
                    disabled={isCurrent || isChanging}
                    className={`w-full text-left px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 transition-all ${
                      isCurrent
                        ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                        : isSelected
                          ? 'border-black bg-black text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-black hover:bg-slate-50'
                    } ${isChanging ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs sm:text-sm">{option.label}</span>
                      <span className="text-[10px] sm:text-xs text-slate-500">
                        {requiredSlots} slot{requiredSlots > 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot Adjustment Info */}
          {selectedServiceType && selectedServiceType !== currentServiceType && slotAdjustment && (
            <div className="rounded-lg border-2 p-3 sm:p-4 bg-slate-50 border-slate-300">
              <div className="flex items-start gap-2 sm:gap-3">
                {slotAdjustment.type === 'add' ? (
                  <IoCheckmarkCircle className="w-4 h-4 sm:w-5 sm:h-5 text-black flex-shrink-0 mt-0.5" />
                ) : slotAdjustment.type === 'remove' ? (
                  <IoWarning className="w-4 h-4 sm:w-5 sm:h-5 text-black flex-shrink-0 mt-0.5" />
                ) : (
                  <IoCheckmarkCircle className="w-4 h-4 sm:w-5 sm:h-5 text-black flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 mb-1">
                    {slotAdjustment.type === 'add' && 'Additional Slots Required'}
                    {slotAdjustment.type === 'remove' && 'Slots Will Be Released'}
                    {slotAdjustment.type === 'same' && 'No Slot Changes'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-600">
                    {slotAdjustment.message}
                  </p>
                  {slotAdjustment.type === 'add' && slotAdjustment.lastSlot && (
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-2">
                      After: {slotAdjustment.lastSlot.date} at {formatTime12Hour(slotAdjustment.lastSlot.time)}
                    </p>
                  )}
                  {slotAdjustment.type === 'remove' && slotAdjustment.slotsToRelease && slotAdjustment.slotsToRelease.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {slotAdjustment.slotsToRelease.map((slot) => (
                        <p key={slot.id} className="text-[10px] sm:text-xs text-slate-500">
                          • {slot.date} at {formatTime12Hour(slot.time)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border-2 p-3 sm:p-4 bg-slate-50 border-slate-300">
              <p className="text-xs sm:text-sm text-slate-900">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 p-4 sm:p-5 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={isChanging}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedServiceType || selectedServiceType === currentServiceType || isChanging}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-black text-white hover:bg-slate-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-xs sm:text-sm"
          >
            {isChanging ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Updating...</span>
              </>
            ) : (
              <>
                <IoCheckmarkCircle className="w-4 h-4" />
                <span>Confirm Change</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
