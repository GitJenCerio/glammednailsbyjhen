import { NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/googleSheets';
import { findOrCreateCustomer, listCustomers, updateCustomer } from '@/lib/services/customerService';
import { extractCustomerInfo } from '@/lib/services/customerService';

interface ImportResult {
  totalRows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  incomplete: number;
  errors: Array<{ row: number; error: string }>;
  duplicateGroups: Array<{
    key: string;
    customers: Array<{ name: string; email?: string; phone?: string; socialMediaName?: string; referralSource?: string; row: number }>;
  }>;
}

/**
 * Normalize phone numbers for comparison (remove spaces, dashes, parentheses)
 */
function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-\(\)]/g, '').trim();
}

/**
 * Normalize email for comparison (lowercase, trim)
 */
function normalizeEmail(email?: string): string | null {
  if (!email) return null;
  return email.toLowerCase().trim() || null;
}

/**
 * Normalize name for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two names are similar (for fuzzy matching)
 */
function areNamesSimilar(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  // Exact match
  if (n1 === n2) return true;
  
  // Check if one name contains the other (handles nicknames)
  if (n1.includes(n2) || n2.includes(n1)) {
    // Only consider similar if the shorter name is at least 3 characters
    const shorter = n1.length < n2.length ? n1 : n2;
    if (shorter.length >= 3) return true;
  }
  
  // Check if they share significant words (at least 2 words match)
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  const commonWords = words1.filter(w => words2.includes(w));
  if (commonWords.length >= 2) return true;
  
  return false;
}

/**
 * Find duplicate groups in the import data
 */
