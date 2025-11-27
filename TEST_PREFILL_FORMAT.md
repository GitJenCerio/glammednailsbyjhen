# Quick Test: Date & Time Pre-fill Format

Use this guide to quickly diagnose why date/time aren't pre-filling.

## Step 1: Check Environment Variables

Make sure these are set in your `.env.local`:

```env
GOOGLE_FORM_BOOKING_ID_ENTRY=entry.1234567890
GOOGLE_FORM_DATE_ENTRY=entry.0987654321
GOOGLE_FORM_TIME_ENTRY=entry.1122334455
```

## Step 2: Test Format Compatibility

### Test Date Format

1. **Open your Google Form** → Three dots (⋮) → "Get pre-filled link"
2. **Try Format 1** (MM/DD/YYYY):
   - Fill date field with: `12/25/2024`
   - Get link
   - Open link - does it pre-fill? ✅ or ❌
3. **Try Format 2** (YYYY-MM-DD):
   - Fill date field with: `2024-12-25`
   - Get link
   - Open link - does it pre-fill? ✅ or ❌

**Which format worked?** Use that format in your system.

### Test Time Format

1. Use same prefill method
2. Fill time field with: `10:30 AM`
3. Get link and open it
4. Does it pre-fill? ✅ or ❌

## Step 3: Check Field Types

**In your Google Form, what field types are you using?**

- [ ] Date field: "Short answer" → Use `MM/DD/YYYY` format
- [ ] Date field: "Date" picker → Try `YYYY-MM-DD` format
- [ ] Time field: "Short answer" → Use `10:30 AM` format
- [ ] Time field: "Time" picker → May not work with pre-fill

## Step 4: Configure Format (If Needed)

If `MM/DD/YYYY` doesn't work, try `YYYY-MM-DD`:

Add to `.env.local`:
```env
GOOGLE_FORM_DATE_FORMAT=YYYY-MM-DD
```

Then restart your server.

## Step 5: Check Server Logs

When you create a booking, check your server console for:

```
Prefill fields: ['entry.1234567890', 'entry.0987654321', 'entry.1122334455']
Date entry key: Set (entry.0987654321)
Time entry key: Set (entry.1122334455)
Formatted date: 12/25/2024
Formatted time: 10:30 AM
Full prefill URL: https://docs.google.com/forms/...
```

**What to check:**
- Are the field keys listed? ✅
- Are date/time formatted correctly? ✅
- Does the URL include the date/time parameters? ✅

## Step 6: Manual URL Test

1. Create a test booking
2. Copy the generated Google Form URL
3. Check the URL parameters:
   ```
   ?usp=pp_url&entry.1234567890=GN-XXXXX&entry.0987654321=12/25/2024&entry.1122334455=10:30%20AM
   ```
4. Open the URL in a browser
5. Are the fields pre-filled? ✅ or ❌

## Common Solutions

### If Date Not Pre-filling:

**Solution 1**: Change field type to "Short answer"
- Edit Google Form
- Change date field from "Date" to "Short answer"
- Test again

**Solution 2**: Use YYYY-MM-DD format
- Add `GOOGLE_FORM_DATE_FORMAT=YYYY-MM-DD` to `.env.local`
- Restart server
- Test again

**Solution 3**: Verify field ID
- Double-check `GOOGLE_FORM_DATE_ENTRY` matches the actual field ID
- Get a fresh prefill link to confirm

### If Time Not Pre-filling:

**Solution 1**: Change field type to "Short answer"
- Edit Google Form
- Change time field from "Time" to "Short answer"
- Test again

**Solution 2**: Verify field ID
- Double-check `GOOGLE_FORM_TIME_ENTRY` matches the actual field ID
- Get a fresh prefill link to confirm

**Solution 3**: Check for spaces
- Time format includes spaces: `10:30 AM`
- Google Forms should handle this, but verify the URL encoding

## Quick Fix: Try YYYY-MM-DD Format

If `MM/DD/YYYY` doesn't work, add this to your `.env.local`:

```env
GOOGLE_FORM_DATE_FORMAT=YYYY-MM-DD
```

Then restart your server and test again.

## Still Not Working?

1. **Check the generated URL** - Does it include date/time parameters?
2. **Test manually** - Copy the URL and open it - do fields pre-fill?
3. **Verify field IDs** - Are they correct?
4. **Check field types** - Are they "Short answer"?
5. **Restart server** - After any `.env.local` changes


