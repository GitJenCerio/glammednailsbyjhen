import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import type { UserRole } from '@/lib/types';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

// Helper function to get user role from Firestore
async function getUserRole(uid: string): Promise<UserRole | undefined> {
  try {
    const { getAdminDbInstance } = await import('@/lib/firebaseAdmin');
    const db = getAdminDbInstance();
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return data?.role as UserRole | undefined;
    }
  } catch (error) {
    console.error('Error getting user role:', error);
  }
  return undefined;
}

// Helper function to get user nail tech ID from Firestore
async function getUserNailTechId(uid: string): Promise<string | undefined> {
  try {
    const { getAdminDbInstance } = await import('@/lib/firebaseAdmin');
    const db = getAdminDbInstance();
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return data?.nailTechId as string | undefined;
    }
  } catch (error) {
    console.error('Error getting user nail tech ID:', error);
  }
  return undefined;
}

// Helper function to set user nail tech ID in Firestore
async function setUserNailTechId(uid: string, nailTechId: string | null): Promise<void> {
  const { getAdminDbInstance } = await import('@/lib/firebaseAdmin');
  const db = getAdminDbInstance();
  await db.collection('users').doc(uid).set(
    { nailTechId: nailTechId || null, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

// Helper function to set user role in Firestore
async function setUserRole(uid: string, role: UserRole): Promise<void> {
  const { getAdminDbInstance } = await import('@/lib/firebaseAdmin');
  const db = getAdminDbInstance();
  await db.collection('users').doc(uid).set(
    { role, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

// Initialize Firebase Admin if not already initialized
function getAuth() {
  if (admin.apps.length === 0) {
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
  return admin.auth();
}

// Verify authentication token from request
async function verifyAuth(request: Request): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.split('Bearer ')[1];
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// GET - Get a specific user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const uid = await verifyAuth(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const auth = getAuth();
    const userRecord = await auth.getUser(resolvedParams.id);
    let role = await getUserRole(resolvedParams.id);

    // If user has no role, assign default role
    if (!role) {
      // Get all users to check if this is the first user
      const listUsersResult = await auth.listUsers(1000);
      const isFirstUser = listUsersResult.users.every(
        (otherUser) => 
          otherUser.uid === resolvedParams.id || 
          new Date(userRecord.metadata.creationTime) <= new Date(otherUser.metadata.creationTime)
      );
      
      role = isFirstUser ? 'admin' : 'viewer';
      // Save the role to Firestore
      await setUserRole(resolvedParams.id, role);
    }

    return NextResponse.json({
      user: {
        uid: userRecord.uid,
        email: userRecord.email || '',
        displayName: userRecord.displayName || '',
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        role: role,
        nailTechId: await getUserNailTechId(resolvedParams.id),
        createdAt: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
        providerData: userRecord.providerData.map((provider) => ({
          providerId: provider.providerId,
          uid: provider.uid,
          email: provider.email,
          displayName: provider.displayName,
        })),
      }
    });
  } catch (error: any) {
    console.error('Error getting user:', error);
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to get user' }, { status: 500 });
  }
}

// PATCH - Update a user
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const uid = await verifyAuth(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to update users
    // For initial setup: if no role is set, allow access
    const requesterRole = await getUserRole(uid);
    if (requesterRole !== undefined && requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const body = await request.json();
    const { email, displayName, disabled, emailVerified, role, nailTechId } = body;

    const auth = getAuth();
    const updateData: admin.auth.UpdateRequest = {};

    if (email !== undefined) updateData.email = email;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (disabled !== undefined) updateData.disabled = disabled;
    if (emailVerified !== undefined) updateData.emailVerified = emailVerified;

    const userRecord = await auth.updateUser(resolvedParams.id, updateData);

    // Update role if provided
    if (role !== undefined) {
      const validRoles: UserRole[] = ['admin', 'manager', 'staff', 'viewer'];
      if (validRoles.includes(role)) {
        await setUserRole(resolvedParams.id, role);
      }
    }

    // Update nail tech ID if provided (for staff role)
    if (nailTechId !== undefined) {
      await setUserNailTechId(resolvedParams.id, nailTechId || null);
    }

    const updatedRole = await getUserRole(resolvedParams.id);
    const updatedNailTechId = await getUserNailTechId(resolvedParams.id);

    return NextResponse.json({
      user: {
        uid: userRecord.uid,
        email: userRecord.email || '',
        displayName: userRecord.displayName || '',
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        role: updatedRole || 'viewer',
        nailTechId: updatedNailTechId,
        createdAt: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
      }
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 400 });
  }
}

