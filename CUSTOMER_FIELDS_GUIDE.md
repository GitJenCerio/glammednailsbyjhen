# Customer Fields Guide

## Overview

The customer database now supports additional fields extracted from your Google Sheets data. This guide explains what fields are extracted and how they're displayed.

## Customer Fields

### Basic Information
- **Name** (Full Name) - Required
- **First Name** - Extracted separately
- **Last Name** (Surname) - Extracted separately

### Contact Information
- **Email Address** - Extracted from various column names
- **Contact Number** - Phone number(s), extracted from various column names

### Social Media & Marketing
- **FB Name / Instagram Name** - Social media handle
- **How did you find out about glammednailsbyjhen?** - Referral source/marketing channel

### Additional
- **Notes** - Admin notes about the customer

## Column Name Variations Supported

The system automatically detects these column names in your Google Sheet:

### Name Fields
- `Name`, `name`, `Full Name`, `fullName`, `Customer Name`, `customerName` → **First Name**
- `Surname`, `surname`, `Last Name`, `lastName`, `Customer Surname`, `customerSurname` → **Last Name**

### Email Fields
- `Email`, `email`, `E-mail`, `Email Address`, `emailAddress`

### Phone/Contact Fields
- `Phone`, `phone`, `Phone Number`, `phoneNumber`
- `Contact`, `contact`, `Contact Number`, `contactNumber`
- `Mobile`, `mobile`

### Social Media Fields
- `FB Name`, `fb name`, `Facebook Name`, `facebookName`
- `Instagram Name`, `instagramName`
- `Social Media Name`, `socialMediaName`
- `FB name/Instagram name`, `FB/Instagram`

### Referral Source Fields
- `How did you find out about glammednails`
- `How did you find out about glammednailsbyjhen`
- `How did you find out about glammednailsbyjhen`
- `Referral Source`, `referralSource`
- `How did you hear about us`, `How did you hear about us?`
- `Source`, `source`

## Display in Customer Information

All these fields are displayed in the **Customer Detail Panel** in the admin dashboard:

1. **Personal Information Section**:
   - First Name & Last Name (if available)
   - Email Address
   - Contact Number
   - FB/Instagram Name
   - How found us (Referral Source)

2. **Statistics Section**:
   - Total Bookings
   - Confirmed/Pending/Cancelled counts
   - Lifetime Value

3. **Notes Section**:
   - Admin notes

4. **Recent Bookings**:
   - List of customer's bookings

## Editing Customer Information

You can edit all customer fields by:
1. Going to Admin Dashboard → Customers section
2. Selecting a customer
3. Clicking "Edit" button
4. Updating any fields
5. Clicking "Save"

## Import Behavior

When importing from Google Sheets:
- All fields are automatically extracted based on column names
- If a column name doesn't match exactly, the system tries common variations
- Missing fields are stored as `undefined` (not displayed)
- Fields can be updated later through the edit interface

## Best Practices

1. **Consistent Column Names**: Use consistent column names in your Google Form/Sheet for better extraction
2. **Update Missing Data**: After import, review customers and manually add missing information
3. **Use Notes**: Add important customer preferences or notes in the Notes field
4. **Track Referrals**: The referral source field helps you understand which marketing channels work best

## Example Google Sheet Structure

Your Google Sheet should have columns like:

| Name | Surname | Email | Contact Number | FB name/Instagram name | How did you find out about glammednails |
|------|---------|-------|----------------|----------------------|------------------------------------------|
| Jane | Doe | jane@example.com | 09123456789 | @janedoe | Facebook |
| John | Smith | john@example.com | 09987654321 | john_smith | Friend referral |

The system will automatically extract and organize this data into the customer database.

---

**Note**: The system is flexible and will work with variations of these column names. If your sheet uses different names, the system will still try to extract the data, but you may need to manually update some records after import.

