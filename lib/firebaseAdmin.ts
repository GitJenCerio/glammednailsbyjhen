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
    initializeAdmin();
    adminDbInstance = admin.firestore();
  }
  return adminDbInstance;
}

// Export a getter function to defer initialization until runtime
export function getAdminDbInstance(): admin.firestore.Firestore {
  return getAdminDb();
}

// Export adminDb with lazy initialization
// This will only initialize when actually accessed at runtime, not during build
export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop, receiver) {
    const db = getAdminDb();
    const value = Reflect.get(db, prop, receiver);
    // If it's a function, bind it to the db instance
    if (typeof value === 'function') {
      return value.bind(db);
    }
    return value;
  }
});

