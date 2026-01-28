'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import type { User, UserRole, NailTech } from '@/lib/types';
import { InviteUserModal } from './modals/InviteUserModal';
import { IoPersonAdd, IoTrash, IoCheckmarkCircle, IoCloseCircle, IoMail } from 'react-icons/io5';
import { format } from 'date-fns';

export function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [nailTechs, setNailTechs] = useState<NailTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    loadUsers();
    loadNailTechs();
  }, []);

  const loadNailTechs = async () => {
    try {
      const response = await fetch('/api/nail-techs');
      if (response.ok) {
        const data = await response.json();
        setNailTechs(data.nailTechs || []);
      }
    } catch (err) {
      console.error('Error loading nail techs:', err);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (inviteData: {
    email: string;
    password?: string;
    displayName?: string;
    sendInviteEmail: boolean;
    role: UserRole;
  }) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(inviteData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to invite user');
    }

    // Reload users list
    await loadUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingUserId(userId);
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/users?userId=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      // Reload users list
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
      console.error('Error deleting user:', err);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleToggleDisabled = async (user: User) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/users/${user.uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          disabled: !user.disabled,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }

      // Reload users list
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
      console.error('Error updating user:', err);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user role');
      }

      // Reload users list
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
      console.error('Error updating user role:', err);
    }
  };

  const handleNailTechChange = async (userId: string, nailTechId: string | null) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nailTechId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user nail tech assignment');
      }

      // Reload users list
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update nail tech assignment');
      console.error('Error updating nail tech assignment:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">Loading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-600 mt-1">Manage admin users and invitations</p>
        </div>
        <button
          onClick={() => setInviteModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-black text-white font-medium rounded-lg hover:bg-slate-800 transition-colors w-full sm:w-auto"
        >
          <IoPersonAdd className="w-5 h-5" />
          <span className="sm:inline">Invite User</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Assigned Nail Tech
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Sign-in Methods
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Last Sign-in
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No users found. Invite your first user to get started.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isCurrentUser = user.uid === currentUser?.uid;
                  const hasEmailPassword = user.providerData?.some(p => p.providerId === 'password');
                  const hasGoogle = user.providerData?.some(p => p.providerId === 'google.com');

                  return (
                    <tr key={user.uid} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {user.displayName || user.email.split('@')[0]}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-slate-500">(You)</span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {user.disabled ? (
                            <>
                              <IoCloseCircle className="w-5 h-5 text-red-500" />
                              <span className="text-sm text-red-600">Disabled</span>
                            </>
                          ) : (
                            <>
                              <IoCheckmarkCircle className="w-5 h-5 text-green-500" />
                              <span className="text-sm text-green-600">Active</span>
                            </>
                          )}
                        </div>
                        {!user.emailVerified && (
                          <div className="text-xs text-amber-600 mt-1">Email not verified</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role || 'viewer'}
                          onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                          disabled={isCurrentUser}
                          className="text-sm px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="staff">Staff</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.role === 'staff' ? (
                          <select
                            value={user.nailTechId || ''}
                            onChange={(e) => handleNailTechChange(user.uid, e.target.value || null)}
                            className="text-sm px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                          >
                            <option value="">Not assigned</option>
                            {nailTechs.map((tech) => (
                              <option key={tech.id} value={tech.id}>
                                Ms. {tech.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-2">
                          {hasEmailPassword && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                              <IoMail className="w-3 h-3" />
                              Email
                            </span>
                          )}
                          {hasGoogle && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                              <svg className="w-3 h-3" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                              Google
                            </span>
                          )}
                          {!hasEmailPassword && !hasGoogle && (
                            <span className="text-xs text-slate-500">No methods</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {user.lastSignInTime ? format(new Date(user.lastSignInTime), 'MMM d, yyyy') : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleDisabled(user)}
                            disabled={isCurrentUser}
                            className="text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={user.disabled ? 'Enable user' : 'Disable user'}
                          >
                            {user.disabled ? (
                              <IoCheckmarkCircle className="w-5 h-5" />
                            ) : (
                              <IoCloseCircle className="w-5 h-5" />
                            )}
                          </button>
                          {!isCurrentUser && (
                            <button
                              onClick={() => handleDelete(user.uid)}
                              disabled={deletingUserId === user.uid}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete user"
                            >
                              <IoTrash className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {users.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-slate-500">
            No users found. Invite your first user to get started.
          </div>
        ) : (
          users.map((user) => {
            const isCurrentUser = user.uid === currentUser?.uid;
            const hasEmailPassword = user.providerData?.some(p => p.providerId === 'password');
            const hasGoogle = user.providerData?.some(p => p.providerId === 'google.com');

            return (
              <div key={user.uid} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-slate-900 truncate">
                        {user.displayName || user.email.split('@')[0]}
                      </h3>
                      {isCurrentUser && (
                        <span className="text-xs text-slate-500 flex-shrink-0">(You)</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <button
                      onClick={() => handleToggleDisabled(user)}
                      disabled={isCurrentUser}
                      className="text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed p-1"
                      title={user.disabled ? 'Enable user' : 'Disable user'}
                    >
                      {user.disabled ? (
                        <IoCloseCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <IoCheckmarkCircle className="w-5 h-5 text-green-500" />
                      )}
                    </button>
                    {!isCurrentUser && (
                      <button
                        onClick={() => handleDelete(user.uid)}
                        disabled={deletingUserId === user.uid}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed p-1"
                        title="Delete user"
                      >
                        <IoTrash className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {user.disabled ? (
                    <>
                      <IoCloseCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-xs text-red-600">Disabled</span>
                    </>
                  ) : (
                    <>
                      <IoCheckmarkCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-green-600">Active</span>
                    </>
                  )}
                  {!user.emailVerified && (
                    <span className="text-xs text-amber-600 ml-2">• Email not verified</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={user.role || 'viewer'}
                    onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                    disabled={isCurrentUser}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {user.role === 'staff' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Nail Tech</label>
                    <select
                      value={user.nailTechId || ''}
                      onChange={(e) => handleNailTechChange(user.uid, e.target.value || null)}
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="">Not assigned</option>
                      {nailTechs.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          Ms. {tech.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sign-in Methods</label>
                  <div className="flex flex-wrap gap-2">
                    {hasEmailPassword && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        <IoMail className="w-3 h-3" />
                        Email
                      </span>
                    )}
                    {hasGoogle && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        <svg className="w-3 h-3" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Google
                      </span>
                    )}
                    {!hasEmailPassword && !hasGoogle && (
                      <span className="text-xs text-slate-500">No methods</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Created</label>
                    <p className="text-xs text-slate-500">
                      {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Last Sign-in</label>
                    <p className="text-xs text-slate-500">
                      {user.lastSignInTime ? format(new Date(user.lastSignInTime), 'MMM d, yyyy') : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <InviteUserModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvite={handleInvite}
      />
    </div>
  );
}

