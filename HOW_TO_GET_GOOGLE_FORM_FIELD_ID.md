# How to Get the Google Form Booking ID Field

This guide explains how to add a Booking ID field to your Google Form (if you don't have one yet) and then find its `entry.<id>` value for the `GOOGLE_FORM_BOOKING_ID_ENTRY` environment variable.

## Quick Start (If You Don't Have the Fields Yet)

### Booking ID Field (Required)
1. **Add the field**: Open your Google Form → Click "+" → Select "Short answer" → Title it "Booking ID"
2. **Get the ID**: Click three dots (⋮) → "Get pre-filled link" → Fill in "Booking ID" with `TEST123` → Get link
3. **Extract ID**: From the URL, copy the `entry.XXXXX` part (e.g., `entry.1234567890`)
4. **Set in .env.local**: `GOOGLE_FORM_BOOKING_ID_ENTRY=entry.1234567890`

### Appointment Date Field (Optional but Recommended)
1. **Add the field**: Click "+" → Select "Short answer" or "Date" → Title it "Appointment Date" or "Desired Date"
2. **Get the ID**: Use the same prefill method → Fill in the date field → Get link
3. **Extract ID**: Copy the `entry.XXXXX` for the date field
4. **Set in .env.local**: `GOOGLE_FORM_DATE_ENTRY=entry.0987654321`

### Appointment Time Field (Optional but Recommended)
1. **Add the field**: Click "+" → Select "Short answer" → Title it "Appointment Time" or "Time"
2. **Get the ID**: Use the same prefill method → Fill in the time field → Get link
3. **Extract ID**: Copy the `entry.XXXXX` for the time field
4. **Set in .env.local**: `GOOGLE_FORM_TIME_ENTRY=entry.1122334455`

### Service Location Field (Optional but Recommended)
1. **Add the field**: Click "+" → Select "Short answer" → Title it "Service Location" or "Location"
2. **Get the ID**: Use the same prefill method → Fill in the location field with "Homebased Studio" or "Home Service" → Get link
3. **Extract ID**: Copy the `entry.XXXXX` for the location field
4. **Set in .env.local**: `GOOGLE_FORM_SERVICE_LOCATION_ENTRY=entry.2233445566`

**Note**: 
- The date, time, and service location fields are optional. If you don't set them, the system will still work but won't auto-fill those fields.
- The time field automatically handles both single slots (e.g., "10:30 AM") and paired slots for mani-pedi (e.g., "10:30 AM - 1:00 PM").
- The service location field will be automatically filled with "Homebased Studio" or "Home Service" based on the client's selection.

Continue reading below for detailed instructions.

## Step 1: Add Fields to Your Google Form

You need at least a **Booking ID field** (required), and optionally an **Appointment Date field** (recommended).

### Add Booking ID Field (Required)

If you don't have a Booking ID field yet, follow these steps:

1. **Open your Google Form** in edit mode
   - Go to [Google Forms](https://forms.google.com)
   - Open the form you're using for bookings

2. **Add a new question**
   - Click the **"+" button** on the right sidebar (or at the bottom of your form)
   - Select **"Short answer"** as the question type

3. **Configure the field**
   - **Question title**: Enter "Booking ID" (or "Booking Reference", "Confirmation Number", etc.)
   - **Description** (optional): Add something like "This will be automatically filled - do not edit"
   - **Required**: You can mark it as required or optional (the system will fill it automatically)
   - **Note**: Unfortunately, Google Forms doesn't allow fields to be truly "hidden" or "read-only" for users, but the system will pre-fill it automatically

4. **Position the field** (optional but recommended)
   - Drag the field to the **top of your form** (before other questions)
   - This makes it easier to identify and ensures it's filled first

5. **Save your form**
   - The field is automatically saved
   - You don't need to publish or do anything else

### Add Appointment Date Field (Optional but Recommended)

To automatically fill in the appointment date when clients book:

1. **Add a new question**
   - Click the **"+" button** again
   - **IMPORTANT**: Select **"Short answer"** (NOT "Date" picker)
   - **Why**: Google Forms "Date" picker fields DO NOT support URL pre-filling
   - **Note**: "Short answer" allows the system to pre-fill the date as text

2. **Configure the field**
   - **Question title**: Enter "Appointment Date", "Desired Date", or "Date of Appointment"
   - **Description** (optional): Add something like "This will be automatically filled based on your booking selection"
   - **Required**: You can mark it as required or optional

3. **Position the field** (optional)
   - Place it right after the Booking ID field for better organization

4. **Save your form**

### Add Appointment Time Field (Optional but Recommended)

To automatically fill in the appointment time when clients book:

1. **Add a new question**
   - Click the **"+" button** again
   - **IMPORTANT**: Select **"Short answer"** (NOT "Time" picker)
   - **Why**: Google Forms "Time" picker fields DO NOT support URL pre-filling
   - **Note**: "Short answer" allows the system to pre-fill the time as text (e.g., "10:30 AM")

2. **Configure the field**
   - **Question title**: Enter "Appointment Time", "Time", or "Time Slot"
   - **Description** (optional): Add something like "This will be automatically filled. For mani-pedi, this shows a time range."
   - **Required**: You can mark it as required or optional

3. **Position the field** (optional)
   - Place it right after the Appointment Date field for better organization

4. **Save your form**

**Important**: The time field will automatically show:
- **Single slot** (manicure/pedicure): "10:30 AM"
- **Paired slots** (mani-pedi): "10:30 AM - 1:00 PM"

### Why You Need These Fields

**Booking ID field** (required):
- Links form submissions back to bookings in your system
- Automatically pre-fills when customers are redirected to the form
- Matches form responses with bookings in your database

**Appointment Date field** (optional):
- Automatically fills the date the client selected when booking
- Reduces errors and ensures consistency
- Makes it easier for you to see the appointment date in form responses

**Appointment Time field** (optional):
- Automatically fills the time slot(s) the client selected
- For single slots: Shows time like "10:30 AM"
- For paired slots (mani-pedi): Shows time range like "10:30 AM - 1:00 PM"
- Reduces errors and ensures clients know their exact appointment time

## Step 2: Get the Field IDs

Now that you have your fields, you need to find their `entry.XXXXX` IDs. You can get both IDs at the same time using the prefill method.

## Method 1: Using Prefill URL (Easiest)

1. **Open your Google Form** in edit mode
   - Go to [Google Forms](https://forms.google.com)
   - Open the form you're using for bookings

2. **Get the Prefill URL**
   - Click the **three dots (⋮)** menu in the top right
   - Select **"Get pre-filled link"** or **"Get prefill link"**

3. **Fill in your fields**
   - In the prefill view, you'll see all your form fields
   - **Booking ID field**: Enter a test value (e.g., `TEST123`)
   - **Appointment Date field** (if you added it): Enter a test date (e.g., `12/25/2024`)
   - **Appointment Time field** (if you added it): Enter a test time (e.g., `10:30 AM` or `10:30 AM - 1:00 PM`)
   - Click **"Get link"** at the bottom

4. **Extract the field IDs from the URL**
   - You'll get a URL that looks like:
     ```
     https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.1234567890=TEST123&entry.0987654321=12/25/2024&entry.1122334455=10:30%20AM
     ```
   - Each `entry.XXXXX=value` pair represents one field
   - **Booking ID**: `entry.1234567890` → Set as `GOOGLE_FORM_BOOKING_ID_ENTRY=entry.1234567890`
   - **Appointment Date**: `entry.0987654321` → Set as `GOOGLE_FORM_DATE_ENTRY=entry.0987654321`
   - **Appointment Time**: `entry.1122334455` → Set as `GOOGLE_FORM_TIME_ENTRY=entry.1122334455`
   - **Service Location**: `entry.2233445566` → Set as `GOOGLE_FORM_SERVICE_LOCATION_ENTRY=entry.2233445566`
   - **Tip**: Match the values you entered to identify which field is which

## Method 2: Inspect Form HTML (Alternative)

1. **Open your Google Form** in view mode (not edit mode)
   - Use the "Send" button to get the view link, or use: `https://docs.google.com/forms/d/e/FORM_ID/viewform`

2. **Open Developer Tools**
   - Press `F12` or right-click → "Inspect"
   - Go to the **Network** tab
   - Refresh the page

3. **Find the form submission request**
   - Look for a request to `formResponse` or similar
   - In the **Elements** tab, find the input field for your Booking ID question
   - Look for the `name` attribute, which will be `entry.XXXXX`

4. **Extract the ID**
   - The `name` attribute will look like: `name="entry.1234567890"`
   - Use `entry.1234567890` as your `GOOGLE_FORM_BOOKING_ID_ENTRY` value

## Method 3: Using Browser Console (Quick Check)

1. **Open your Google Form** in view mode
2. **Open Developer Tools** (`F12`)
3. **Go to Console tab**
4. **Run this JavaScript:**
   ```javascript
   document.querySelectorAll('input[name^="entry."]').forEach(input => {
     console.log('Field:', input.name, '| Label:', input.closest('.freebirdFormviewerViewItemsItemItem')?.querySelector('.freebirdFormviewerViewItemsItemItemTitle')?.textContent || 'N/A');
   });
   ```
5. **Look for your Booking ID field** in the console output
   - Match it by the label/question text
   - Note the `entry.XXXXX` value

## Complete Step-by-Step Example

### Part 1: Adding the Field

1. Open your Google Form in edit mode
2. Click the **"+" button** to add a new question
3. Select **"Short answer"**
4. Set the question title to **"Booking ID"**
5. Add description: "This will be automatically filled"
6. Save the form

### Part 2: Getting the Field ID

Now your form has these fields:
- **Booking ID** ← The new field you just added
- Name
- Email
- Phone
- Service Type

### Using Method 1 (Recommended):

1. Open form → Three dots → "Get pre-filled link"
2. Fill in "Booking ID" field with `TEST123`
3. Click "Get link"
4. URL looks like:
   ```
   https://docs.google.com/forms/d/e/1a2b3c4d5e6f7g8h9i0j/viewform?usp=pp_url&entry.9876543210=TEST123
   ```
5. Your `GOOGLE_FORM_BOOKING_ID_ENTRY` = `entry.9876543210`

### Update Your .env.local:

```env
GOOGLE_FORM_BOOKING_ID_ENTRY=entry.9876543210
GOOGLE_FORM_DATE_ENTRY=entry.1234567890  # Optional: only if you added a date field
GOOGLE_FORM_TIME_ENTRY=entry.1122334455  # Optional: only if you added a time field
GOOGLE_FORM_SERVICE_LOCATION_ENTRY=entry.2233445566  # Optional: only if you added a service location field
```

**Note**: 
- `GOOGLE_FORM_DATE_ENTRY`, `GOOGLE_FORM_TIME_ENTRY`, and `GOOGLE_FORM_SERVICE_LOCATION_ENTRY` are optional. If you don't set them, the system will still work but won't auto-fill those fields.
- The time field automatically formats:
  - Single slot: "10:30 AM"
  - Paired slots (mani-pedi): "10:30 AM - 1:00 PM"
- The service location field will be automatically filled with:
  - "Homebased Studio" for studio appointments
  - "Home Service" for home service appointments

## Important Notes

- ✅ Each field in your Google Form has a unique `entry.XXXXX` ID
- ✅ The ID is a number (can be 8-10 digits)
- ✅ The format is always `entry.` followed by numbers
- ✅ Field IDs don't change unless you delete and recreate the field
- ⚠️ If you delete a field and add a new one, you'll get a new ID

## Troubleshooting

**Can't find "Get pre-filled link" option?**
- Make sure you're the owner/editor of the form
- Try using Method 2 or 3 instead

**The field ID doesn't work?**
- Double-check you copied the entire `entry.XXXXX` value
- Make sure there are no extra spaces
- Verify the field still exists in your form
- Try the prefill method again to confirm the ID

**Multiple fields with similar names?**
- Use the prefill method and fill only the Booking ID field
- Check the URL to see which `entry.` parameter was added

## Testing Your Configuration

After setting your environment variables, test them:

1. Create a test booking in your system (select a date and time slot)
2. The system should generate a pre-filled Google Form URL
3. Open that URL and verify:
   - ✅ The **Booking ID** field is automatically filled with the booking ID
   - ✅ The **Appointment Date** field (if configured) is automatically filled with the selected date in MM/DD/YYYY format
   - ✅ The **Appointment Time** field (if configured) is automatically filled:
     - Single slot: "10:30 AM" format
     - Paired slots (mani-pedi): "10:30 AM - 1:00 PM" format
   - ✅ The **Service Location** field (if configured) is automatically filled:
     - "Homebased Studio" for studio appointments
     - "Home Service" for home service appointments
   - ✅ The values match what you expect from your system

### Troubleshooting

**Booking ID not pre-filled?**
- Double-check your `GOOGLE_FORM_BOOKING_ID_ENTRY` value
- Make sure there are no extra spaces
- Verify the field still exists in your form

**Date not pre-filled?**
- Make sure you set `GOOGLE_FORM_DATE_ENTRY` in your `.env.local`
- Verify the date field exists in your form
- Check that the entry ID is correct
- The date will be formatted as MM/DD/YYYY (e.g., 12/25/2024)

**Time not pre-filled?**
- Make sure you set `GOOGLE_FORM_TIME_ENTRY` in your `.env.local`
- Verify the time field exists in your form
- Check that the entry ID is correct
- The time will be formatted in 12-hour format (e.g., "10:30 AM" or "10:30 AM - 1:00 PM" for paired slots)

**Service Location not pre-filled?**
- Make sure you set `GOOGLE_FORM_SERVICE_LOCATION_ENTRY` in your `.env.local`
- Verify the service location field exists in your form
- Check that the entry ID is correct
- The location will be formatted as "Homebased Studio" or "Home Service"

**Fields not working?**
- Restart your development server after updating `.env.local`
- For production, make sure you've added the variables in Vercel dashboard

