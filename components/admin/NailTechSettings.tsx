'use client';

import { useState, useEffect } from 'react';
import type { NailTech } from '@/lib/types';
import { NailTechModal } from './modals/NailTechModal';

export function NailTechSettings() {
  const [nailTechs, setNailTechs] = useState<NailTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNailTech, setEditingNailTech] = useState<NailTech | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadNailTechs();
  }, []);

  async function loadNailTechs() {
    try {
      setLoading(true);
      const res = await fetch('/api/nail-techs');
      const data = await res.json();
      if (res.ok) {
        setNailTechs(data.nailTechs || []);
      } else {
        setToast(`Failed to load nail techs: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Failed to load nail techs:', error);
      setToast('Failed to load nail techs');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: Omit<NailTech, 'id' | 'createdAt' | 'updatedAt'>) {
    const res = await fetch('/api/nail-techs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create nail tech');
    }

    await loadNailTechs();
    setToast('Nail tech created successfully');
  }

  async function handleUpdate(id: string, data: Partial<Omit<NailTech, 'id' | 'createdAt' | 'updatedAt'>>) {
    const res = await fetch(`/api/nail-techs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to update nail tech');
    }

    await loadNailTechs();
    setToast('Nail tech updated successfully');
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this nail tech? This action cannot be undone.')) {
      return;
    }

    const res = await fetch(`/api/nail-techs/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const error = await res.json();
      setToast(`Failed to delete: ${error.error}`);
      return;
    }

    await loadNailTechs();
    setToast('Nail tech deleted successfully');
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    await handleUpdate(id, { isActive: !currentStatus });
  }

  function handleEdit(nailTech: NailTech) {
    setEditingNailTech(nailTech);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditingNailTech(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingNailTech(null);
  }

  async function handleModalSubmit(data: Omit<NailTech, 'id' | 'createdAt' | 'updatedAt'>) {
    if (editingNailTech) {
      await handleUpdate(editingNailTech.id, data);
    } else {
      await handleCreate(data);
    }
  }

  const formatAvailability = (nailTech: NailTech): string => {
    const enabledDays = nailTech.availability
      .filter((day) => day.enabled && day.availableSlots && day.availableSlots.length > 0)
      .map((day) => {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const slotCount = day.availableSlots?.length || 0;
        return `${dayNames[day.dayOfWeek]} (${slotCount} slots)`;
      });
    return enabledDays.length > 0 ? enabledDays.join(', ') : 'No availability';
  };

  const formatPricingRule = (nailTech: NailTech): string => {
    if (!nailTech.pricingRule) return 'Standard pricing';
    if (nailTech.pricingRule.type === 'base_rate') {
      return `Base: ₱${nailTech.pricingRule.value.toLocaleString('en-PH')}`;
    } else {
      const percentage = (nailTech.pricingRule.value * 100).toFixed(0);
      return `${percentage}% off`;
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700 flex items-center justify-between gap-2">
          <span className="flex-1">{toast}</span>
          <button className="text-xs uppercase font-semibold" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Nail Tech Settings</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage nail technicians, their availability, and pricing rules
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Add Nail Tech
        </button>
      </div>

      {nailTechs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 mb-4">No nail techs yet.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={async () => {
                try {
                  // Quick add Ms. Jhen with default settings
                  const msJhenData = {
                    fullName: 'Ms. Jhen',
                    role: 'Senior',
                    isActive: true,
                    serviceLocationAvailability: 'both' as const,
                    availability: [
                      { dayOfWeek: 0, enabled: false, availableSlots: [] },
                      { dayOfWeek: 1, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] },
                      { dayOfWeek: 2, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] },
                      { dayOfWeek: 3, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] },
                      { dayOfWeek: 4, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] },
                      { dayOfWeek: 5, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] },
                      { dayOfWeek: 6, enabled: true, availableSlots: ['08:00', '10:30', '13:00', '15:30', '19:00', '21:00'] },
                    ],
                    notes: 'Primary nail technician and owner',
                  };
                  await handleCreate(msJhenData);
                  setToast('Ms. Jhen added successfully!');
                } catch (error: any) {
                  setToast(`Failed to add Ms. Jhen: ${error.message}`);
                }
              }}
              className="rounded-full bg-rose-600 px-6 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Quick Add: Ms. Jhen
            </button>
            <button
              onClick={handleAdd}
              className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Add Custom Nail Tech
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {nailTechs.map((nailTech) => (
            <div
              key={nailTech.id}
              className={`rounded-2xl border-2 ${
                nailTech.isActive ? 'border-slate-300' : 'border-slate-200 opacity-60'
              } bg-white p-6 shadow-lg shadow-slate-200/50`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-slate-900">{nailTech.fullName}</h3>
                    {nailTech.role && (
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {nailTech.role}
                      </span>
                    )}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        nailTech.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {nailTech.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Service Location</p>
                      <p className="font-medium text-slate-900">
                        {nailTech.serviceLocationAvailability === 'studio_only'
                          ? 'Studio Only'
                          : nailTech.serviceLocationAvailability === 'home_service_only'
                          ? 'Home Service Only'
                          : 'Both'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Availability</p>
                      <p className="font-medium text-slate-900">{formatAvailability(nailTech)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Pricing Rule</p>
                      <p className="font-medium text-slate-900">{formatPricingRule(nailTech)}</p>
                    </div>
                  </div>

                  {nailTech.notes && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Notes</p>
                      <p className="text-sm text-slate-700">{nailTech.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(nailTech.id, nailTech.isActive)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold ${
                      nailTech.isActive
                        ? 'border-2 border-amber-300 text-amber-700 hover:bg-amber-50'
                        : 'border-2 border-green-300 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {nailTech.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleEdit(nailTech)}
                    className="px-4 py-2 rounded-full border-2 border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(nailTech.id)}
                    className="px-4 py-2 rounded-full border-2 border-red-300 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NailTechModal
        open={modalOpen}
        nailTech={editingNailTech}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}

