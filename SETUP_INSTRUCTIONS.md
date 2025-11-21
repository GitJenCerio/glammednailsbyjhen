# Booking System Setup Instructions

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Firebase Web SDK (client)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK (server routes)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Form Prefill + Sheet sync
GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/<form-id>/viewform?usp=pp_url
GOOGLE_FORM_BOOKING_ID_ENTRY=entry.1234567890
GOOGLE_SHEETS_ID=your_google_sheet_id
GOOGLE_SHEETS_RANGE='Form Responses 1'!A:Z
GOOGLE_SHEETS_BOOKING_ID_COLUMN=bookingId
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Google Cloud and Sheets Setup

1. Create a service account in the [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Generate a JSON key and copy the `client_email` / `private_key` into `.env.local`
3. Enable the **Google Sheets API** for your project
4. Share the Google Sheet that stores form responses with the service-account email so it can read responses
5. In Google Forms, open the prefill view, note the `entry.<id>` value of the Booking ID question, and store it in `GOOGLE_FORM_BOOKING_ID_ENTRY`

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

