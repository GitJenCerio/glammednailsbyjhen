import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, orderBy, getDocs, updateDoc, doc, Timestamp, onSnapshot, limit } from 'firebase/firestore';
import type { Notification, NotificationType } from '@/lib/types';

const notificationsCollection = collection(db, 'notifications');

export async function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: string,
  relatedType?: 'booking' | 'slot',
  section?: string
): Promise<string> {
  const now = Timestamp.now().toDate().toISOString();
  
  const notificationData = {
    type,
    title,
    message,
    read: false,
    relatedId: relatedId || null,
    relatedType: relatedType || null,
    section: section || null,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(notificationsCollection, notificationData);
  return docRef.id;
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notificationRef = doc(db, 'notifications', notificationId);
  await updateDoc(notificationRef, {
    read: true,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const q = query(notificationsCollection, where('read', '==', false));
  const snapshot = await getDocs(q);
  
  const updates = snapshot.docs.map((docSnap) => 
    updateDoc(doc(db, 'notifications', docSnap.id), {
      read: true,
      updatedAt: Timestamp.now().toDate().toISOString(),
    })
  );
  
  await Promise.all(updates);
}

export async function getNotifications(limitCount: number = 50): Promise<Notification[]> {
  const q = query(
    notificationsCollection,
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  } as Notification));
}

export function subscribeToNotifications(
  callback: (notifications: Notification[]) => void,
  limitCount: number = 50
): () => void {
  const q = query(
    notificationsCollection,
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as Notification));
    callback(notifications);
  });
}

// Helper functions to create specific notification types
export async function notifyBookingCreated(bookingId: string, customerName: string, slotDate: string, slotTime: string): Promise<void> {
  await createNotification(
    'booking_created',
    'New Booking Created',
    `${customerName} booked a slot on ${slotDate} at ${slotTime}`,
    bookingId,
    'booking',
    'bookings'
  );
}

export async function notifyBookingPending(bookingId: string, customerName: string): Promise<void> {
  await createNotification(
    'booking_pending',
    'Booking Pending Payment',
    `${customerName}'s booking is pending payment`,
    bookingId,
    'booking',
    'bookings'
  );
}

export async function notifyBookingConfirmed(bookingId: string, customerName: string): Promise<void> {
  await createNotification(
    'booking_confirmed',
    'Booking Confirmed',
    `${customerName}'s booking has been confirmed`,
    bookingId,
    'booking',
    'bookings'
  );
}

export async function notifyBookingCancelled(bookingId: string, customerName: string): Promise<void> {
  await createNotification(
    'booking_cancelled',
    'Booking Cancelled',
    `${customerName}'s booking has been cancelled`,
    bookingId,
    'booking',
    'bookings'
  );
}

export async function notifySlotAdded(slotId: string, slotDate: string, slotTime: string): Promise<void> {
  await createNotification(
    'slot_added',
    'Slot Added',
    `New slot added: ${slotDate} at ${slotTime}`,
    slotId,
    'slot',
    'bookings'
  );
}

export async function notifySlotRemoved(slotId: string, slotDate: string, slotTime: string): Promise<void> {
  await createNotification(
    'slot_removed',
    'Slot Removed',
    `Slot removed: ${slotDate} at ${slotTime}`,
    slotId,
    'slot',
    'bookings'
  );
}

export async function notifySlotUpdated(slotId: string, slotDate: string, slotTime: string): Promise<void> {
  await createNotification(
    'slot_updated',
    'Slot Updated',
    `Slot updated: ${slotDate} at ${slotTime}`,
    slotId,
    'slot',
    'bookings'
  );
}

