import { NextResponse } from 'next/server';
import { listCustomers, updateCustomer, getBookingsByCustomer } from '@/lib/services/customerService';
import { extractCustomerInfo } from '@/lib/services/customerService';
import type { CustomerInput } from '@/lib/types';

/**
 * Fix imported customers:
 * 1. Mark customers with NO bookings as repeat clients (they're from old imported data)
 * 2. Extract missing referral source from their booking records
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { markAsRepeat = true, markOnlyNoBookings = true } = body; 
    // markOnlyNoBookings: if true, only mark customers with no bookings as repeat (they're imported)
    // if false, mark all customers as repeat
    
    const customers = await listCustomers();
    let fixedReferralSource = 0;
    let markedAsRepeat = 0;
    const errors: Array<{ customerId: string; error: string }> = [];

    for (const customer of customers) {
      try {
        const updates: any = {};
        
        // Check if customer has bookings
        const bookings = await getBookingsByCustomer(customer.id);
        const hasBookings = bookings.length > 0;
        
        // Debug logging
        if (process.env.NODE_ENV === 'development') {
          console.log(`Customer ${customer.id} (${customer.name}): hasBookings=${hasBookings}, isRepeatClient=${customer.isRepeatClient}`);
        }
        
        // Mark as repeat client based on strategy
        if (markAsRepeat) {
          let shouldMarkAsRepeat = false;
          
          if (markOnlyNoBookings) {
            // Only mark customers with NO bookings as repeat (they're from old imported data)
            // Mark them even if they're already marked, to ensure consistency
            shouldMarkAsRepeat = !hasBookings;
            if (process.env.NODE_ENV === 'development' && shouldMarkAsRepeat) {
              console.log(`  -> Will mark as repeat (no bookings)`);
            }
          } else {
            // Mark all customers as repeat
            shouldMarkAsRepeat = !customer.isRepeatClient;
          }
          
          if (shouldMarkAsRepeat) {
            // Always set to true, even if already true (ensures it's set)
            updates.isRepeatClient = true;
            markedAsRepeat++;
            console.log(`Marking customer ${customer.id} (${customer.name}) as repeat client - hasBookings: ${hasBookings}, current isRepeatClient: ${customer.isRepeatClient}`);
          }
        }
        
        // Try to extract referral source if missing (only if customer has bookings)
        if (!customer.referralSource && hasBookings) {
          // Find bookings with customerData
          const bookingsWithData = bookings
            .filter(b => b.customerData && Object.keys(b.customerData).length > 0)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          // Try to extract referral source from booking data
          for (const booking of bookingsWithData) {
            if (!booking.customerData) continue;

            // Search for referral source field in customerData
            const keys = Object.keys(booking.customerData);
            let foundReferralSource: string | undefined = undefined;

            for (const key of keys) {
              const lowerKey = key.toLowerCase().trim();
              // Check for exact match
              if (lowerKey === 'how did you find out about glammednailsbyjhen?' || 
                  lowerKey === 'how did you find out about glammednailsbyjhen') {
                const value = booking.customerData[key];
                if (value && value.trim()) {
                  foundReferralSource = value.trim();
                  break;
                }
              }
              // Check for partial matches
              if ((lowerKey.includes('find out') && lowerKey.includes('glammednails')) ||
                  (lowerKey.includes('referral') || lowerKey.includes('source'))) {
                const value = booking.customerData[key];
                if (value && value.trim()) {
                  foundReferralSource = value.trim();
                  break;
                }
              }
            }

            // Also try using extractCustomerInfo
            if (!foundReferralSource) {
              try {
                const extracted = extractCustomerInfo(booking.customerData, booking.customerDataOrder);
                if (extracted.referralSource) {
                  foundReferralSource = extracted.referralSource;
                }
              } catch (err) {
                // Continue to next booking
              }
            }

            if (foundReferralSource) {
              updates.referralSource = foundReferralSource;
              fixedReferralSource++;
              break; // Found it, move to next customer
            }
          }
        }
        
        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          console.log(`Updating customer ${customer.id} (${customer.name}) with:`, updates);
          await updateCustomer(customer.id, updates);
          console.log(`Successfully updated customer ${customer.id}`);
        } else {
          console.log(`No updates needed for customer ${customer.id} (${customer.name})`);
        }
      } catch (error: any) {
        errors.push({
          customerId: customer.id,
          error: error.message || 'Unknown error'
        });
      }
    }

    console.log(`Fix imported customers complete: ${customers.length} total, ${markedAsRepeat} marked as repeat, ${fixedReferralSource} fixed referral source`);
    
    return NextResponse.json({
      success: true,
      total: customers.length,
      markedAsRepeat,
      fixedReferralSource,
      errors: errors.length > 0 ? errors : undefined,
      message: markedAsRepeat > 0 
        ? `Marked ${markedAsRepeat} customers (with no bookings) as repeat clients${fixedReferralSource > 0 ? ` and fixed ${fixedReferralSource} customers with missing referral source` : ''}`
        : `No customers were marked. All customers may already be marked as repeat clients, or all customers have bookings.`
    });
  } catch (error: any) {
    console.error('Fix imported customers error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to fix imported customers',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

