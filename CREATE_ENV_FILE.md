# How to Create Your .env.local File

Since `.env` files are in `.gitignore` for security, you need to create them manually.

## Step 1: Create the File

**Option A: Using Command Line (Recommended)**
```bash
# Copy the example file
cp .env.example .env.local
```

**Option B: Manually**
1. Create a new file named `.env.local` in the project root directory
2. Copy the contents from `.env.example`
3. Paste into your new `.env.local` file

## Step 2: Get Your Firebase Credentials

1. Go to https://console.firebase.google.com/
2. Select your project (or create a new one)
3. Click the gear icon ⚙️ → Project Settings
4. Scroll down to "Your apps" section
5. If you don't have a web app, click "Add app" → Web (</> icon)
6. Register your app with a nickname
7. Copy the config values that look like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 3: Update Your .env.local File

Replace the placeholder values in `.env.local` with your actual Firebase credentials:

```env
# Firebase web SDK (client)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza... (your actual key)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK (server)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Form + Sheets automation
GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/<form-id>/viewform?usp=pp_url
# To get this: Open form → Three dots (⋮) → "Get pre-filled link" → Copy URL (must include ?usp=pp_url)
# See HOW_TO_GET_GOOGLE_FORM_BASE_URL.md for detailed instructions
GOOGLE_FORM_BOOKING_ID_ENTRY=entry.1234567890        # the field that holds bookingId
GOOGLE_FORM_DATE_ENTRY=entry.0987654321              # optional: the field that holds appointment date (auto-filled)
GOOGLE_FORM_TIME_ENTRY=entry.1122334455              # optional: the field that holds appointment time (auto-filled, handles single/paired slots)
GOOGLE_FORM_SERVICE_LOCATION_ENTRY=entry.2233445566 # optional: the field that holds service location (auto-filled: "Homebased Studio" or "Home Service")
GOOGLE_FORM_DATE_FORMAT=FULL                         # optional: date format for Google Forms. Default: FULL (e.g., "Friday, November 28, 2025")
                                                    # Options: FULL, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
GOOGLE_SHEETS_ID=your-google-sheet-id
GOOGLE_SHEETS_RANGE='Form Responses 1'!A:Z
GOOGLE_SHEETS_BOOKING_ID_COLUMN=bookingId           # header name in sheet
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Email Notifications (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=glammednailsbyjhen <noreply@glammednailsbyjhen.com>
REPLY_TO_EMAIL=glammednailsbyjhen@gmail.com

# Payment QR Codes (upload images and add URLs)
PNB_QR_CODE_URL=https://your-image-host.com/pnb-qr-code.png
GCASH_QR_CODE_URL=https://your-image-host.com/gcash-qr-code.png
```

## Step 4: Save and Restart

1. Save the `.env.local` file
2. Restart your development server:
   ```bash
   npm run dev
   ```

## Important Notes

- ✅ `.env.local` is for local development
- ✅ Never commit `.env.local` to Git (it's in .gitignore)
- ✅ For Vercel deployment, add these variables in Vercel dashboard
- ⚠️ Keep your Firebase credentials secret
- ⚠️ Don't share your `.env.local` file

## Step 5: Set Up Email Notifications (Optional but Recommended)

1. Go to https://resend.com/
2. Sign up for a free account (3,000 emails/month free)
3. Verify your domain or use their test domain
4. Go to API Keys section
5. Create a new API key
6. Copy the API key to your `.env.local`:
   - `RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx`
7. Set your email addresses:
   - `FROM_EMAIL=glammednailsbyjhen <noreply@yourdomain.com>` (or use Resend's test domain)
   - `REPLY_TO_EMAIL=glammednailsbyjhen@gmail.com`

**Note:** If you don't set up Resend, the booking system will still work, but customers won't receive email notifications.

## Vercel Deployment

When deploying to Vercel:

1. Go to your project in Vercel dashboard
2. Click Settings → Environment Variables
3. Add each variable from your `.env.local` file
4. Make sure to add them for all environments (Production, Preview, Development)
5. Redeploy your project

## Troubleshooting

**Error: "Firebase config not found"**
- Make sure `.env.local` exists in the project root
- Check that all variables start with `NEXT_PUBLIC_`
- Restart your dev server after creating the file

**Error: "Invalid API key"**
- Double-check your Firebase credentials
- Make sure there are no extra spaces or quotes
- Verify the credentials in Firebase Console

**Variables not loading**
- Restart your development server
- Clear your `.next` folder: `rm -rf .next`
- Run `npm run dev` again

## Need Help?

- Firebase Console: https://console.firebase.google.com/
- Firebase Docs: https://firebase.google.com/docs
- Vercel Docs: https://vercel.com/docs

