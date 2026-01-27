'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import type { UserRole, UserPermissions } from '@/lib/types';
import { getUserPermissions } from '@/lib/types';

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [nailTechId, setNailTechId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setRole(null);
          setPermissions(null);
          setNailTechId(null);
          setLoading(false);
          return;
        }

        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/users/${currentUser.uid}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const userRole: UserRole = data.user?.role || 'viewer';
          setRole(userRole);
          setPermissions(getUserPermissions(userRole));
          setNailTechId(data.user?.nailTechId || null);
        } else {
          // Default to viewer if API fails
          setRole('viewer');
          setPermissions(getUserPermissions('viewer'));
          setNailTechId(null);
        }
      } catch (error) {
        console.error('Error loading user role:', error);
        // Default to viewer on error
        setRole('viewer');
        setPermissions(getUserPermissions('viewer'));
        setNailTechId(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserRole();

    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged(() => {
      loadUserRole();
    });

    return () => unsubscribe();
  }, []);

  return { role, permissions, nailTechId, loading };
}

