import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getAdminDbInstance } from '@/lib/firebaseAdmin';
import type { UserRole } from '@/lib/types';
import { sendInviteEmail } from '@/lib/email';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

// Helper function to get user role from Firestore
async function getUserRole(uid: string): Promise<UserRole | undefined> {
  try {
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

// Helper function to set user role in Firestore
async function setUserRole(uid: string, role: UserRole): Promise<void> {
  const db = getAdminDbInstance();
  await db.collection('users').doc(uid).set(
    { role, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

// Helper function to set user nail tech ID in Firestore
async function setUserNailTechId(uid: string, nailTechId: string | null): Promise<void> {
  const db = getAdminDbInstance();
  await db.collection('users').doc(uid).set(
    { nailTechId: nailTechId || null, updatedAt: new Date().toISOString() },
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

// GET - List all users
export async function GET(request: Request) {
  try {
    const uid = await verifyAuth(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view users
    // For initial setup: if no role is set, allow access (first user becomes admin)
    const requesterRole = await getUserRole(uid);
    
    // If no role is set, this might be the first user - allow access for initial setup
    // Otherwise, require admin role
    if (requesterRole !== undefined && requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const auth = getAuth();
    const listUsersResult = await auth.listUsers(1000); // Max 1000 users
    
    // Get roles for all users, and initialize roles for users without one
    const usersWithRoles = await Promise.all(
      listUsersResult.users.map(async (user) => {
        let role = await getUserRole(user.uid);
        
        // If user has no role, assign default role
        // First user (oldest) gets admin, others get viewer
        if (!role) {
          // Check if this is the first user (oldest creation time)
          const isFirstUser = listUsersResult.users.every(
            (otherUser) => 
              otherUser.uid === user.uid || 
              new Date(user.metadata.creationTime) <= new Date(otherUser.metadata.creationTime)
          );
          
          role = isFirstUser ? 'admin' : 'viewer';
          // Save the role to Firestore
          await setUserRole(user.uid, role);
        }
        
        return {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          emailVerified: user.emailVerified,
          disabled: user.disabled,
          role: role,
          nailTechId: await getUserNailTechId(user.uid),
          createdAt: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime,
          providerData: user.providerData.map((provider) => ({
            providerId: provider.providerId,
            uid: provider.uid,
            email: provider.email,
            displayName: provider.displayName,
          })),
        };
      })
    );

    return NextResponse.json({ users: usersWithRoles }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json({ error: error.message || 'Failed to list users' }, { status: 500 });
  }
}

// POST - Create/invite a new user
export async function POST(request: Request) {
  try {
    const uid = await verifyAuth(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to create users
    // For initial setup: if no role is set, allow access
    const requesterRole = await getUserRole(uid);
    if (requesterRole !== undefined && requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, displayName, sendInviteEmail, role } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate role
    const validRoles: UserRole[] = ['admin', 'manager', 'staff', 'viewer'];
    const userRole: UserRole = validRoles.includes(role) ? role : 'viewer';

    const auth = getAuth();
    
    // Check if user already exists
    try {
      const existingUser = await auth.getUserByEmail(email);
      return NextResponse.json({ 
        error: 'User with this email already exists',
        user: {
          uid: existingUser.uid,
          email: existingUser.email,
          displayName: existingUser.displayName,
        }
      }, { status: 400 });
    } catch (error: any) {
      // User doesn't exist, continue with creation
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create user
    const userRecord = await auth.createUser({
      email,
      password: password || undefined, // If no password, user can only sign in with Google
      displayName: displayName || email.split('@')[0],
      emailVerified: false,
      disabled: false,
    });

    // Set user role in Firestore
    await setUserRole(userRecord.uid, userRole);

    // If sendInviteEmail is true, send password reset email (which acts as an invite)
    // Note: Password reset links only work for email/password users, not Google-only users
    if (sendInviteEmail && password) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL 
          ? `https://${process.env.NEXT_PUBLIC_APP_URL}`
          : process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}`
          : 'https://yourdomain.com';
        
        const link = await auth.generatePasswordResetLink(email, {
          url: `${appUrl}/admin`,
          handleCodeInApp: false,
        });
        
        // Send invitation email
        const emailResult = await sendInviteEmail({
          email,
          displayName: displayName || email.split('@')[0],
          resetLink: link,
          role: userRole,
        });
        
        if (!emailResult.success) {
          console.warn('Email sending failed, but user was created:', emailResult.error);
          // Still log the link as a fallback
          console.log('\n📧 Password reset link for new user:', link);
        }
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        // Don't fail the user creation if email fails
        // Try to generate link anyway for manual sending
        try {
          const link = await auth.generatePasswordResetLink(email);
          console.log('\n📧 Password reset link (manual fallback):', link);
        } catch (linkError) {
          console.error('Error generating password reset link:', linkError);
        }
      }
    } else if (sendInviteEmail && !password) {
      console.warn('Cannot send password reset email: User was created without a password (Google Sign-In only). User can sign in with Google.');
    }

    // Store invite record in Firestore (optional tracking)
    const db = getAdminDbInstance();
    const inviteData = {
      email,
      invitedBy: uid,
      role: userRole,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };

    try {
      await db.collection('user_invites').add(inviteData);
    } catch (dbError) {
      console.error('Error storing invite record:', dbError);
      // Don't fail if Firestore write fails
    }

    return NextResponse.json({
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        role: userRole,
        createdAt: userRecord.metadata.creationTime,
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 400 });
  }
}

// DELETE - Delete a user
export async function DELETE(request: Request) {
  try {
    const uid = await verifyAuth(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent self-deletion
    if (userId === uid) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const auth = getAuth();
    await auth.deleteUser(userId);

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 400 });
  }
}

