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

// Export a getter function instead of direct access to defer initialization
export const adminDb = getAdminDb();

