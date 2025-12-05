# Google Sheets Setup for Customer Import

## Quick Setup Guide

### Step 1: Find Your Google Sheets ID

1. Open your Google Sheet with the customer data (March 2024 - Dec 2025)
2. Look at the URL in your browser's address bar
3. The URL will look like this:
   ```
   https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t/edit
   ```
4. Copy the long string between `/d/` and `/edit`
   - In the example above, the ID is: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t`

### Step 2: Add to Environment Variables

1. Open or create the `.env.local` file in your project root directory
2. Add or update these lines:
   ```env
   GOOGLE_SHEETS_ID=your_google_sheet_id_here
   GOOGLE_SHEETS_RANGE='Form Responses 1'!A:Z
   ```
3. Replace `your_google_sheet_id_here` with the ID you copied in Step 1
4. Update `'Form Responses 1'!A:Z` if your sheet has a different name or you want a different range

### Step 3: Share Sheet with Service Account

1. In your Google Sheet, click the **"Share"** button (top right)
2. Find your service account email in your `.env.local` file (look for `GOOGLE_SERVICE_ACCOUNT_EMAIL`)
3. Add the service account email as a viewer
4. Make sure it has at least "Viewer" access (read-only is sufficient)

### Step 4: Restart Your Server

After updating `.env.local`, restart your development server:
```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

## Example Configuration

Here's what your `.env.local` should look like:

```env
# Google Sheets Configuration
GOOGLE_SHEETS_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t
GOOGLE_SHEETS_RANGE='Form Responses 1'!A:Z

# Google Service Account (for accessing the sheet)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Troubleshooting

### "Missing GOOGLE_SHEETS_ID" Error

**Solution**: Make sure you've added `GOOGLE_SHEETS_ID` to your `.env.local` file and restarted your server.

### "Permission Denied" or "Unable to access spreadsheet" Error

**Solution**: 
1. Check that you've shared the Google Sheet with your service account email
2. Verify the service account email is correct in your `.env.local`
3. Make sure the service account has at least "Viewer" access

### "Sheet not found" Error

**Solution**:
1. Verify the `GOOGLE_SHEETS_ID` is correct (no extra spaces or characters)
2. Check that the sheet name in `GOOGLE_SHEETS_RANGE` matches your actual sheet name
3. Make sure the sheet is shared with the service account

### Where is `.env.local`?

The `.env.local` file should be in your project root directory (same folder as `package.json`). If it doesn't exist, create it.

**Note**: `.env.local` is typically not committed to git (it's in `.gitignore`), so you'll need to set it up on each environment (local development, production, etc.).

## For Production (Vercel/Deployment)

If you're deploying to Vercel or another platform:

1. Go to your project settings
2. Find "Environment Variables" or "Secrets"
3. Add the same variables:
   - `GOOGLE_SHEETS_ID`
   - `GOOGLE_SHEETS_RANGE`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
4. Redeploy your application

---

**Need Help?** Check the main [CUSTOMER_IMPORT_GUIDE.md](./CUSTOMER_IMPORT_GUIDE.md) for detailed import instructions.

