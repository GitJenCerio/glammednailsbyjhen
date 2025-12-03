import { adminDb } from '../firebaseAdmin';
import type { AnalyticsEvent } from '../types';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export type TimeRange = 'today' | 'week' | 'month' | 'year';

function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const now = new Date();
  
  switch (range) {
    case 'today':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case 'month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    case 'year':
      return {
        start: startOfYear(now),
        end: endOfYear(now),
      };
    default:
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
  }
}

export async function listAnalyticsEvents(range: TimeRange): Promise<AnalyticsEvent[]> {
  const { start } = getDateRange(range);
  
  const snapshot = await adminDb
    .collection('analytics_events')
    .where('timestamp', '>=', start.toISOString())
    .orderBy('timestamp', 'desc')
    .get();
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as AnalyticsEvent));
}

export interface WebAnalyticsStats {
  pageViews: number;
  bookNowClicks: number;
  bookingStarts: number;
  bookingCompletions: number;
}

export async function getWebAnalyticsStats(range: TimeRange): Promise<WebAnalyticsStats> {
  const events = await listAnalyticsEvents(range);
  
  const pageViews = events.filter((e) => e.type === 'page_view').length;
  const bookNowClicks = events.filter((e) => e.type === 'book_now_click').length;
  const bookingStarts = events.filter((e) => e.type === 'booking_started').length;
  const bookingCompletions = events.filter((e) => e.type === 'booking_completed').length;
  
  return {
    pageViews,
    bookNowClicks,
    bookingStarts,
    bookingCompletions,
  };
}

