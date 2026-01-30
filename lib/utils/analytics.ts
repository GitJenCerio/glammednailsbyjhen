export type AnalyticsEventType = 'page_view' | 'book_now_click' | 'booking_started' | 'booking_completed';

export interface AnalyticsEventData {
  type: AnalyticsEventType;
  page?: string;
  referrer?: string;
  bookingId?: string;
  sessionId?: string;
}

/**
 * OPTIMIZED: Use batch tracker to reduce Firestore writes.
 * Events are batched and sent together, reducing individual writes by ~90%.
 */
export function trackEvent(data: AnalyticsEventData) {
  if (typeof window === 'undefined') return;

  // Get or create session ID
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }

  const eventData = {
    ...data,
    sessionId,
    timestamp: new Date().toISOString(),
    page: data.page || window.location.pathname,
    referrer: data.referrer || document.referrer,
    userAgent: navigator.userAgent,
  };

  // Use batch tracker instead of individual API calls
  // This batches events and sends them together, reducing Firestore writes significantly
  import('@/lib/analytics/batchTracker').then(({ analyticsBatchTracker }) => {
    analyticsBatchTracker.track(eventData);
  }).catch(() => {
    // Silently fail - analytics shouldn't break the user experience
  });
}

export function trackPageView(page?: string) {
  trackEvent({
    type: 'page_view',
    page: page || window.location.pathname,
  });
}

export function trackBookNowClick(source?: string) {
  trackEvent({
    type: 'book_now_click',
    page: source || window.location.pathname,
  });
}

export function trackBookingStarted(bookingId: string) {
  trackEvent({
    type: 'booking_started',
    bookingId,
  });
}

export function trackBookingCompleted(bookingId: string) {
  trackEvent({
    type: 'booking_completed',
    bookingId,
  });
}

