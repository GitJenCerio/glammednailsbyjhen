import { NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/googleSheets';
import { listCustomers, updateCustomer, extractCustomerInfo } from '@/lib/services/customerService';
import { extractSheetId } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

/**
 * Update "Unknown Customer" records with details from Google Sheets form responses
 * Matches customers by email address and fills in missing information
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sheetUrl } = body ?? {};
    
    // Extract sheet ID from URL or use environment variable
    const sheetId = sheetUrl ? extractSheetId(sheetUrl) : process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) {
      return NextResponse.json(
        { error: 'Missing Google Sheets ID. Please provide sheetUrl or set GOOGLE_SHEETS_ID in environment variables.' },
        { status: 400 }
      );
    }

    // Get all customers with "Unknown Customer" name that have an email
    // Query directly for efficiency instead of loading all customers
    const { adminDb } = await import('@/lib/firebaseAdmin');
    const customersCollection = adminDb.collection('customers');
    const unknownCustomersSnapshot = await customersCollection
      .where('name', '==', 'Unknown Customer')
      .get();
    
    const unknownCustomers = unknownCustomersSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          socialMediaName: data.socialMediaName,
          referralSource: data.referralSource,
        };
      })
      .filter((customer) => customer.email && customer.email.trim() !== '');

    if (unknownCustomers.length === 0) {
      return NextResponse.json({
        message: 'No customers with "Unknown Customer" name and email found.',
        updated: 0,
        checked: 0,
      });
    }

    // Fetch Google Sheets data
    const range = process.env.GOOGLE_SHEETS_RANGE ?? "'Form Responses 1'!A:Z";
    const rows = await fetchSheetRows(range, sheetId);
    
    if (!rows || rows.length < 2) {
      return NextResponse.json(
        { error: 'No data found in Google Sheets or sheet is empty.' },
        { status: 400 }
      );
    }

    const [header, ...dataRows] = rows;
    const originalHeader = header.map((h) => (h || '').trim());

    // Find email column index
    const emailColumnIndex = originalHeader.findIndex(
      (h) => {
        const lower = h.toLowerCase();
        return lower.includes('email') && !lower.includes('facebook') && !lower.includes('instagram');
      }
    );

    if (emailColumnIndex === -1) {
      return NextResponse.json(
        { error: 'Email column not found in Google Sheets. Available columns: ' + originalHeader.filter(h => h).join(', ') },
        { status: 400 }
      );
    }

    // Build a map of email -> form data for quick lookup
    const emailToFormData = new Map<string, { data: Record<string, string>; fieldOrder: string[] }>();
    
    for (const row of dataRows) {
      if (!row || row.length === 0) continue;
      
      const email = (row[emailColumnIndex] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;

      // Build customer data record from form row
      const customerData: Record<string, string> = {};
      const fieldOrder: string[] = [];
      
      originalHeader.forEach((originalKey, columnIndex) => {
        if (!originalKey) return;
        const value = (row[columnIndex] || '').trim();
        if (value) {
          customerData[originalKey] = value;
          fieldOrder.push(originalKey);
        }
      });

      // Store the most recent form data for each email (later rows overwrite earlier ones)
      emailToFormData.set(email, { data: customerData, fieldOrder });
    }

    // Match and update customers
    let updated = 0;
    let checked = 0;
    const results: Array<{ customerId: string; email: string; oldName: string; newName: string; updatedFields: string[] }> = [];

    for (const customer of unknownCustomers) {
      checked++;
      const customerEmail = customer.email!.toLowerCase().trim();
      
      const formDataEntry = emailToFormData.get(customerEmail);
      if (!formDataEntry) {
        continue; // No matching form data found
      }

      try {
        // Extract customer info from form data
        const extractedInfo = extractCustomerInfo(formDataEntry.data, formDataEntry.fieldOrder);
        
        // Build update object - only update fields that are missing or are "Unknown Customer"
        const updates: any = {};
        let hasUpdates = false;

        // Update name if we have a better one
        if (extractedInfo.name && 
            extractedInfo.name !== 'Unknown Customer' && 
            customer.name === 'Unknown Customer') {
          updates.name = extractedInfo.name;
          hasUpdates = true;
        }

        // Update firstName if missing
        if (extractedInfo.firstName && !customer.firstName) {
          updates.firstName = extractedInfo.firstName;
          hasUpdates = true;
        }

        // Update lastName if missing
        if (extractedInfo.lastName && !customer.lastName) {
          updates.lastName = extractedInfo.lastName;
          hasUpdates = true;
        }

        // Update phone if missing
        if (extractedInfo.phone && !customer.phone) {
          updates.phone = extractedInfo.phone;
          hasUpdates = true;
        }

        // Update socialMediaName if missing
        if (extractedInfo.socialMediaName && !customer.socialMediaName) {
          updates.socialMediaName = extractedInfo.socialMediaName;
          hasUpdates = true;
        }

        // Update referralSource if missing
        if (extractedInfo.referralSource && !customer.referralSource) {
          updates.referralSource = extractedInfo.referralSource;
          hasUpdates = true;
        }

        // Only update if we have changes
        if (hasUpdates) {
          const updatedCustomer = await updateCustomer(customer.id, updates);
          updated++;
          
          const updatedFields = Object.keys(updates);
          results.push({
            customerId: customer.id,
            email: customer.email!,
            oldName: customer.name,
            newName: updatedCustomer.name,
            updatedFields,
          });
        }
      } catch (error: any) {
        console.error(`Error updating customer ${customer.id} (${customer.email}):`, error);
        // Continue with next customer
      }
    }

    return NextResponse.json({
      message: `Checked ${checked} customers, updated ${updated} customers.`,
      checked,
      updated,
      results,
    });
  } catch (error: any) {
    console.error('Error updating customers from sheets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update customers from Google Sheets.' },
      { status: 500 }
    );
  }
}

