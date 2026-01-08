'use client';

import { useState, useRef, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { IoLogOutOutline, IoPersonCircleOutline, IoMenu, IoClose } from 'react-icons/io5';
import { NotificationBell } from './NotificationBell';
import type { Notification } from '@/lib/types';

interface AdminHeaderProps {
  notifications: Notification[];
  unreadCount: number;
  onNotificationClick: (notification: Notification) => void;
  onMarkAllRead: () => void;
  onLogout: () => void;
}

export function AdminHeader({
  notifications,
  unreadCount,
  onNotificationClick,
  onMarkAllRead,
  onLogout,
  sidebarCollapsed = false,
  mobileMenuOpen = false,
  onMobileMenuToggle,
}: AdminHeaderProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileMenuOpen]);

  const user = auth.currentUser;
  const userEmail = user?.email || 'Admin';
  const displayName = userEmail.split('@')[0];

  // Calculate left position based on sidebar state
  // On mobile (no sidebar), header starts at left-0
  // On desktop, header starts after sidebar
  const leftPosition = sidebarCollapsed 
    ? 'left-0 sm:left-14 sm:left-16' 
    : 'left-0 sm:left-40 md:left-48 lg:left-56 xl:left-72';

  return (
    <header className={`fixed top-0 ${leftPosition} right-0 z-50 bg-white border-b border-slate-200 shadow-sm`}>
      <div className="px-3 sm:px-4 md:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
        {/* Left side: Mobile Menu Button */}
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <IoClose className="w-6 h-6" />
            ) : (
              <IoMenu className="w-6 h-6" />
            )}
          </button>
        )}

        {/* Right side: Profile Menu and Notification Bell */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          {/* Profile Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Profile menu"
            >
              <IoPersonCircleOutline className="w-6 h-6 text-slate-600" />
              <span className="hidden sm:inline text-sm font-medium text-slate-700">
                {displayName}
              </span>
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border-2 border-slate-200 z-50">
                <div className="p-4 border-b border-slate-200">
                  <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{userEmail}</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      onLogout();
                      setProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <IoLogOutOutline className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onNotificationClick={onNotificationClick}
            onMarkAllRead={onMarkAllRead}
          />
        </div>
      </div>
    </header>
  );
}

