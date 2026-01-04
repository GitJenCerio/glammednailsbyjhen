'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { NailTech } from '@/lib/types';
import { formatNailTechName } from '@/lib/utils';
import { IoAdd, IoPencil, IoTrash, IoCheckmark, IoClose } from 'react-icons/io5';

interface NailTechManagerProps {
  onNailTechChange?: (nailTechId: string | null) => void;
  selectedNailTechId?: string | null;
}

export function NailTechManager({ onNailTechChange, selectedNailTechId }: NailTechManagerProps) {
  const [nailTechs, setNailTechs] = useState<NailTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTech, setEditingTech] = useState<NailTech | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadNailTechs();
  }, []);

  async function loadNailTechs() {
    try {
      const res = await fetch('/api/nail-techs');
      const data = await res.json();
      setNailTechs(data.nailTechs || []);
    } catch (error) {
      console.error('Failed to load nail techs', error);
      setToast('Failed to load nail technicians.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(techData: Partial<NailTech>) {
    try {
      if (editingTech) {
        const res = await fetch(`/api/nail-techs/${editingTech.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(techData),
        });
        if (!res.ok) throw new Error('Failed to update');
        setToast('Nail technician updated.');
      } else {
        const res = await fetch('/api/nail-techs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(techData),
        });
        if (!res.ok) throw new Error('Failed to create');
        setToast('Nail technician created.');
      }
      await loadNailTechs();
      setEditingTech(null);
      setIsCreating(false);
    } catch (error: any) {
      setToast(`Error: ${error.message || 'Failed to save'}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to deactivate this nail technician?')) return;
    try {
      const res = await fetch(`/api/nail-techs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to deactivate');
      setToast('Nail technician deactivated.');
      await loadNailTechs();
    } catch (error: any) {
      setToast(`Error: ${error.message || 'Failed to deactivate'}`);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {toast && (
        <div className="rounded-xl sm:rounded-2xl bg-emerald-50 px-3 sm:px-4 py-2 text-xs sm:text-sm text-emerald-700 flex items-center justify-between gap-2">
          <span className="flex-1">{toast}</span>
          <button className="text-xs uppercase font-semibold touch-manipulation" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Nail Technicians</h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">Manage your team of nail technicians</p>
        </div>
        <button
          onClick={() => {
            setIsCreating(true);
            setEditingTech(null);
          }}
          className="flex items-center gap-2 rounded-full bg-green-300 px-4 sm:px-6 py-2 text-xs sm:text-sm font-semibold text-green-800 hover:bg-green-400 touch-manipulation"
        >
          <IoAdd className="w-4 h-4" />
          <span className="hidden sm:inline">Add Technician</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {(editingTech || isCreating) && (
        <NailTechForm
          tech={editingTech}
          onSave={handleSave}
          onCancel={() => {
            setEditingTech(null);
            setIsCreating(false);
          }}
        />
      )}

      <div className="grid gap-3 sm:gap-4">
        {nailTechs.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">No nail technicians yet. Create one to get started.</p>
          </div>
        ) : (
          nailTechs.map((tech) => (
            <NailTechCard
              key={tech.id}
              tech={tech}
              isSelected={selectedNailTechId === tech.id}
              onSelect={() => onNailTechChange?.(tech.id)}
              onEdit={() => {
                setEditingTech(tech);
                setIsCreating(false);
              }}
              onDelete={() => handleDelete(tech.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NailTechCard({
  tech,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  tech: NailTech;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 ${
        isSelected ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-white'
      } p-4 sm:p-6 shadow-lg shadow-slate-200/50`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900">{formatNailTechName(tech.name)}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                tech.status === 'Active'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {tech.status}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              {tech.role}
            </span>
          </div>
          <div className="space-y-1 text-xs sm:text-sm text-slate-600">
            <p>
              <strong>Service Availability:</strong> {tech.serviceAvailability}
            </p>
            <p>
              <strong>Working Days:</strong> {tech.workingDays.join(', ')}
            </p>
            {tech.discount && (
              <p>
                <strong>Service Discount:</strong> {tech.discount}% discount
              </p>
            )}
            {tech.commissionRate && (
              <p>
                <strong>Commission Rate:</strong> {(tech.commissionRate * 100).toFixed(0)}%
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {onSelect && (
            <button
              onClick={onSelect}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isSelected
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isSelected ? 'Selected' : 'Select'}
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
            title="Edit"
          >
            <IoPencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 transition"
            title="Deactivate"
          >
            <IoTrash className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function NailTechForm({
  tech,
  onSave,
  onCancel,
}: {
  tech: NailTech | null;
  onSave: (data: Partial<NailTech>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<NailTech>>({
    name: tech?.name || '',
    role: tech?.role || 'Junior Tech',
    serviceAvailability: tech?.serviceAvailability || 'Studio and Home Service',
    workingDays: tech?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    discount: tech?.discount || undefined,
    commissionRate: tech?.commissionRate || undefined,
    status: tech?.status || 'Active',
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-6 shadow-lg"
    >
      <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4">
        {tech ? 'Edit Nail Technician' : 'Add New Nail Technician'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Jhen"
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <p className="mt-1 text-xs text-slate-500">&quot;Ms.&quot; will be added automatically</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'Owner' | 'Junior Tech' | 'Senior Tech' })}
              className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="Owner">Owner</option>
              <option value="Junior Tech">Junior Tech</option>
              <option value="Senior Tech">Senior Tech</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
              className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Service Availability</label>
          <select
            value={formData.serviceAvailability}
            onChange={(e) =>
              setFormData({
                ...formData,
                serviceAvailability: e.target.value as 'Studio only' | 'Home service only' | 'Studio and Home Service',
              })
            }
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="Studio only">Studio only</option>
            <option value="Home service only">Home service only</option>
            <option value="Studio and Home Service">Studio and Home Service</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Working Days</label>
          <div className="flex flex-wrap gap-2">
            {daysOfWeek.map((day) => (
              <label key={day} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.workingDays?.includes(day)}
                  onChange={(e) => {
                    const currentDays = formData.workingDays || [];
                    if (e.target.checked) {
                      setFormData({ ...formData, workingDays: [...currentDays, day] });
                    } else {
                      setFormData({
                        ...formData,
                        workingDays: currentDays.filter((d) => d !== day),
                      });
                    }
                  }}
                  className="rounded border-2 border-slate-300"
                />
                <span className="text-sm text-slate-700">{day.substring(0, 3)}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Service Discount (optional, e.g., 15 for 15% discount)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={formData.discount || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                discount: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            placeholder="15"
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <p className="mt-1 text-xs text-slate-500">
            Enter a percentage discount this nail tech offers on services (e.g., 15 for 15% off)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Commission Rate (optional, e.g., 0.3 for 30%)
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={formData.commissionRate || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                commissionRate: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            placeholder="0.3"
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <p className="mt-1 text-xs text-slate-500">
            Enter the commission rate as a decimal (e.g., 0.3 for 30% commission)
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition"
          >
            <IoCheckmark className="w-5 h-5" />
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
          >
            <IoClose className="w-5 h-5" />
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

