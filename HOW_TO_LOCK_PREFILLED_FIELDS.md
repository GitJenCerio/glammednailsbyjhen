# How to Lock/Protect Pre-filled Fields in Google Forms

Unfortunately, **Google Forms does not have a native "read-only" or "locked" field option**. However, here are several workarounds to prevent or discourage users from editing pre-filled date and time fields:

## Option 1: Use Field Descriptions (Recommended - Easiest)

Add clear instructions in the field description telling users not to edit:

1. **Edit your Google Form**
2. Click on the **Appointment Date** field
3. In the description (the small text below the question), add:
   ```
   ⚠️ This field is automatically filled. Please DO NOT change it.
   ```
4. Do the same for the **Appointment Time** field
5. Make the field **Required** so users must acknowledge it

**Pros**: Simple, no technical setup
**Cons**: Users can still edit if they want (relies on instructions)

## Option 2: Use Paragraph Text for Display + Hidden Short Answer

This is a workaround using two fields:

1. **Create a "Short answer" field** (hidden from users) - This is what gets pre-filled
   - Title: "Appointment Date (System)" or similar
   - Make it required
   - This field will be pre-filled but users won't see it

2. **Create a "Paragraph" field** (visible, read-only display)
   - Title: "Your Appointment Date"
   - Description: "This is automatically set based on your booking selection"
   - Use Google Apps Script to copy the value from the hidden field to this display field

**Note**: This requires Google Apps Script setup (more complex)

## Option 3: Use Conditional Logic (Partial Protection)

1. **Create the date/time fields as usual**
2. **Add a confirmation question** after them:
   - "Is the date and time above correct?"
   - Options: "Yes" / "No"
3. **If "No" is selected**, show a message:
   - "Please contact us to reschedule. The date and time cannot be changed through this form."

**Pros**: Catches users who try to change it
**Cons**: Doesn't prevent editing, just flags it

## Option 4: Validation Rules (Best for Date)

For the **date field**, you can add validation:

1. Click on the date field
2. Click the **three dots (⋮)** → **"Response validation"**
3. Set validation to:
   - **Number** → **Equal to** → Enter the exact date value
   - Or use **Regular expression** to match the format

**Note**: This is complex and may not work well with pre-filled values

## Option 5: Google Apps Script (Most Secure - Advanced)

Use Google Apps Script to lock fields after pre-filling:

1. **Open your Google Form**
2. Click **three dots (⋮)** → **"Script editor"**
3. Add this script:

```javascript
function onFormSubmit(e) {
  // This runs when form is submitted
  // You can validate that date/time match the pre-filled values
  const form = FormApp.getActiveForm();
  const responses = form.getResponses();
  const lastResponse = responses[responses.length - 1];
  
  // Get the pre-filled values from your system
  // Compare with submitted values
  // If they don't match, you can reject or flag the response
}
```

**Pros**: Most secure, can actually prevent changes
**Cons**: Requires coding knowledge, more complex setup

## Recommended Approach: Option 1 + Visual Design

**Best practice combination:**

1. **Use clear field descriptions** (Option 1)
2. **Make fields visually distinct**:
   - Use a different background color or styling
   - Add emoji indicators: 📅 Date: (Auto-filled)
3. **Add a warning message** at the top of the form:
   ```
   ⚠️ IMPORTANT: The appointment date and time below are automatically set based on your booking selection. Please DO NOT change them. If you need to reschedule, please contact us directly.
   ```
4. **Make fields required** so users must see them
5. **Add validation in your backend** (check that submitted date/time matches the booking)

## Backend Validation (Recommended Addition)

Even if users can edit the fields, you can validate on your backend:

1. When the form is submitted, compare the submitted date/time with the booking record
2. If they don't match, flag the booking or send an alert
3. This way you'll know if someone changed the values

## Visual Design Tips

Make pre-filled fields stand out:

1. **Field Title**: 
   ```
   📅 Appointment Date (Auto-filled - Do Not Change)
   ```

2. **Field Description**:
   ```
   This date was automatically set based on your booking selection. Please do not edit.
   ```

3. **Add a section header** before the date/time fields:
   ```
   ════════════════════════════════════
   YOUR APPOINTMENT DETAILS
   (Pre-filled - Please verify, do not change)
   ════════════════════════════════════
   ```

## Summary

**For most use cases, I recommend:**
- ✅ **Option 1**: Clear descriptions and warnings
- ✅ **Visual design**: Make fields stand out
- ✅ **Backend validation**: Check submitted values match booking
- ✅ **Required fields**: Force users to see them

**For maximum security:**
- ✅ **Option 5**: Google Apps Script validation
- ✅ **Backend validation**: Always validate on your server

## Important Note

Google Forms is designed to allow users to edit any field. There's no way to completely lock a field using only Google Forms features. The best approach is a combination of:
1. Clear instructions
2. Visual indicators
3. Backend validation
4. Monitoring for changes

If you need truly locked fields, consider using a custom form solution or Google Apps Script with more advanced validation.


