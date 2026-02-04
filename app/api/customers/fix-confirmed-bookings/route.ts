import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { findOrCreateCustomer, getCustomerById } from '@/lib/services/customerService';
import { Timestamp } from 'firebase-admin/firestore';
import type firestore from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('Starting to check confirmed bookings for missing customers...');
    const bookingsCollection = adminDb.collection('bookings');
    const customersCollection = adminDb.collection('customers');
    
    // Get all confirmed and pending_payment bookings
    const [confirmedSnap, pendingSnap] = await Promise.all([
      bookingsCollection.where('status', '==', 'confirmed').limit(1000).get(),
      bookingsCollection.where('status', '==', 'pending_payment').limit(1000).get(),
    ]);
    
    console.log(`Found ${confirmedSnap.docs.length} confirmed and ${pendingSnap.docs.length} pending_payment bookings`);
    
    // Combine results
    const allDocs = [...confirmedSnap.docs, ...pendingSnap.docs];
    const confirmedBookingsSnapshot = {
      docs: allDocs,
      size: allDocs.length,
    } as firestore.QuerySnapshot;
    
    const results: Array<{
      bookingId: string;
      issue: string;
      fixed: boolean;
      customerId?: string;
      customerName?: string;
    }> = [];
    
    let fixed = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const doc of confirmedBookingsSnapshot.docs) {
      try {
        const bookingData = doc.data();
        const bookingId = doc.id;
        const customerId = bookingData.customerId;
        
        // Check if booking has customerData
        if (!bookingData.customerData || Object.keys(bookingData.customerData).length === 0) {
          skipped++;
          continue;
        }
        
        const customerData = bookingData.customerData;
        
        // Check if customer exists and is valid
        let customer = null;
        let needsFix = false;
        let issue = '';
        
        if (!customerId || customerId === 'PENDING_FORM_SUBMISSION') {
          needsFix = true;
          issue = 'No customerId or PENDING_FORM_SUBMISSION';
        } else {
          const customerDoc = await customersCollection.doc(customerId).get();
          if (!customerDoc.exists) {
            needsFix = true;
            issue = `Customer ${customerId} does not exist`;
          } else {
            customer = customerDoc.data();
            if (customer?.name === 'Unknown Customer' || !customer?.name) {
              needsFix = true;
              issue = `Customer has "Unknown Customer" name`;
            }
          }
        }
        
        // Only process if customer needs fixing
        if (!needsFix) {
          skipped++;
          continue;
        }
        
        // Check if customerData has social media name
        const hasSocialMediaName = Object.keys(customerData).some(key => {
          const lowerKey = key.toLowerCase();
          const value = customerData[key];
          return (lowerKey.includes('facebook') || lowerKey.includes('instagram') || 
                  lowerKey.includes('fb') || lowerKey.includes('social media')) &&
                 value && String(value).trim();
        });
        
        // If no social media name, skip (can't create customer without at least a name)
        if (!hasSocialMediaName) {
          skipped++;
          continue;
        }
        
        // Extract social media name
        const socialMediaName = 
          customerData['Facebook or Instagram Name'] ||
          customerData['FB Name'] ||
          customerData['Social Media Name'] ||
          customerData['Facebook or Instagram Name. (The one you used to inquire with me.)'] ||
          customerData['Facebook or Instagram Name. (The one you used to inquire with me)'] ||
          Object.entries(customerData).find(([k]) => {
            const lower = k.toLowerCase();
            return (lower.includes('facebook') || lower.includes('instagram') || 
                    lower.includes('fb') || lower.includes('social media'));
          })?.[1];
        
        if (!socialMediaName || !String(socialMediaName).trim()) {
          results.push({
            bookingId: bookingData.bookingId || bookingId,
            issue: 'No social media name found',
            fixed: false,
            customerId,
          });
          continue;
        }
        
        try {
          // Prepare customer data with social media name as name
          const customerDataForCreation = {
            ...customerData,
            'Name': String(socialMediaName).trim(),
          };
          const customerDataOrder = bookingData.customerDataOrder || Object.keys(customerDataForCreation);
          
          // Find or create customer
          const updatedCustomer = await findOrCreateCustomer(customerDataForCreation, customerDataOrder, false);
          
          // If customer name is still "Unknown Customer", explicitly update it
          if (updatedCustomer.name === 'Unknown Customer') {
            await customersCollection.doc(updatedCustomer.id).set({
              name: String(socialMediaName).trim(),
              socialMediaName: String(socialMediaName).trim(),
              updatedAt: Timestamp.now().toDate().toISOString(),
            }, { merge: true });
            updated++;
          }
          
          // Update booking with customerId if needed
          if (!customerId || customerId === 'PENDING_FORM_SUBMISSION' || updatedCustomer.id !== customerId) {
            await doc.ref.set({
              customerId: updatedCustomer.id,
              updatedAt: Timestamp.now().toDate().toISOString(),
            }, { merge: true });
            created++;
          } else {
            updated++;
          }
          
          fixed++;
          console.log(`Fixed booking ${bookingData.bookingId || bookingId}: ${issue} -> Customer ${updatedCustomer.id} (${updatedCustomer.name})`);
          results.push({
            bookingId: bookingData.bookingId || bookingId,
            issue,
            fixed: true,
            customerId: updatedCustomer.id,
            customerName: updatedCustomer.name,
          });
        } catch (error: any) {
          console.error(`Error fixing booking ${bookingData.bookingId || bookingId}:`, error);
          results.push({
            bookingId: bookingData.bookingId || bookingId,
            issue: `Error: ${error.message}`,
            fixed: false,
            customerId,
          });
        }
      } catch (error: any) {
        results.push({
          bookingId: doc.id,
          issue: `Error processing: ${error.message}`,
          fixed: false,
        });
      }
    }
    
    console.log(`Summary: ${fixed} fixed (${created} created, ${updated} updated), ${skipped} skipped`);
    
    return NextResponse.json({
      totalBookings: confirmedBookingsSnapshot.docs.length,
      checked: results.length + skipped,
      fixed,
      created,
      updated,
      skipped,
      results: results.slice(0, 100), // Limit results to prevent large response
    });
  } catch (error: any) {
    console.error('Error checking confirmed bookings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check confirmed bookings', stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    );
  }
}

