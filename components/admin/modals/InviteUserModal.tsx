'use client';

import { useState, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import type { UserRole } from '@/lib/types';

type InviteUserModalProps = {
  open: boolean;
  onClose: () => void;
  onInvite: (data: { email: string; password?: string; displayName?: string; sendInviteEmail: boolean; role: UserRole }) => Promise<void>;
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Full access to all features and user management',
  manager: 'Can manage bookings, customers, and services (no user management)',
  staff: 'Can manage bookings and customers only',
  viewer: 'Read-only access to view data (cannot make changes)',
};

export function InviteUserModal({ open, onClose, onInvite }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [sendInviteEmail, setSendInviteEmail] = useState(false);
  const [role, setRole] = useState<UserRole>('viewer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordOption, setPasswordOption] = useState<'manual' | 'google-only'>('manual');

  useEffect(() => {
    if (open) {
      setEmail('');
      setDisplayName('');
      setPassword('');
      setSendInviteEmail(false);
      setPasswordOption('manual');
      setRole('viewer');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email) {
      setError('Email is required');
      return;
    }

    if (passwordOption === 'manual' && !password) {
      setError('Password is required when creating account with email/password');
      return;
    }

    if (password && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      await onInvite({
        email,
        displayName: displayName || undefined,
        password: passwordOption === 'manual' ? password : undefined,
        sendInviteEmail,
        role,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to invite user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Invite User</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <IoClose className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-1">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="Optional"
            />
            <p className="text-xs text-slate-500 mt-1">If not provided, will use email username</p>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            >
              <option value="viewer">Viewer - Read-only access</option>
              <option value="staff">Staff - Manage bookings & customers</option>
              <option value="manager">Manager - Manage bookings, customers, services</option>
              <option value="admin">Admin - Full access</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">{ROLE_DESCRIPTIONS[role]}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Sign-in Method
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="passwordOption"
                  value="manual"
                  checked={passwordOption === 'manual'}
                  onChange={(e) => setPasswordOption(e.target.value as 'manual' | 'google-only')}
                  className="w-4 h-4 text-black focus:ring-black"
                />
                <span className="text-sm text-slate-700">Email/Password (set password now)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="passwordOption"
                  value="google-only"
                  checked={passwordOption === 'google-only'}
                  onChange={(e) => setPasswordOption(e.target.value as 'manual' | 'google-only')}
                  className="w-4 h-4 text-black focus:ring-black"
                />
                <span className="text-sm text-slate-700">Google Sign-in only (no password)</span>
              </label>
            </div>
          </div>

          {passwordOption === 'manual' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={passwordOption === 'manual'}
                minLength={6}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="At least 6 characters"
              />
            </div>
          )}

          {passwordOption === 'manual' && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendInviteEmail}
                  onChange={(e) => setSendInviteEmail(e.target.checked)}
                  className="w-4 h-4 text-black focus:ring-black rounded"
                />
                <span className="text-sm text-slate-700">Send password reset email (invitation)</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                User will receive an email to set their password
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-black text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Inviting...' : 'Invite User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