function findDuplicateGroups(
  rows: Array<{ name: string; email?: string; phone?: string; socialMediaName?: string; referralSource?: string; row: number; data: Record<string, string> }>
): Map<string, Array<{ name: string; email?: string; phone?: string; socialMediaName?: string; referralSource?: string; row: number }>> {
  const groups = new Map<string, Array<{ name: string; email?: string; phone?: string; row: number }>>();
  
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    const phone = normalizePhone(row.phone);
    const name = normalizeName(row.name);
    
    // Create keys for matching
    const keys: string[] = [];
    
    if (email) keys.push(`email:${email}`);
    if (phone) keys.push(`phone:${phone}`);
    
    // For rows without email/phone, try to match by name similarity
    if (!email && !phone) {
      // Check if this name is similar to any existing group
      let foundGroup = false;
      for (const [key, group] of groups.entries()) {
        if (key.startsWith('name:')) {
          const existingName = key.replace('name:', '');
          if (areNamesSimilar(name, existingName)) {
            groups.get(key)!.push({ name: row.name, email: row.email, phone: row.phone, row: row.row });
            foundGroup = true;
            break;
          }
        }
      }
      if (!foundGroup) {
        keys.push(`name:${name}`);
      }
    }
    
    // Add to groups based on keys
    for (const key of keys) {
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push({ name: row.name, email: row.email, phone: row.phone, row: row.row });
    }
  }
  
  // Filter to only return groups with duplicates
  const duplicateGroups = new Map<string, Array<{ name: string; email?: string; phone?: string; socialMediaName?: string; referralSource?: string; row: number }>>();
  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      duplicateGroups.set(key, group);
    }
  }
  
  return duplicateGroups;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      sheetRange = process.env.GOOGLE_SHEETS_RANGE ?? "'Form Responses 1'!A:Z",
      sheetId, // Optional: specify a different Google Sheets ID for old data
      nameColumns = ['Name', 'Full Name', 'First Name'],
      surnameColumns = ['Surname', 'Last Name', 'LastName'],
      emailColumns = ['Email', 'Email Address', 'E-mail'],
      phoneColumns = ['Phone', 'Phone Number', 'Contact', 'Contact Number', 'Mobile'],
      socialMediaColumns = ['Facebook or Instagram Name. (The one you used to inquire with me.)', 'Facebook or Instagram Name', 'FB Name', 'FB name/Instagram name', 'Facebook Name', 'Instagram Name', 'Social Media Name'],
      referralSourceColumns = [
        'How did you find out about glammednailsbyjhen?', // Exact match from old sheets
        'How did you find out about glammednailsbyjhen', // Without question mark
        'How did you find out about glammednails',
        'How did you find out about Glammed Nails',
        'How did you find out about Glammed Nails by Jhen',
        'How did you find out about glammed nails by jhen',
        'Referral Source',
        'referral source',
        'How did you hear about us',
        'How did you hear about us?',
        'Source',
        'source'
      ],
      dryRun = false // If true, only analyze without importing
    } = body;

    // Fetch data from Google Sheets (use provided sheetId or default from env)
    const rows = await fetchSheetRows(sheetRange, sheetId);
    if (!rows.length) {
      return NextResponse.json({ 
        error: 'No data found in sheet',
        result: {
          totalRows: 0,
          processed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          duplicates: 0,
          incomplete: 0,
          errors: [],
          duplicateGroups: []
        }
      });
    }

    const [header, ...dataRows] = rows;
    const headerLower = header.map((h: string) => (h || '').toLowerCase().trim());

    // Find column indices - try exact match first, then partial match
    const findColumnIndex = (possibleNames: string[]): number => {
      // First try exact match (case-insensitive, trim both sides)
      for (const name of possibleNames) {
        const normalizedName = name.toLowerCase().trim();
        const index = headerLower.findIndex(h => h.trim() === normalizedName);
        if (index !== -1) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Found exact match for "${name}" at index ${index}: "${header[index]}"`);
          }
          return index;
        }
      }
      // Then try partial match (contains)
      for (const name of possibleNames) {
        const normalizedName = name.toLowerCase().trim();
        const index = headerLower.findIndex(h => h.trim().includes(normalizedName));
        if (index !== -1) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Found partial match for "${name}" at index ${index}: "${header[index]}"`);
          }
          return index;
        }
      }
      return -1;
    };

    const nameColIndex = findColumnIndex(nameColumns.map((c: string) => c.toLowerCase()));
    const surnameColIndex = findColumnIndex(surnameColumns.map((c: string) => c.toLowerCase()));
    const emailColIndex = findColumnIndex(emailColumns.map((c: string) => c.toLowerCase()));
    const phoneColIndex = findColumnIndex(phoneColumns.map((c: string) => c.toLowerCase()));
    const socialMediaColIndex = findColumnIndex(socialMediaColumns.map((c: string) => c.toLowerCase()));
    const referralSourceColIndex = findColumnIndex(referralSourceColumns.map((c: string) => c.toLowerCase()));
    
    // Debug: Log found columns
    console.log('=== Column Detection Results ===');
    console.log('Name column:', nameColIndex !== -1 ? `Found at index ${nameColIndex}: "${header[nameColIndex]}"` : 'NOT FOUND');
    console.log('Surname column:', surnameColIndex !== -1 ? `Found at index ${surnameColIndex}: "${header[surnameColIndex]}"` : 'NOT FOUND');
    console.log('Email column:', emailColIndex !== -1 ? `Found at index ${emailColIndex}: "${header[emailColIndex]}"` : 'NOT FOUND');
    console.log('Phone column:', phoneColIndex !== -1 ? `Found at index ${phoneColIndex}: "${header[phoneColIndex]}"` : 'NOT FOUND');
    console.log('Social Media column:', socialMediaColIndex !== -1 ? `Found at index ${socialMediaColIndex}: "${header[socialMediaColIndex]}"` : 'NOT FOUND');
    console.log('Referral Source column:', referralSourceColIndex !== -1 ? `Found at index ${referralSourceColIndex}: "${header[referralSourceColIndex]}"` : 'NOT FOUND');
    console.log('All headers:', header.filter((h: string) => h).map((h, i) => `${i}: "${h}"`).join(', '));
    
    // If referral source column not found, search for it manually
    if (referralSourceColIndex === -1) {
      console.log('⚠️ Referral source column not found by index. Searching all headers...');
      for (let i = 0; i < header.length; i++) {
        const h = header[i];
        if (h) {
          const lowerH = h.toLowerCase().trim();
          if (lowerH.includes('find out') && lowerH.includes('glammednails')) {
            console.log(`Found potential referral source column at index ${i}: "${h}"`);
          }
        }
      }
    }

    if (nameColIndex === -1) {
      return NextResponse.json({ 
        error: 'Name column not found. Available columns: ' + header.filter((h: string) => h).join(', '),
        result: null
      }, { status: 400 });
    }

    // Extract customer data from rows
    const customerRows: Array<{ 
      name: string; 
      email?: string; 
      phone?: string; 
      row: number; 
      data: Record<string, string> 
    }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      // Extract name
      const firstName = (row[nameColIndex] || '').trim();
      const lastName = surnameColIndex !== -1 ? (row[surnameColIndex] || '').trim() : '';
      const name = `${firstName}${firstName && lastName ? ' ' : ''}${lastName}`.trim();

      if (!name || name === '') continue;

      // Extract email, phone, social media, and referral source
      const email = emailColIndex !== -1 ? (row[emailColIndex] || '').trim() : undefined;
      const phone = phoneColIndex !== -1 ? (row[phoneColIndex] || '').trim() : undefined;
      const socialMediaName = socialMediaColIndex !== -1 ? (row[socialMediaColIndex] || '').trim() : undefined;
      let referralSource = referralSourceColIndex !== -1 ? (row[referralSourceColIndex] || '').trim() : undefined;
      
      // If referral source not found by index, search in all columns
      if (!referralSource) {
        for (let colIdx = 0; colIdx < header.length; colIdx++) {
          const headerName = header[colIdx];
          if (headerName) {
            const lowerHeader = headerName.toLowerCase().trim();
            if (lowerHeader === 'how did you find out about glammednailsbyjhen?' ||
                lowerHeader === 'how did you find out about glammednailsbyjhen' ||
                (lowerHeader.includes('find out') && lowerHeader.includes('glammednails'))) {
              const value = row[colIdx];
              if (value && value.trim()) {
                referralSource = value.trim();
                console.log(`Found referral source in column "${headerName}" at index ${colIdx}: "${referralSource}"`);
                break;
              }
            }
          }
        }
      }

      // Build full customer data record
      const customerData: Record<string, string> = {};
      header.forEach((h: string, idx: number) => {
        if (h && row[idx]) {
          customerData[h] = (row[idx] || '').trim();
        }
      });
      
      // If referral source wasn't found by column index, try to find it in customerData by searching all keys
      if (!referralSource) {
        const keys = Object.keys(customerData);
        for (const key of keys) {
          const lowerKey = key.toLowerCase();
          if ((lowerKey.includes('find out') || lowerKey.includes('glammednails') || lowerKey.includes('referral') || lowerKey.includes('source') || lowerKey.includes('how did you')) && 
              customerData[key] && customerData[key].trim()) {
            // Found a matching field - use it
            const foundReferralSource = customerData[key].trim();
            if (foundReferralSource) {
              // Update the referralSource variable with the found value
              referralSource = foundReferralSource;
              break;
            }
          }
        }
      }

      const customerRowData = {
        name,
        email: email || undefined,
        phone: phone || undefined,
        socialMediaName: socialMediaName || undefined,
        referralSource: referralSource || undefined,
        row: i + 2, // +2 because header is row 1, and we're 0-indexed
        data: customerData
      };
      
      // If referral source wasn't found by column index, try to find it in customerData by searching all keys
      if (!customerRowData.referralSource) {
        const keys = Object.keys(customerData);
        for (const key of keys) {
          const lowerKey = key.toLowerCase().trim();
          // Check for exact match first
          if (lowerKey === 'how did you find out about glammednailsbyjhen?' || 
              lowerKey === 'how did you find out about glammednailsbyjhen') {
            customerRowData.referralSource = customerData[key].trim();
            break;
          }
          // Then check for partial matches
          if ((lowerKey.includes('find out') && lowerKey.includes('glammednails')) || 
              (lowerKey.includes('referral') || lowerKey.includes('source')) && 
              customerData[key] && customerData[key].trim()) {
            customerRowData.referralSource = customerData[key].trim();
            break;
          }
        }
      }
      
      customerRows.push(customerRowData);
    }

    // Find duplicate groups
    const duplicateGroupsMap = findDuplicateGroups(customerRows);
    const duplicateGroups = Array.from(duplicateGroupsMap.entries()).map(([key, customers]) => ({
      key,
      customers
    }));

    // Get existing customers for comparison
    const existingCustomers = await listCustomers();
    const existingByEmail = new Map(existingCustomers.filter(c => c.email).map(c => [normalizeEmail(c.email)!, c]));
    const existingByPhone = new Map(existingCustomers.filter(c => c.phone).map(c => [normalizePhone(c.phone)!, c]));

    const result: ImportResult = {
      totalRows: customerRows.length,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      duplicates: 0,
      incomplete: 0,
      errors: [],
      duplicateGroups
    };

    // Process each row
    if (!dryRun) {
      for (const customerRow of customerRows) {
        try {
          const email = normalizeEmail(customerRow.email);
          const phone = normalizePhone(customerRow.phone);

          // Check if customer already exists
          let existingCustomer = null;
          if (email && existingByEmail.has(email)) {
            existingCustomer = existingByEmail.get(email)!;
          } else if (phone && existingByPhone.has(phone)) {
            existingCustomer = existingByPhone.get(phone)!;
          }

          // Extract referral source from customerData - search all keys
          let finalReferralSource = customerRow.referralSource;
          if (!finalReferralSource && customerRow.data) {
            const keys = Object.keys(customerRow.data);
            for (const key of keys) {
              const lowerKey = key.toLowerCase().trim();
              // Check for exact match first
              if (lowerKey === 'how did you find out about glammednailsbyjhen?' || 
                  lowerKey === 'how did you find out about glammednailsbyjhen') {
                const value = customerRow.data[key];
                if (value && value.trim()) {
                  finalReferralSource = value.trim();
                  console.log(`Found referral source for row ${customerRow.row}: "${finalReferralSource}" from column "${key}"`);
                  break;
                }
              }
              // Then check for partial matches
              if ((lowerKey.includes('find out') && lowerKey.includes('glammednails')) ||
                  (lowerKey.includes('referral') || lowerKey.includes('source'))) {
                const value = customerRow.data[key];
                if (value && value.trim()) {
                  finalReferralSource = value.trim();
                  console.log(`Found referral source (partial match) for row ${customerRow.row}: "${finalReferralSource}" from column "${key}"`);
                  break;
                }
              }
            }
          }

          // Create or update customer - mark ALL imported customers as repeat clients
          // These are old clients from historical data (old Google Sheets), so they should be marked as repeat
          // even though they may not have bookings in the current system yet
          let customer;
          if (existingCustomer) {
            result.updated++;
            // Pass isRepeatClient: true to mark as repeat client (old client from historical data)
            customer = await findOrCreateCustomer(customerRow.data, undefined, true);
          } else {
            // Check if this is a duplicate within the import batch
            const isDuplicate = duplicateGroups.some(group => 
              group.customers.some(c => c.row === customerRow.row && group.customers.length > 1)
            );

            if (isDuplicate) {
              result.duplicates++;
            } else {
              result.created++;
            }
            // Pass isRepeatClient: true to mark as repeat client (old client from historical data)
            customer = await findOrCreateCustomer(customerRow.data, undefined, true);
          }
          
          // Explicitly update referral source and ensure repeat client status is set
          // This is a safety check to ensure all imported customers are marked as repeat clients
          const updates: any = {};
          if (finalReferralSource && !customer.referralSource) {
            updates.referralSource = finalReferralSource;
            console.log(`Updated customer ${customer.id} with referral source: "${finalReferralSource}"`);
          }
          // ALWAYS mark all imported customers as repeat clients
          // These are old clients from historical Google Sheets data, even if they have no bookings in current system
          if (customer.isRepeatClient !== true) {
            updates.isRepeatClient = true;
            console.log(`Marked customer ${customer.id} (${customer.name}) as repeat client - imported from old historical data`);
          }
          // Apply all updates at once
          if (Object.keys(updates).length > 0) {
            await updateCustomer(customer.id, updates);
          }

          // Check if incomplete
          if (!email && !phone) {
            result.incomplete++;
          }

          result.processed++;
        } catch (error: any) {
          result.errors.push({
            row: customerRow.row,
            error: error.message || 'Unknown error'
          });
          result.skipped++;
        }
      }
    } else {
      // Dry run: just analyze
      for (const customerRow of customerRows) {
        const email = normalizeEmail(customerRow.email);
        const phone = normalizePhone(customerRow.phone);

        if (!email && !phone) {
          result.incomplete++;
        }

        const isDuplicate = duplicateGroups.some(group => 
          group.customers.some(c => c.row === customerRow.row && group.customers.length > 1)
        );

        if (isDuplicate) {
          result.duplicates++;
        }

        result.processed++;
      }
    }

    return NextResponse.json({ 
      success: true,
      result,
      message: dryRun 
        ? `Analysis complete: ${result.processed} rows analyzed, ${result.duplicates} potential duplicates, ${result.incomplete} incomplete records`
        : `Import complete: ${result.created} created, ${result.updated} updated, ${result.duplicates} duplicates, ${result.incomplete} incomplete, ${result.errors.length} errors`
    });

  } catch (error: any) {
    console.error('Customer import error:', error);
    return NextResponse.json({ 
      error: error.message || 'Import failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

