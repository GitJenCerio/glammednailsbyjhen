'use client';

import { useState, useRef, useEffect } from 'react';
import { IoNotificationsOutline, IoNotifications } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/lib/types';

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onNotificationClick: (notification: Notification) => void;
  onMarkAllRead: () => void;
}

export function NotificationBell({ 
  notifications, 
  unreadCount, 
  onNotificationClick,
  onMarkAllRead 
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'booking_created':
      case 'booking_pending':
        return '📅';
      case 'booking_confirmed':
        return '✅';
      case 'booking_cancelled':
        return '❌';
      case 'slot_added':
        return '➕';
      case 'slot_removed':
        return '➖';
      case 'slot_updated':
        return '✏️';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'booking_created':
      case 'booking_pending':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'booking_confirmed':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'booking_cancelled':
        return 'bg-rose-50 border-rose-200 text-rose-800';
      case 'slot_added':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'slot_removed':
        return 'bg-slate-50 border-slate-200 text-slate-800';
      case 'slot_updated':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  const sortedNotifications = [...notifications].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <IoNotifications className="w-6 h-6 text-slate-700" />
        ) : (
          <IoNotificationsOutline className="w-6 h-6 text-slate-500" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border-2 border-slate-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  onMarkAllRead();
                  setIsOpen(false);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {sortedNotifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                <IoNotificationsOutline className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => {
                      onNotificationClick(notification);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors border-l-4 ${
                      notification.read 
                        ? 'border-transparent' 
                        : getNotificationColor(notification.type).split(' ')[1]
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`text-sm font-semibold ${
                            notification.read ? 'text-slate-600' : 'text-slate-900'
                          }`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

