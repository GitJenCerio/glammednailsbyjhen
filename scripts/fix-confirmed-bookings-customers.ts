/**
 * Script to find and fix confirmed bookings with only FB name that aren't saved in customers
 * 
 * Usage: npx tsx scripts/fix-confirmed-bookings-customers.ts
 */

import { adminDb } from '../lib/firebaseAdmin';
import { findOrCreateCustomer, getCustomerById } from '../lib/services/customerService';
import { Timestamp } from 'firebase-admin/firestore';

async function fixConfirmedBookingsCustomers() {
  console.log('Starting to check confirmed bookings...\n');
  
  const bookingsCollection = adminDb.collection('bookings');
  const customersCollection = adminDb.collection('customers');
  
  // Get all confirmed and pending_payment bookings
  const [confirmedSnap, pendingSnap] = await Promise.all([
    bookingsCollection.where('status', '==', 'confirmed').limit(1000).get(),
    bookingsCollection.where('status', '==', 'pending_payment').limit(1000).get(),
  ]);
  
  // Combine results
  const allDocs = [...confirmedSnap.docs, ...pendingSnap.docs];
  const confirmedBookingsSnapshot = {
    docs: allDocs,
    size: allDocs.length,
  } as FirebaseFirestore.QuerySnapshot;
  
  console.log(`Found ${confirmedBookingsSnapshot.docs.length} confirmed/pending_payment bookings\n`);
  
  let processed = 0;
  let fixed = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;
  const issues: Array<{ bookingId: string; issue: string; customerId?: string }> = [];
  
  for (const doc of confirmedBookingsSnapshot.docs) {
    try {
      const bookingData = doc.data();
      const bookingId = doc.id;
      const customerId = bookingData.customerId;
      
      // Check if booking has customerData with only FB name
      if (!bookingData.customerData || Object.keys(bookingData.customerData).length === 0) {
        continue; // Skip bookings without customerData
      }
      
      // Check if customerData has only social media name (no email, phone, or real name)
      const customerData = bookingData.customerData;
      const hasEmail = Object.keys(customerData).some(key => 
        key.toLowerCase().includes('email') && customerData[key] && String(customerData[key]).trim()
      );
      const hasPhone = Object.keys(customerData).some(key => 
        (key.toLowerCase().includes('phone') || key.toLowerCase().includes('contact')) && 
        customerData[key] && String(customerData[key]).trim()
      );
      const hasRealName = Object.keys(customerData).some(key => {
        const lowerKey = key.toLowerCase();
        const value = String(customerData[key]).trim();
        return (
          (lowerKey.includes('name') && !lowerKey.includes('facebook') && !lowerKey.includes('instagram') && 
           !lowerKey.includes('social') && !lowerKey.includes('fb') && !lowerKey.includes('ig') && 
           !lowerKey.includes('inquire')) &&
          value && value.length > 0 && value !== 'Unknown Customer'
        );
      });
      
      const hasSocialMediaName = Object.keys(customerData).some(key => {
        const lowerKey = key.toLowerCase();
        return (lowerKey.includes('facebook') || lowerKey.includes('instagram') || 
                lowerKey.includes('fb') || lowerKey.includes('social media')) &&
               customerData[key] && String(customerData[key]).trim();
      });
      
      // Only process bookings with only social media name (no email, phone, or real name)
      if (!hasSocialMediaName || hasEmail || hasPhone || hasRealName) {
        continue;
      }
      
      processed++;
      
      // Check if customer exists and is valid
      let customer = null;
      let needsFix = false;
      let issue = '';
      
      if (!customerId || customerId === 'PENDING_FORM_SUBMISSION') {
        needsFix = true;
        issue = 'No customerId or PENDING_FORM_SUBMISSION';
      } else {
        // Check if customer exists
        const customerDoc = await customersCollection.doc(customerId).get();
        if (!customerDoc.exists) {
          needsFix = true;
          issue = `Customer ${customerId} does not exist`;
        } else {
          customer = customerDoc.data();
          // Check if customer has "Unknown Customer" name
          if (customer?.name === 'Unknown Customer' || !customer?.name) {
            needsFix = true;
            issue = `Customer ${customerId} has "Unknown Customer" name`;
          }
        }
      }
      
      if (needsFix) {
        console.log(`\n[${processed}] Booking ${bookingData.bookingId || bookingId}: ${issue}`);
        console.log(`  CustomerData:`, Object.keys(customerData).map(k => `${k}: ${customerData[k]}`).join(', '));
        
        try {
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
            console.log(`  ⚠️  No social media name found, skipping...`);
            issues.push({ bookingId: bookingData.bookingId || bookingId, issue: 'No social media name in customerData' });
            continue;
          }
          
          // Prepare customer data with social media name as name
          const customerDataForCreation = {
            ...customerData,
            'Name': String(socialMediaName).trim(), // Add as Name so extraction finds it
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
            console.log(`  ✓ Updated customer ${updatedCustomer.id} name to "${socialMediaName}"`);
            updated++;
          }
          
          // Update booking with customerId if needed
          if (!customerId || customerId === 'PENDING_FORM_SUBMISSION' || updatedCustomer.id !== customerId) {
            await doc.ref.set({
              customerId: updatedCustomer.id,
              updatedAt: Timestamp.now().toDate().toISOString(),
            }, { merge: true });
            console.log(`  ✓ Linked booking to customer ${updatedCustomer.id}`);
            created++;
          } else {
            console.log(`  ✓ Customer already exists: ${updatedCustomer.id} (${updatedCustomer.name})`);
            updated++;
          }
          
          fixed++;
        } catch (error: any) {
          console.error(`  ✗ Error fixing booking:`, error.message);
          errors++;
          issues.push({ 
            bookingId: bookingData.bookingId || bookingId, 
            issue: `Error: ${error.message}`,
            customerId 
          });
        }
      }
      
      if (processed % 50 === 0) {
        console.log(`\nProcessed ${processed} bookings... (Fixed: ${fixed})`);
      }
    } catch (error: any) {
      console.error(`Error processing booking ${doc.id}:`, error.message);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`Total bookings checked: ${confirmedBookingsSnapshot.docs.length}`);
  console.log(`Bookings with only FB name: ${processed}`);
  console.log(`Fixed: ${fixed}`);
  console.log(`  - Created/Updated customers: ${created}`);
  console.log(`  - Updated existing customers: ${updated}`);
  console.log(`Errors: ${errors}`);
  
  if (issues.length > 0) {
    console.log(`\nIssues found (${issues.length}):`);
    issues.forEach(({ bookingId, issue, customerId }) => {
      console.log(`  - ${bookingId}: ${issue}${customerId ? ` (customerId: ${customerId})` : ''}`);
    });
  }
  
  console.log('\nDone!');
}

// Run the script
fixConfirmedBookingsCustomers()
  .then(() => {
    console.log('\nScript finished successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });

