# How to Get the Google Form Base URL

This guide explains how to get the `GOOGLE_FORM_BASE_URL` for your booking system.

## Quick Method (Easiest)

1. **Open your Google Form** in edit mode
   - Go to [Google Forms](https://forms.google.com)
   - Open the form you're using for bookings

2. **Get the prefill link**
   - Click the **three dots (⋮)** menu in the top right
   - Select **"Get pre-filled link"** or **"Get prefill link"**

3. **Copy the base URL**
   - You'll see a preview of the form
   - **Don't fill in any fields yet** - just look at the URL in your browser's address bar
   - The URL will look like:
     ```
     https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform?usp=pp_url
     ```
   - Copy this entire URL (including `?usp=pp_url` at the end)

4. **Set in your `.env.local`:**
   ```env
   GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform?usp=pp_url
   ```

## Alternative Method (If you already have the form URL)

If you already have your Google Form's regular URL, you can convert it:

### Step 1: Get your regular form URL

1. Open your Google Form
2. Click the **"Send"** button (top right)
3. Click the **link icon** (🔗)
4. Copy the URL - it will look like:
   ```
   https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform
   ```

### Step 2: Convert to prefill URL

Add `?usp=pp_url` to the end of your URL:

**Before:**
```
https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform
```

**After:**
```
https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform?usp=pp_url
```

### Step 3: Set in your `.env.local`

```env
GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform?usp=pp_url
```

## Important Notes

✅ **Must include `?usp=pp_url`**: This parameter enables pre-filling fields in the form

✅ **Use the full URL**: Include `https://docs.google.com/forms/d/e/` and everything after

✅ **Don't include field values**: The base URL should NOT have any `&entry.XXXXX=value` parameters - those will be added automatically by the system

❌ **Wrong format:**
```
GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform?usp=pp_url&entry.1234567890=TEST123
```

✅ **Correct format:**
```
GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform?usp=pp_url
```

## URL Structure Breakdown

Your Google Form URL has this structure:
```
https://docs.google.com/forms/d/e/[FORM_ID]/viewform?usp=pp_url
```

Where:
- `https://docs.google.com/forms/d/e/` - Google Forms base path
- `[FORM_ID]` - Your unique form identifier (long alphanumeric string)
- `/viewform` - The form view endpoint
- `?usp=pp_url` - Parameter that enables pre-filling

## Testing Your URL

After setting `GOOGLE_FORM_BASE_URL`, you can test it:

1. Open the URL in your browser
2. You should see your Google Form
3. The form should be empty (no pre-filled values yet)
4. If you see an error, double-check:
   - The URL is complete
   - It includes `?usp=pp_url`
   - The form ID is correct

## Troubleshooting

**Error: "Form not found" or 404 error?**
- Make sure you copied the entire URL
- Verify the form ID is correct
- Check that the form is still active and not deleted

**URL doesn't work for pre-filling?**
- Make sure you included `?usp=pp_url` at the end
- Try getting a fresh prefill link using Method 1 above

**Can't find "Get pre-filled link" option?**
- Make sure you're the owner or editor of the form
- Try using the alternative method (convert regular URL)

## Example

Here's a complete example of what your `.env.local` should look like:

```env
# Google Form configuration
GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform?usp=pp_url
GOOGLE_FORM_BOOKING_ID_ENTRY=entry.1234567890
GOOGLE_FORM_DATE_ENTRY=entry.0987654321
GOOGLE_FORM_TIME_ENTRY=entry.1122334455
```

Replace `1a2b3c4d5e6f7g8h9i0j` with your actual form ID, and the `entry.XXXXX` values with your actual field IDs.

## Next Steps

After setting `GOOGLE_FORM_BASE_URL`:
1. Get your field entry IDs (see `HOW_TO_GET_GOOGLE_FORM_FIELD_ID.md`)
2. Set `GOOGLE_FORM_BOOKING_ID_ENTRY` (required)
3. Optionally set `GOOGLE_FORM_DATE_ENTRY` and `GOOGLE_FORM_TIME_ENTRY`
4. Restart your development server
5. Test the booking flow to ensure the form pre-fills correctly


