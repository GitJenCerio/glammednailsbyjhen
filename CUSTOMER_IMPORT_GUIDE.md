# Customer Import Guide

## Overview

This guide explains how to import your historical customer data from Google Sheets (March 2024 - Dec 2025) into your booking system database. The system automatically handles duplicate detection and incomplete data.

## Features

✅ **Automatic Deduplication**: Customers with the same email or phone number are automatically merged  
✅ **Incomplete Data Handling**: Records missing email/phone are still imported  
✅ **Fuzzy Name Matching**: Detects similar names for better duplicate detection  
✅ **Import Analysis**: Preview duplicates and incomplete records before importing  
✅ **Repeat Customer Auto-fill**: Once imported, repeat customers will have their details auto-filled in future bookings

## How to Import Customers

### Step 0: Configure Google Sheets ID (One-time Setup)

**Important**: Before importing, you need to configure your Google Sheets ID in your environment variables.

1. **Find your Google Sheets ID**:
   - Open your Google Sheet
   - Look at the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Copy the long string between `/d/` and `/edit`
   - Example: If your URL is `https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit`, your ID is `1a2b3c4d5e6f7g8h9i0j`

2. **Add to `.env.local` file** (in your project root):
   ```env
   GOOGLE_SHEETS_ID=your_google_sheet_id_here
   GOOGLE_SHEETS_RANGE='Form Responses 1'!A:Z
   ```

3. **Share the Sheet with Service Account**:
   - Make sure your Google Sheet is shared with your Google Service Account email
   - The service account email is in your `.env.local` as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - Give it "Viewer" access (read-only is enough)

4. **Restart your development server** after updating `.env.local`

### Step 1: Access the Import Tool

1. Log in to your admin dashboard at `/admin`
2. Navigate to the **Customers** section
3. Scroll down to find the **"Import Customers from Google Sheets"** card

### Step 2: Configure the Import

1. **Old Google Sheet URL or ID**: 
   - **Important**: Since you have a new Google Sheet for current responses, you need to specify your **OLD Google Sheet** (March 2024 - Dec 2025)
   - You can paste either:
     - The full URL: `https://docs.google.com/spreadsheets/d/YOUR_OLD_SHEET_ID/edit`
     - Or just the Sheet ID: `YOUR_OLD_SHEET_ID`
   - The system will automatically extract the ID from the URL if you paste the full link
   - **Make sure to share this old sheet with your service account email** (found in `.env.local` as `GOOGLE_SERVICE_ACCOUNT_EMAIL`)

2. **Google Sheets Range**: Enter the range of cells to import
   - Default: `'Form Responses 1'!A:Z`
   - Format: `'Sheet Name'!A:Z` (adjust based on your sheet structure)
   - Example: `'Form Responses 1'!A1:Z1000` for first 1000 rows

### Step 3: Analyze First (Recommended)

1. Click **"Analyze Data First"** button
2. Review the results:
   - **Total Rows**: Number of customer records found
   - **Duplicates**: Records that appear multiple times
   - **Incomplete**: Records missing email and phone
   - **Duplicate Groups**: Detailed view of duplicate entries

### Step 4: Import Customers

1. After reviewing the analysis, click **"Import Customers"**
2. The system will:
   - Extract customer information (name, email, phone)
   - Deduplicate based on email/phone
   - Create or update customer records
   - Handle incomplete data gracefully

### Step 5: Review Results

After import, you'll see:
- **Created**: New customers added
- **Updated**: Existing customers updated with new information
- **Duplicates**: How many duplicates were merged
- **Incomplete**: Records without email/phone
- **Errors**: Any rows that failed to import

## How Deduplication Works

The system identifies duplicate customers using:

1. **Email Match**: If two records have the same email, they're considered the same customer
2. **Phone Match**: If two records have the same phone number, they're considered the same customer
3. **Name Similarity**: For records without email/phone, similar names are flagged as potential duplicates

### Example Scenarios

