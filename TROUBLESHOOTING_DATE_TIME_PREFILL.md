# Troubleshooting: Date and Time Not Auto-Filled in Google Form

If the appointment date and time are not being auto-filled in your Google Form, follow these steps:

## Step 1: Verify Environment Variables

Check your `.env.local` file (or environment variables in Vercel) and make sure you have:

```env
GOOGLE_FORM_BOOKING_ID_ENTRY=entry.1234567890
GOOGLE_FORM_DATE_ENTRY=entry.0987654321
GOOGLE_FORM_TIME_ENTRY=entry.1122334455
GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform?usp=pp_url

# Optional: Date format (default: FULL - "Friday, November 28, 2025")
# Options: FULL, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
# GOOGLE_FORM_DATE_FORMAT=FULL
```

**Important**: 
- Replace `entry.1234567890`, `entry.0987654321`, and `entry.1122334455` with your actual field IDs
- Make sure there are **no spaces** around the `=` sign
- Make sure there are **no quotes** around the values (unless the value itself contains spaces)

## Step 2: Get the Correct Field IDs

### For Date Field:

1. Open your Google Form in edit mode
2. Click the **three dots (⋮)** menu → **"Get pre-filled link"**
3. Fill in the **Appointment Date** field with a test date (e.g., `12/25/2024`)
4. Click **"Get link"**
5. Look at the URL - it will look like:
   ```
   https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.0987654321=12/25/2024
   ```
6. Copy the `entry.0987654321` part (the number will be different)
7. Set it in your `.env.local`:
   ```env
   GOOGLE_FORM_DATE_ENTRY=entry.0987654321
   ```

### For Time Field:

1. Use the same prefill method
2. Fill in the **Appointment Time** field with a test time (e.g., `10:30 AM`)
3. Get the link and find the `entry.XXXXX` for the time field
4. Set it in your `.env.local`:
   ```env
   GOOGLE_FORM_TIME_ENTRY=entry.1122334455
   ```

## Step 3: ⚠️ CRITICAL - Change Field Types to "Short Answer"

**IMPORTANT**: Google Forms **Date picker** and **Time picker** fields **DO NOT support URL pre-filling**. You **MUST** use **"Short answer"** text fields instead.

### Date Field:
- ❌ **DO NOT USE**: "Date" picker field type (doesn't work with pre-filling)
- ✅ **MUST USE**: **"Short answer"** field type
- **Default format**: The system sends dates in full format (e.g., `Friday, November 28, 2025`)
- **Alternative formats**: You can change the format via `GOOGLE_FORM_DATE_FORMAT`:
  - `FULL` or `LONG` (default): `Friday, November 28, 2025`
  - `DD/MM/YYYY` (European format): `28/11/2025`
  - `MM/DD/YYYY` (US format): `11/28/2025`
  - `YYYY-MM-DD` (ISO format): `2025-11-28`

### Time Field:
- ❌ **DO NOT USE**: "Time" picker field type (doesn't work with pre-filling)
- ✅ **MUST USE**: **"Short answer"** field type
- The system sends times in `10:30 AM` format (single slot) or `10:30 AM - 1:00 PM` format (paired slots)

### How to Change Field Types:

1. **Open your Google Form** in edit mode
2. **Click on the Date field** (or Time field)
3. **Click the dropdown** next to the field type (currently shows "Date" or "Time")
4. **Select "Short answer"** from the list
5. **Save your form**

**Note**: After changing the field type, you may need to:
- Update the field description to indicate the expected format
- Test the prefill again to ensure it works

## Step 4: Restart Your Server

After updating `.env.local`:
1. **Stop** your development server (Ctrl+C)
2. **Restart** it:
   ```bash
   npm run dev
   ```

For production (Vercel):
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update the variables
3. **Redeploy** your project

## Step 5: Test the Prefill

1. Create a test booking in your system
2. Check the browser console (F12) for any warnings
3. Look at the generated Google Form URL - it should include the date and time parameters
4. Open the URL and verify the fields are pre-filled

## Step 6: Check the Generated URL

When you create a booking, the system generates a URL like:
```
https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.1234567890=GN-1234567890&entry.0987654321=12/25/2024&entry.1122334455=10:30%20AM
```

**What to check:**
- ✅ `entry.1234567890=GN-XXXXX` - Booking ID (should always be there)
- ✅ `entry.0987654321=12/25/2024` - Date (should be there if `GOOGLE_FORM_DATE_ENTRY` is set)
- ✅ `entry.1122334455=10:30%20AM` - Time (should be there if `GOOGLE_FORM_TIME_ENTRY` is set)

If the date/time parameters are missing from the URL, the environment variables are not set correctly.

## Common Issues

### Issue 1: Fields not pre-filling
**Cause**: Environment variables not set or incorrect field IDs
**Solution**: Follow Steps 1-2 above

### Issue 2: Date not pre-filling (MOST COMMON)
**Cause**: Using Google Forms "Date" picker field type - **these DO NOT support URL pre-filling**
**Solution**: 
1. Change the field type to **"Short answer"** in your Google Form
2. The system will send dates as text (e.g., `25/12/2024` or `12/25/2024` depending on your format setting)
3. Restart your server and test again

### Issue 3: Time not pre-filling (MOST COMMON)
**Cause**: Using Google Forms "Time" picker field type - **these DO NOT support URL pre-filling**
**Solution**: 
1. Change the field type to **"Short answer"** in your Google Form
2. The system will send times as text (e.g., `10:30 AM` or `10:30 AM - 1:00 PM`)
3. Restart your server and test again

### Issue 4: Works locally but not in production
**Cause**: Environment variables not set in Vercel
**Solution**: Add the variables in Vercel Dashboard → Settings → Environment Variables and redeploy

### Issue 5: Only Booking ID works, date/time don't
**Cause**: `GOOGLE_FORM_DATE_ENTRY` or `GOOGLE_FORM_TIME_ENTRY` not set
**Solution**: Add these variables to your `.env.local` and Vercel environment variables

## Debug Mode

The system now logs warnings in development mode. Check your server console for:
- `GOOGLE_FORM_DATE_ENTRY not set - date will not be pre-filled in form`
- `GOOGLE_FORM_TIME_ENTRY not set - time will not be pre-filled in form`

If you see these warnings, the environment variables are missing.

## Still Not Working?

1. **Double-check field IDs**: Make sure you copied the exact `entry.XXXXX` value from the prefill URL
2. **Verify field exists**: Make sure the date and time fields still exist in your Google Form
3. **Check for typos**: Ensure no extra spaces or characters in the environment variable values
4. **Test with a simple value**: Try pre-filling the fields manually using Google Forms prefill to verify the field IDs work
5. **Check server logs**: Look for any errors in your server console

## Quick Checklist

- [ ] `GOOGLE_FORM_DATE_ENTRY` is set in `.env.local`
- [ ] `GOOGLE_FORM_TIME_ENTRY` is set in `.env.local`
- [ ] Field IDs are correct (match the ones from prefill URL)
- [ ] ⚠️ **Date field in Google Form is "Short answer" type** (NOT "Date" picker)
- [ ] ⚠️ **Time field in Google Form is "Short answer" type** (NOT "Time" picker)
- [ ] Server has been restarted after updating `.env.local`
- [ ] Environment variables are set in Vercel (for production)
- [ ] No spaces or quotes around the values in `.env.local`
- [ ] Tested the prefill URL manually to verify fields are filled

