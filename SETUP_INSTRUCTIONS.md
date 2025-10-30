# Booking System Setup Instructions

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Google Form URL for bookings
NEXT_PUBLIC_GOOGLE_FORM_URL=https://forms.gle/o6k3veo5HY2NkYAu9
```

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable Authentication:
   - Go to Authentication → Sign-in method
   - Enable Email/Password authentication
   - Create an admin user account

4. Create Firestore Database:
   - Go to Firestore Database
   - Create database in production mode
   - Create two collections:
     - `slots` - for available appointment slots
     - `bookings` - for client bookings

5. Get your Firebase config:
   - Go to Project Settings → General
   - Scroll to "Your apps" section
   - Add a web app or use existing one
   - Copy the config values to your `.env.local` file

6. Set up Firestore Security Rules:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Allow anyone to read slots
       match /slots/{slotId} {
         allow read: if true;
         allow write: if request.auth != null;
       }
       
       // Allow anyone to create bookings, only authenticated users to update
       match /bookings/{bookingId} {
         allow create: if true;
         allow read, update, delete: if request.auth != null;
       }
     }
   }
   ```

## Deployment to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com/) and import your repository
3. Add all environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add each variable from your `.env.local` file
4. Deploy!

## Admin Access

1. Visit `/admin` to log in
2. Use the credentials you created in Firebase Authentication
3. Access the dashboard to manage slots and bookings

## Important Notes

- The `/admin` route is intentionally NOT linked in the navigation
- Keep your Firebase credentials secure
- Regularly back up your Firestore data
- Test the Google Form integration thoroughly

