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
NEXT_PUBLIC_FIREBASE_API_KEY=AIza... (your actual key)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

NEXT_PUBLIC_GOOGLE_FORM_URL=https://forms.gle/o6k3veo5HY2NkYAu9
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

