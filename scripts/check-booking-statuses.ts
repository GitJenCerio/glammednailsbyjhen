/**
 * Quick script to check booking statuses
 */

import { adminDb } from '../lib/firebaseAdmin';

async function checkBookingStatuses() {
  const bookingsCollection = adminDb.collection('bookings');
  const snapshot = await bookingsCollection.limit(100).get();
  
  console.log(`Found ${snapshot.docs.length} bookings\n`);
  
  const statusCounts: Record<string, number> = {};
  const issues: Array<{ bookingId: string; status: string; customerId: string; hasCustomerData: boolean; customerDataKeys?: string[] }> = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const status = data.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    
    // Check for potential issues
    const customerId = data.customerId;
    const hasCustomerData = !!data.customerData && Object.keys(data.customerData).length > 0;
    
    if (status === 'confirmed' && (!customerId || customerId === 'PENDING_FORM_SUBMISSION' || hasCustomerData)) {
      const customerDataKeys = hasCustomerData ? Object.keys(data.customerData) : [];
      issues.push({
        bookingId: data.bookingId || doc.id,
        status,
        customerId: customerId || 'none',
        hasCustomerData,
        customerDataKeys,
      });
    }
  }
  
  console.log('Status counts:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  if (issues.length > 0) {
    console.log(`\nFound ${issues.length} confirmed bookings with potential issues:`);
    issues.slice(0, 10).forEach(issue => {
      console.log(`  - ${issue.bookingId}: customerId=${issue.customerId}, hasCustomerData=${issue.hasCustomerData}`);
      if (issue.customerDataKeys && issue.customerDataKeys.length > 0) {
        console.log(`    Keys: ${issue.customerDataKeys.join(', ')}`);
      }
    });
    if (issues.length > 10) {
      console.log(`  ... and ${issues.length - 10} more`);
    }
  }
}

checkBookingStatuses()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });



