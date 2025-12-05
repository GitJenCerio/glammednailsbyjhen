import { NextResponse } from 'next/server';
import { listCustomers, updateCustomer, getCustomerById, deleteCustomer } from '@/lib/services/customerService';
import { getBookingsByCustomer } from '@/lib/services/customerService';
import { adminDb } from '@/lib/firebaseAdmin';
import type { Customer } from '@/lib/types';

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
  
  // Check if one contains the other (for cases like "John" vs "John Doe")
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Check if they share significant words (at least 2 words match)
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  const commonWords = words1.filter(w => words2.includes(w));
  if (commonWords.length >= 2) return true;
  
  return false;
}

/**
 * Merge customer data - keep the most complete record
 */
function mergeCustomers(primary: Customer, duplicate: Customer): Partial<Customer> {
  const merged: Partial<Customer> = {
    name: primary.name, // Keep primary name
    // Keep primary values, but use duplicate if primary is missing
    firstName: primary.firstName || duplicate.firstName,
    lastName: primary.lastName || duplicate.lastName,
    email: primary.email || duplicate.email,
    phone: primary.phone || duplicate.phone,
    socialMediaName: primary.socialMediaName || duplicate.socialMediaName,
    referralSource: primary.referralSource || duplicate.referralSource,
    isRepeatClient: primary.isRepeatClient || duplicate.isRepeatClient,
    notes: primary.notes || duplicate.notes,
  };
  return merged;
}

/**
 * Find duplicate customers and merge them
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = false } = body; // If true, only analyze without merging
    
    const customers = await listCustomers();
    const duplicateGroups: Array<{ primary: Customer; duplicates: Customer[] }> = [];
    const processed = new Set<string>();
    
    // Group customers by email, phone, or similar name
    for (let i = 0; i < customers.length; i++) {
      if (processed.has(customers[i].id)) continue;
      
      const customer = customers[i];
      const email = normalizeEmail(customer.email);
      const phone = normalizePhone(customer.phone);
      const name = normalizeName(customer.name);
      
      const duplicates: Customer[] = [];
      
      // Find duplicates
      for (let j = i + 1; j < customers.length; j++) {
        if (processed.has(customers[j].id)) continue;
        
        const other = customers[j];
        const otherEmail = normalizeEmail(other.email);
        const otherPhone = normalizePhone(other.phone);
        const otherName = normalizeName(other.name);
        
        let isDuplicate = false;
        
        // Match by email (if both have emails)
        if (email && otherEmail && email === otherEmail) {
          isDuplicate = true;
        }
        // Match by phone (if both have phones)
        else if (phone && otherPhone && phone === otherPhone) {
          isDuplicate = true;
        }
        // Match by similar name (if no email/phone or if names are very similar)
        else if (areNamesSimilar(name, otherName)) {
          // Only match by name if:
          // 1. Both have no email/phone, OR
          // 2. Names are very similar (exact match or one contains the other)
          if ((!email && !phone && !otherEmail && !otherPhone) ||
              (name === otherName) ||
              (name.includes(otherName) || otherName.includes(name))) {
            isDuplicate = true;
          }
        }
        
        if (isDuplicate) {
          duplicates.push(other);
          processed.add(other.id);
        }
      }
      
      if (duplicates.length > 0) {
        // Choose primary customer (the one with more complete data)
        const allCustomers = [customer, ...duplicates];
        const primary = allCustomers.reduce((best, current) => {
          let bestScore = 0;
          let currentScore = 0;
          
          if (best.email) bestScore += 2;
          if (best.phone) bestScore += 2;
          if (best.firstName) bestScore += 1;
          if (best.lastName) bestScore += 1;
          if (best.socialMediaName) bestScore += 1;
          if (best.referralSource) bestScore += 1;
          
          if (current.email) currentScore += 2;
          if (current.phone) currentScore += 2;
          if (current.firstName) currentScore += 1;
          if (current.lastName) currentScore += 1;
          if (current.socialMediaName) currentScore += 1;
          if (current.referralSource) currentScore += 1;
          
          return currentScore > bestScore ? current : best;
        });
        
        duplicateGroups.push({
          primary,
          duplicates: allCustomers.filter(c => c.id !== primary.id)
        });
        processed.add(customer.id);
      }
    }
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        totalCustomers: customers.length,
        duplicateGroups: duplicateGroups.length,
        totalDuplicates: duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0),
        groups: duplicateGroups.map(group => ({
          primary: {
            id: group.primary.id,
            name: group.primary.name,
            email: group.primary.email,
            phone: group.primary.phone
          },
          duplicates: group.duplicates.map(d => ({
            id: d.id,
            name: d.name,
            email: d.email,
            phone: d.phone
          }))
        })),
        message: `Found ${duplicateGroups.length} duplicate groups with ${duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0)} duplicate customers`
      });
    }
    
    // Actually merge duplicates
    const bookingsCollection = adminDb.collection('bookings');
    let merged = 0;
    let bookingsUpdated = 0;
    const errors: Array<{ customerId: string; error: string }> = [];
    
    for (const group of duplicateGroups) {
      try {
        // Merge data from all duplicates into primary
        let mergedData: Partial<Customer> = { ...group.primary };
        
        // Accumulate data from all duplicates
        for (const duplicate of group.duplicates) {
          const duplicateMerged = mergeCustomers(group.primary, duplicate);
          // Merge: keep primary value if exists, otherwise use duplicate value
          for (const key in duplicateMerged) {
            const value = duplicateMerged[key as keyof Customer];
            const currentValue = mergedData[key as keyof Customer];
            if ((currentValue === undefined || currentValue === null || currentValue === '') && value) {
              mergedData[key as keyof Customer] = value;
            }
          }
        }
        
        // Update primary customer with merged data
        await updateCustomer(group.primary.id, mergedData);
        
        // Update all bookings that reference duplicates to point to primary
        for (const duplicate of group.duplicates) {
          const duplicateBookings = await bookingsCollection
            .where('customerId', '==', duplicate.id)
            .get();
          
          for (const bookingDoc of duplicateBookings.docs) {
            await bookingDoc.ref.update({
              customerId: group.primary.id,
              updatedAt: new Date().toISOString()
            });
            bookingsUpdated++;
          }
          
          // Delete duplicate customer
          await deleteCustomer(duplicate.id);
          merged++;
        }
      } catch (error: any) {
        errors.push({
          customerId: group.primary.id,
          error: error.message || 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      totalCustomers: customers.length,
      duplicateGroups: duplicateGroups.length,
      merged,
      bookingsUpdated,
      errors: errors.length > 0 ? errors : undefined,
      message: `Merged ${merged} duplicate customers into ${duplicateGroups.length} primary customers. Updated ${bookingsUpdated} bookings.`
    });
  } catch (error: any) {
    console.error('Remove duplicates error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to remove duplicates',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