**Scenario 1: Same Customer, Multiple Bookings**
- Row 1: Name: "Jane Doe", Email: "jane@example.com", Phone: "123-456-7890"
- Row 2: Name: "Jane Doe", Email: "jane@example.com", Phone: "123-456-7890"
- **Result**: One customer record created, both bookings linked to same customer

**Scenario 2: Incomplete Data**
- Row 1: Name: "John Smith", Email: "", Phone: ""
- **Result**: Customer imported, but may be harder to match for repeat bookings

**Scenario 3: Name Variations**
- Row 1: Name: "Maria Garcia", Email: "maria@example.com"
- Row 2: Name: "Maria G.", Email: "maria@example.com"
- **Result**: One customer record (matched by email)

## Column Mapping

The system automatically detects these columns in your Google Sheet:

- **Name**: "Name", "Full Name", "First Name"
- **Surname**: "Surname", "Last Name", "LastName"
- **Email**: "Email", "Email Address", "E-mail"
- **Phone**: "Phone", "Phone Number", "Contact", "Mobile"

If your sheet uses different column names, you can customize them in the API call (advanced users only).

## Repeat Customer Auto-fill

Once customers are imported, the system will automatically:

1. **Detect Repeat Customers**: When a customer books again, the system checks their email/phone
2. **Auto-fill Forms**: For repeat customers, their information is automatically filled in the booking form
3. **Link Bookings**: All bookings from the same customer are linked together

### How It Works

When a customer submits a booking form:
1. System extracts email/phone from the form
2. Searches the customer database for a match
3. If found, the customer is marked as a "repeat client"
4. Future bookings can pre-fill their information

## Troubleshooting

### "Name column not found" Error

**Solution**: Check that your Google Sheet has a column with "Name", "Full Name", or "First Name" in the header.

### "No data found in sheet" Error

**Solution**: 
- Verify the sheet range is correct
- Ensure the Google Sheet is shared with your service account email
- Check that the sheet name matches exactly (case-sensitive)

### Duplicates Not Detected

**Possible Reasons**:
- Email/phone formats differ (e.g., "123-456-7890" vs "1234567890")
- Missing email/phone in some records
- Typos in email addresses

**Solution**: The system normalizes phone numbers and emails, but manual review may be needed for edge cases.

### Import Takes Too Long

**Solution**: 
- Import in smaller batches by adjusting the range (e.g., `'Form Responses 1'!A1:Z500`)
- Use the "Analyze" feature first to check data quality

## Best Practices

1. **Backup First**: Export your Google Sheet before importing
2. **Analyze Before Import**: Always use "Analyze Data First" to review duplicates
3. **Import in Batches**: For large datasets (1000+ rows), import in smaller chunks
4. **Review Duplicates**: Check the duplicate groups to ensure correct merging
5. **Update Missing Data**: After import, manually update customers with incomplete information

## API Endpoint (Advanced)

For programmatic access, use the API endpoint:

```bash
POST /api/customers/import
Content-Type: application/json

{
  "sheetRange": "'Form Responses 1'!A:Z",
  "dryRun": false
}
```

**Parameters**:
- `sheetRange`: Google Sheets range to import
- `dryRun`: If `true`, only analyzes without importing
- `nameColumns`: Array of column names for name (optional)
- `emailColumns`: Array of column names for email (optional)
- `phoneColumns`: Array of column names for phone (optional)

## Next Steps

After importing customers:

1. **Review Customer List**: Go to Customers section to see all imported customers
2. **Update Incomplete Records**: Manually add email/phone for incomplete records
3. **Test Repeat Booking**: Book as a repeat customer to verify auto-fill works
4. **Monitor Bookings**: Check that new bookings are correctly linked to customer records

## Support

If you encounter issues:
1. Check the error message for specific details
2. Verify your Google Sheets configuration
3. Ensure service account has access to the sheet
4. Review the duplicate groups to understand data quality

---

**Note**: The import process is designed to be safe and non-destructive. It only creates or updates customer records, never deletes existing data.

