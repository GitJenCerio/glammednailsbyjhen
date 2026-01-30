/**
 * Client-side analytics event batching to reduce Firestore writes.
 * 
 * Batches events and flushes when:
 * - Queue reaches 10 events, or
 * - 30 seconds have passed
 * 
 * This reduces individual writes from potentially hundreds per session to just a few batch writes.
 */

interface AnalyticsEvent {
  [key: string]: any;
  createdAt?: string;
}

class AnalyticsBatchTracker {
  private queue: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private isFlushing = false;

  /**
   * Add an event to the batch queue.
   * Automatically flushes if batch size is reached.
   */
  track(event: AnalyticsEvent): void {
    // Add timestamp if not provided
    if (!event.createdAt) {
      event.createdAt = new Date().toISOString();
    }

    this.queue.push(event);

    // Flush if batch size reached
    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
      return;
    }

    // Start timer if this is the first event
    if (this.queue.length === 1 && !this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.FLUSH_INTERVAL);
    }
  }

  /**
   * Flush all queued events to the server.
   * Uses batch API endpoint to write all events in a single Firestore batch write.
   */
  private async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;

    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Copy and clear queue
    const eventsToSend = [...this.queue];
    this.queue = [];

    try {
      const response = await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: eventsToSend }),
      });

      if (!response.ok) {
        console.error('Failed to send analytics batch:', await response.text());
        // Re-queue events on failure (optional - could lose events on persistent failures)
        // For now, we'll drop them to prevent infinite retry loops
      }
    } catch (error) {
      console.error('Error sending analytics batch:', error);
      // Events are dropped on error to prevent queue buildup
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Manually flush remaining events.
   * Useful when page is unloading.
   */
  async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

// Singleton instance
export const analyticsBatchTracker = new AnalyticsBatchTracker();

// Flush on page unload to avoid losing events
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Use sendBeacon for reliable delivery on page unload
    if (analyticsBatchTracker['queue'].length > 0) {
      const events = analyticsBatchTracker['queue'];
      navigator.sendBeacon(
        '/api/analytics/batch',
        JSON.stringify({ events })
      );
    }
  });
}
