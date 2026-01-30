/**
 * Firestore Operation Logger
 * 
 * Logs Firestore operations to help identify which queries are consuming reads/writes.
 * Enable this in development to track query patterns.
 * 
 * Usage:
 *   Set ENABLE_FIRESTORE_LOGGING=true in .env.local
 */

interface LoggedOperation {
  timestamp: string;
  collection: string;
  operation: 'read' | 'write' | 'delete';
  query?: string;
  documentCount: number;
  stackTrace?: string;
}

class FirestoreLogger {
  private logs: LoggedOperation[] = [];
  private enabled: boolean;
  private maxLogs = 1000; // Keep last 1000 operations

  constructor() {
    this.enabled = process.env.ENABLE_FIRESTORE_LOGGING === 'true';
  }

  log(collection: string, operation: 'read' | 'write' | 'delete', documentCount: number, query?: string) {
    if (!this.enabled) return;

    const logEntry: LoggedOperation = {
      timestamp: new Date().toISOString(),
      collection,
      operation,
      documentCount,
      query,
    };

    // Get stack trace to identify where the query was called from
    try {
      const stack = new Error().stack;
      if (stack) {
        // Get the 3rd line (caller of the logger)
        const stackLines = stack.split('\n');
        logEntry.stackTrace = stackLines.slice(3, 6).join('\n');
      }
    } catch (e) {
      // Ignore stack trace errors
    }

    this.logs.push(logEntry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  getStats() {
    const stats: Record<string, {
      reads: number;
      writes: number;
      deletes: number;
      totalDocuments: number;
      operations: LoggedOperation[];
    }> = {};

    this.logs.forEach(log => {
      if (!stats[log.collection]) {
        stats[log.collection] = {
          reads: 0,
          writes: 0,
          deletes: 0,
          totalDocuments: 0,
          operations: [],
        };
      }

      // Update the appropriate operation counter based on operation type
      switch (log.operation) {
        case 'read':
          stats[log.collection].reads += log.documentCount;
          break;
        case 'write':
          stats[log.collection].writes += log.documentCount;
          break;
        case 'delete':
          stats[log.collection].deletes += log.documentCount;
          break;
      }
      stats[log.collection].totalDocuments += log.documentCount;
      stats[log.collection].operations.push(log);
    });

    return stats;
  }

  getTopOperations(limit = 10) {
    const stats = this.getStats();
    const allOps: Array<{ collection: string; operation: string; count: number }> = [];

    Object.entries(stats).forEach(([collection, data]) => {
      if (data.reads > 0) {
        allOps.push({ collection, operation: 'read', count: data.reads });
      }
      if (data.writes > 0) {
        allOps.push({ collection, operation: 'write', count: data.writes });
      }
      if (data.deletes > 0) {
        allOps.push({ collection, operation: 'delete', count: data.deletes });
      }
    });

    return allOps
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  exportLogs() {
    return {
      timestamp: new Date().toISOString(),
      totalOperations: this.logs.length,
      stats: this.getStats(),
      topOperations: this.getTopOperations(),
      allLogs: this.logs,
    };
  }

  clear() {
    this.logs = [];
  }
}

// Singleton instance
export const firestoreLogger = new FirestoreLogger();
