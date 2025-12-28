'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { NailTech, DayAvailability, ServiceLocationAvailability, PricingRuleType, NailTechTimeSlot } from '@/lib/types';
import { NAIL_TECH_TIME_SLOTS } from '@/lib/types';
import { formatTime12Hour } from '@/lib/utils';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

type NailTechModalProps = {
  open: boolean;
  nailTech?: NailTech | null;
  onClose: () => void;
  onSubmit: (data: Omit<NailTech, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
};

export function NailTechModal({ open, nailTech, onClose, onSubmit }: NailTechModalProps) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [serviceLocationAvailability, setServiceLocationAvailability] = useState<ServiceLocationAvailability>('both');
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [pricingRuleType, setPricingRuleType] = useState<PricingRuleType>('base_rate');
  const [pricingRuleValue, setPricingRuleValue] = useState('');
  const [hasPricingRule, setHasPricingRule] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (nailTech) {
        setFullName(nailTech.fullName);
        setRole(nailTech.role || '');
        setIsActive(nailTech.isActive);
        setServiceLocationAvailability(nailTech.serviceLocationAvailability);
        setAvailability(nailTech.availability || []);
        setHasPricingRule(!!nailTech.pricingRule);
        if (nailTech.pricingRule) {
          setPricingRuleType(nailTech.pricingRule.type);
          setPricingRuleValue(String(nailTech.pricingRule.value));
        } else {
          setPricingRuleType('base_rate');
          setPricingRuleValue('');
        }
        setNotes(nailTech.notes || '');
      } else {
        // Reset to defaults for new nail tech
        setFullName('');
        setRole('');
        setIsActive(true);
        setServiceLocationAvailability('both');
        const allSlots: NailTechTimeSlot[] = [...NAIL_TECH_TIME_SLOTS];
        setAvailability([
          { dayOfWeek: 0, enabled: false, availableSlots: [] }, // Sunday
          { dayOfWeek: 1, enabled: true, availableSlots: allSlots }, // Monday
          { dayOfWeek: 2, enabled: true, availableSlots: allSlots }, // Tuesday
          { dayOfWeek: 3, enabled: true, availableSlots: allSlots }, // Wednesday
          { dayOfWeek: 4, enabled: true, availableSlots: allSlots }, // Thursday
          { dayOfWeek: 5, enabled: true, availableSlots: allSlots }, // Friday
          { dayOfWeek: 6, enabled: true, availableSlots: allSlots }, // Saturday
        ]);
        setHasPricingRule(false);
        setPricingRuleType('base_rate');
        setPricingRuleValue('');
        setNotes('');
      }
      setErrors({});
    }
  }, [open, nailTech]);

  const updateDayAvailability = (dayOfWeek: number, updates: Partial<DayAvailability>) => {
    setAvailability((prev) =>
      prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...updates } : day))
    );
  };

  const toggleTimeSlot = (dayOfWeek: number, slot: NailTechTimeSlot) => {
    const day = availability.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return;

    const currentSlots = day.availableSlots || [];
    const isSelected = currentSlots.includes(slot);
    
    if (isSelected) {
      // Remove slot
      updateDayAvailability(dayOfWeek, {
        availableSlots: currentSlots.filter((s) => s !== slot),
        enabled: currentSlots.length > 1, // Keep enabled if there are other slots
      });
    } else {
      // Add slot
      updateDayAvailability(dayOfWeek, {
        availableSlots: [...currentSlots, slot],
        enabled: true, // Auto-enable when a slot is selected
      });
    }
  };

  const toggleAllSlotsForDay = (dayOfWeek: number) => {
    const day = availability.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return;

    const allSlots: NailTechTimeSlot[] = [...NAIL_TECH_TIME_SLOTS];
    const hasAllSlots = day.availableSlots.length === allSlots.length;

    updateDayAvailability(dayOfWeek, {
      enabled: !hasAllSlots,
      availableSlots: hasAllSlots ? [] : allSlots,
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    // Validate that at least one day has slots selected
    const hasAnyAvailability = availability.some(
      (day) => day.enabled && day.availableSlots && day.availableSlots.length > 0
    );
    if (!hasAnyAvailability) {
      newErrors.availability = 'At least one day must have time slots selected';
    }

    // Validate pricing rule
    if (hasPricingRule) {
      if (!pricingRuleValue || isNaN(Number(pricingRuleValue))) {
        newErrors.pricingRuleValue = 'Pricing rule value is required and must be a number';
      } else {
        const value = Number(pricingRuleValue);
        if (pricingRuleType === 'percentage_modifier' && (value < 0 || value > 1)) {
          newErrors.pricingRuleValue = 'Percentage must be between 0 and 1 (e.g., 0.3 for 30% off)';
        }
        if (pricingRuleType === 'base_rate' && value < 0) {
          newErrors.pricingRuleValue = 'Base rate must be positive';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const data: Omit<NailTech, 'id' | 'createdAt' | 'updatedAt'> = {
        fullName: fullName.trim(),
        role: role.trim() || undefined,
        isActive,
        serviceLocationAvailability,
        availability,
        pricingRule: hasPricingRule
          ? {
              type: pricingRuleType,
              value: Number(pricingRuleValue),
            }
          : undefined,
        notes: notes.trim() || undefined,
      };

      await onSubmit(data);
      onClose();
    } catch (error: any) {
      console.error('Failed to save nail tech:', error);
      setErrors({ submit: error.message || 'Failed to save nail tech' });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold">
            {nailTech ? 'Edit Nail Tech' : 'Add Nail Tech'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0"
                placeholder="e.g., Jane Smith"
              />
              {errors.fullName && (
                <p className="text-xs text-red-600 mt-1">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0"
                placeholder="e.g., Senior, Junior"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
              />
              <label htmlFor="isActive" className="text-sm font-semibold text-slate-700">
                Active
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Service Location Availability
              </label>
              <select
                value={serviceLocationAvailability}
                onChange={(e) => setServiceLocationAvailability(e.target.value as ServiceLocationAvailability)}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0"
              >
                <option value="studio_only">Studio Only</option>
                <option value="home_service_only">Home Service Only</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          {/* Availability */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900">Time Slot Availability</h4>
              {errors.availability && (
                <p className="text-xs text-red-600">{errors.availability}</p>
              )}
            </div>
            {DAYS_OF_WEEK.map((day) => {
              const dayAvailability = availability.find((a) => a.dayOfWeek === day.value) || {
                dayOfWeek: day.value,
                enabled: false,
                availableSlots: [],
              };
              const selectedSlots = dayAvailability.availableSlots || [];
              const allSelected = selectedSlots.length === NAIL_TECH_TIME_SLOTS.length;
              
              return (
                <div key={day.value} className="border-2 border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={dayAvailability.enabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Enable and select all slots by default
                            updateDayAvailability(day.value, {
                              enabled: true,
                              availableSlots: [...NAIL_TECH_TIME_SLOTS],
                            });
                          } else {
                            // Disable and clear all slots
                            updateDayAvailability(day.value, {
                              enabled: false,
                              availableSlots: [],
                            });
                          }
                        }}
                        className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                      />
                      <label className="text-sm font-semibold text-slate-700">
                        {day.label}
                      </label>
                    </div>
                    {dayAvailability.enabled && (
                      <button
                        type="button"
                        onClick={() => toggleAllSlotsForDay(day.value)}
                        className="text-xs text-slate-600 hover:text-slate-900 underline"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  {dayAvailability.enabled && (
                    <div className="ml-7 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {NAIL_TECH_TIME_SLOTS.map((slot) => {
                        const isSelected = selectedSlots.includes(slot);
                        return (
                          <label
                            key={slot}
                            className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition ${
                              isSelected
                                ? 'border-slate-900 bg-slate-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTimeSlot(day.value, slot)}
                              className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                            />
                            <span className="text-sm font-medium text-slate-700">
                              {formatTime12Hour(slot)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pricing Rule */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="hasPricingRule"
                checked={hasPricingRule}
                onChange={(e) => setHasPricingRule(e.target.checked)}
                className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
              />
              <label htmlFor="hasPricingRule" className="text-sm font-semibold text-slate-700">
                Set Custom Pricing Rule
              </label>
            </div>

            {hasPricingRule && (
              <div className="ml-7 space-y-3 border-2 border-slate-200 rounded-xl p-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Pricing Rule Type
                  </label>
                  <select
                    value={pricingRuleType}
                    onChange={(e) => setPricingRuleType(e.target.value as PricingRuleType)}
                    className="w-full rounded-xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0"
                  >
                    <option value="base_rate">Base Rate</option>
                    <option value="percentage_modifier">Percentage Modifier</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {pricingRuleType === 'base_rate' ? 'Base Rate (₱)' : 'Percentage (0-1, e.g., 0.3 for 30% off)'}
                  </label>
                  <input
                    type="number"
                    step={pricingRuleType === 'percentage_modifier' ? '0.01' : '1'}
                    value={pricingRuleValue}
                    onChange={(e) => setPricingRuleValue(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0"
                    placeholder={pricingRuleType === 'base_rate' ? 'e.g., 500' : 'e.g., 0.3'}
                  />
                  {errors.pricingRuleValue && (
                    <p className="text-xs text-red-600 mt-1">{errors.pricingRuleValue}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border-2 border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:ring-0"
              placeholder="Optional notes for internal use..."
            />
          </div>

          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-full border-2 border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-full bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? 'Saving...' : nailTech ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
