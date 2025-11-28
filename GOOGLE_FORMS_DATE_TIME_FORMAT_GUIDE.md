# Google Forms Date & Time Format Guide

This guide explains the correct formats for pre-filling date and time fields in Google Forms.

## Date Format Issues

Google Forms accepts different date formats depending on the **field type** you use:

### Option 1: Short Answer Field (Recommended)

**Field Type**: "Short answer"  
**Format**: `MM/DD/YYYY` (e.g., `12/25/2024`)  
**Example**: `12/25/2024`

**Pros**: 
- Works reliably with pre-fill
- Flexible format
- Easy to read

**Cons**: 
- Users can edit it (but we validate on backend)

### Option 2: Date Picker Field

**Field Type**: "Date"  
**Format**: `YYYY-MM-DD` (e.g., `2024-12-25`)  
**Example**: `2024-12-25`

**Pros**: 
- Native date picker UI
- Better validation

**Cons**: 
- May not work with pre-fill in all cases
- Less flexible

## Time Format Issues

### Recommended Format

**Field Type**: "Short answer"  
**Format**: `H:MM AM/PM` (e.g., `10:30 AM`, `1:00 PM`)  
**Examples**:
- Single slot: `10:30 AM`
- Paired slots: `10:30 AM - 1:00 PM`

**Important Notes**:
- Use 12-hour format with AM/PM
- Include space before AM/PM
- Use `:` between hours and minutes
- For paired slots, use ` - ` (space, dash, space) between times

## Common Format Problems

### Problem 1: Date Not Pre-filling

**Symptom**: Date field is empty when form opens

**Possible Causes**:
1. Wrong field ID in `GOOGLE_FORM_DATE_ENTRY`
2. Field type mismatch (using "Date" picker but sending `MM/DD/YYYY`)
3. Environment variable not set

**Solutions**:
- Verify field ID using prefill method
- Use "Short answer" field type
- Check `.env.local` has `GOOGLE_FORM_DATE_ENTRY` set
- Restart server after updating `.env.local`

### Problem 2: Time Not Pre-filling

**Symptom**: Time field is empty when form opens

**Possible Causes**:
1. Wrong field ID in `GOOGLE_FORM_TIME_ENTRY`
2. Spaces in time format causing encoding issues
3. Environment variable not set

**Solutions**:
- Verify field ID using prefill method
- Use "Short answer" field type
- Check `.env.local` has `GOOGLE_FORM_TIME_ENTRY` set
- The system automatically formats time correctly

### Problem 3: Date/Time Shows But Wrong Format

**Symptom**: Fields are pre-filled but format looks wrong

**Solutions**:
- This is usually fine - Google Forms will display it
- If using "Date" picker, try switching to "Short answer"
- The format we send (`MM/DD/YYYY` and `10:30 AM`) should work for most cases

## Testing Your Format

### Step 1: Test Date Format

1. Open your Google Form → Three dots (⋮) → "Get pre-filled link"
2. Fill in date field with: `12/25/2024`
3. Get link and check URL: `entry.XXXXX=12/25/2024`
4. If this works, our format is correct

### Step 2: Test Time Format

1. Use same prefill method
2. Fill in time field with: `10:30 AM`
3. Get link and check URL: `entry.XXXXX=10:30%20AM` (space becomes `%20`)
4. If this works, our format is correct

### Step 3: Test Combined

1. Fill both date and time
2. Get link
3. Check both parameters are in the URL
4. Open the link and verify both fields are filled

## Format Reference

### Current System Formats

**Date**: `MM/DD/YYYY`
- Example: `12/25/2024`
- Input: `2024-12-25` (YYYY-MM-DD from database)
- Output: `12/25/2024` (MM/DD/YYYY for form)

**Time (Single)**: `H:MM AM/PM`
- Example: `10:30 AM`, `1:00 PM`
- Input: `10:30` (24-hour from database)
- Output: `10:30 AM` (12-hour for form)

**Time (Paired)**: `H:MM AM/PM - H:MM AM/PM`
- Example: `10:30 AM - 1:00 PM`
- Input: `10:30` and `13:00` (24-hour from database)
- Output: `10:30 AM - 1:00 PM` (12-hour range for form)

## Alternative Formats (If Current Doesn't Work)

If `MM/DD/YYYY` doesn't work, you can try:

### Date Alternative 1: YYYY-MM-DD
```typescript
// In bookingService.ts, change line 123 to:
formattedDate = `${year}-${month}-${day}`; // Instead of MM/DD/YYYY
```

### Date Alternative 2: DD/MM/YYYY
```typescript
// In bookingService.ts, change line 123 to:
formattedDate = `${day}/${month}/${year}`; // Instead of MM/DD/YYYY
```

### Time Alternative: 24-Hour Format
```typescript
// In bookingService.ts, change formatTime12Hour to return 24-hour:
return `${hours}:${minutes}`; // Instead of 12-hour format
```

## Debugging Steps

1. **Check Environment Variables**:
   ```bash
   # In your server console, check if variables are loaded
   console.log(process.env.GOOGLE_FORM_DATE_ENTRY);
   console.log(process.env.GOOGLE_FORM_TIME_ENTRY);
   ```

2. **Check Generated URL**:
   - Create a test booking
   - Look at the generated Google Form URL
   - Verify the date/time parameters are present
   - Check the format matches what Google Forms expects

3. **Test Manually**:
   - Copy the generated URL
   - Open it in a browser
   - Check if fields are pre-filled
   - If not, check the URL parameters match your field IDs

4. **Verify Field Types**:
   - Make sure date field is "Short answer" (not "Date" picker)
   - Make sure time field is "Short answer" (not "Time" picker)

## Quick Fix Checklist

- [ ] `GOOGLE_FORM_DATE_ENTRY` is set in `.env.local`
- [ ] `GOOGLE_FORM_TIME_ENTRY` is set in `.env.local`
- [ ] Field IDs are correct (match prefill URL)
- [ ] Date field is "Short answer" type
- [ ] Time field is "Short answer" type
- [ ] Server restarted after updating `.env.local`
- [ ] Check browser console for any errors
- [ ] Check server console for warnings
- [ ] Test the generated URL manually

## Still Not Working?

If the formats above don't work, try:

1. **Test with Google Forms prefill directly**:
   - Use Google's prefill tool
   - See what format works
   - Match that format in the code

2. **Check field IDs again**:
   - Make sure you're using the correct `entry.XXXXX` values
   - Field IDs can change if you delete and recreate fields

3. **Try different date format**:
   - If `MM/DD/YYYY` doesn't work, try `YYYY-MM-DD`
   - Or try `DD/MM/YYYY` depending on your locale

4. **Check URL encoding**:
   - Spaces should become `%20`
   - Special characters should be encoded
   - The `URLSearchParams` API handles this automatically


