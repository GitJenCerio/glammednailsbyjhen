import admin from 'firebase-admin';

let adminDbInstance: admin.firestore.Firestore | null = null;

function initializeAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error('Missing Firebase Admin environment variables.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

function getAdminDb(): admin.firestore.Firestore {
  if (!adminDbInstance) {
    // Check if Firebase env vars are available before initializing
    // During build (especially in CI), these may not be set
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      // If env vars are missing, we're likely in a build environment
      // Return a mock object that satisfies TypeScript but throws at runtime if actually used
      throw new Error('Firebase Admin cannot be initialized: environment variables are missing. This is expected during build. The actual initialization will happen at runtime when the API route is called.');
    }
    initializeAdmin();
    adminDbInstance = admin.firestore();
  }
  return adminDbInstance;
}

// Export a getter function to defer initialization until runtime
export function getAdminDbInstance(): admin.firestore.Firestore {
  return getAdminDb();
}

// Create a build-safe mock that satisfies TypeScript without initializing Firebase
function createBuildSafeMock(): admin.firestore.Firestore {
  // Return a Proxy that mimics Firestore but doesn't actually initialize
  // This is only used during build when env vars are missing
  return new Proxy({} as admin.firestore.Firestore, {
    get(_target, prop) {
      // Return functions that match Firestore's API but throw helpful errors
      // These will only be called if code actually runs during build (which shouldn't happen)
      if (prop === 'collection') {
        return () => {
          throw new Error('Firebase Admin cannot be used during build. This route should be marked as dynamic.');
        };
      }
      if (prop === 'batch') {
        return () => {
          throw new Error('Firebase Admin cannot be used during build. This route should be marked as dynamic.');
        };
      }
      if (prop === 'runTransaction') {
        return () => {
          throw new Error('Firebase Admin cannot be used during build. This route should be marked as dynamic.');
        };
      }
      if (prop === 'getAll') {
        return () => {
          throw new Error('Firebase Admin cannot be used during build. This route should be marked as dynamic.');
        };
      }
      // Return undefined for other properties to satisfy TypeScript
      return undefined;
    }
  });
}

// Export adminDb with lazy initialization
// This will only initialize when actually accessed at runtime, not during build
// The Proxy checks for env vars before initializing to prevent build-time errors
export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop, receiver) {
    // Check if we're in a build environment (env vars not available)
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      // During build, return the mock instead of trying to initialize
      const mock = createBuildSafeMock();
      const value = Reflect.get(mock, prop, receiver);
      return value;
    }
    // Env vars are available, safe to initialize
    try {
      const db = getAdminDb();
      const value = Reflect.get(db, prop, receiver);
      // If it's a function, bind it to the db instance
      if (typeof value === 'function') {
        return value.bind(db);
      }
      return value;
    } catch (error) {
      // If initialization fails, return the mock as fallback
      const mock = createBuildSafeMock();
      return Reflect.get(mock, prop, receiver);
    }
  }
});

