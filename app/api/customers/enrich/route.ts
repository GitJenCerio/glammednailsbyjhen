import { NextResponse } from 'next/server';
import { listCustomers, updateCustomer, getBookingsByCustomer } from '@/lib/services/customerService';
import { extractCustomerInfo } from '@/lib/services/customerService';
import type { CustomerInput } from '@/lib/types';

/**
 * Enrich existing customers with data from their booking records
 * This extracts additional fields (firstName, lastName, socialMediaName, referralSource)
 * from booking customerData and updates the customer record
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, allCustomers = false } = body ?? {};

    if (allCustomers) {
      // Enrich all customers
      const customers = await listCustomers();
      let enriched = 0;
      let updated = 0;
      const errors: Array<{ customerId: string; error: string }> = [];

      for (const customer of customers) {
        try {
          const bookings = await getBookingsByCustomer(customer.id);
          
          // Get all bookings with customerData
          const bookingsWithData = bookings
            .filter(b => b.customerData && Object.keys(b.customerData).length > 0)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          if (bookingsWithData.length > 0) {
            // Extract data from all bookings and merge (most recent takes priority)
            const allExtracted: Array<ReturnType<typeof extractCustomerInfo>> = [];
            for (const booking of bookingsWithData) {
              try {
                const extracted = extractCustomerInfo(booking.customerData!, booking.customerDataOrder);
                // Debug: log if referralSource was found
                if (extracted.referralSource) {
                  console.log(`Found referral source for customer ${customer.id} from booking ${booking.id}:`, extracted.referralSource);
                }
                allExtracted.push(extracted);
              } catch (err) {
                // Skip bookings with invalid data
                console.warn(`Failed to extract data from booking ${booking.id}:`, err);
              }
            }

            // Merge all extracted data (most recent first, so later entries override earlier ones)
            const merged: ReturnType<typeof extractCustomerInfo> = {
              name: customer.name, // Keep existing name
              firstName: undefined,
              lastName: undefined,
              email: undefined,
              phone: undefined,
              socialMediaName: undefined,
              referralSource: undefined,
            };

            // Go through all extracted data (most recent first) and fill in missing fields
            for (const extracted of allExtracted) {
              if (extracted.firstName && !merged.firstName) merged.firstName = extracted.firstName;
              if (extracted.lastName && !merged.lastName) merged.lastName = extracted.lastName;
              if (extracted.email && !merged.email) merged.email = extracted.email;
              if (extracted.phone && !merged.phone) merged.phone = extracted.phone;
              if (extracted.socialMediaName && !merged.socialMediaName) merged.socialMediaName = extracted.socialMediaName;
              if (extracted.referralSource && !merged.referralSource) merged.referralSource = extracted.referralSource;
            }
            
            // Only update if we have new information that's missing
            const updates: Partial<CustomerInput> = {};
            let hasUpdates = false;

            if (merged.firstName && !customer.firstName) {
              updates.firstName = merged.firstName;
              hasUpdates = true;
            }
            if (merged.lastName && !customer.lastName) {
              updates.lastName = merged.lastName;
              hasUpdates = true;
            }
            if (merged.socialMediaName && !customer.socialMediaName) {
              updates.socialMediaName = merged.socialMediaName;
              hasUpdates = true;
            }
            if (merged.referralSource && !customer.referralSource) {
              updates.referralSource = merged.referralSource;
              hasUpdates = true;
            }
            // Update email/phone if missing
            if (merged.email && !customer.email) {
              updates.email = merged.email;
              hasUpdates = true;
            }
            if (merged.phone && !customer.phone) {
              updates.phone = merged.phone;
              hasUpdates = true;
            }

            if (hasUpdates) {
              await updateCustomer(customer.id, updates);
              updated++;
            }
            enriched++;
          }
        } catch (error: any) {
          errors.push({
            customerId: customer.id,
            error: error.message || 'Unknown error'
          });
        }
      }

      return NextResponse.json({
        success: true,
        total: customers.length,
        enriched,
        updated,
        errors: errors.length > 0 ? errors : undefined,
        message: `Enriched ${enriched} customers, updated ${updated} with new information`
      });
    } else if (customerId) {
      // Enrich a specific customer
      const customer = await (await import('@/lib/services/customerService')).getCustomerById(customerId);
      if (!customer) {
        return NextResponse.json({
          success: false,
          message: 'Customer not found'
        }, { status: 404 });
      }

      const bookings = await getBookingsByCustomer(customerId);
      
      // Get all bookings with customerData
      const bookingsWithData = bookings
        .filter(b => b.customerData && Object.keys(b.customerData).length > 0)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (bookingsWithData.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'No booking data found for this customer'
        }, { status: 404 });
      }

      // Extract data from all bookings and merge (most recent takes priority)
      const allExtracted: Array<ReturnType<typeof extractCustomerInfo>> = [];
      for (const booking of bookingsWithData) {
        try {
          const extracted = extractCustomerInfo(booking.customerData!, booking.customerDataOrder);
          allExtracted.push(extracted);
        } catch (err) {
          // Skip bookings with invalid data
          console.warn(`Failed to extract data from booking ${booking.id}:`, err);
        }
      }

      // Merge all extracted data (most recent first)
      const merged: ReturnType<typeof extractCustomerInfo> = {
        name: customer.name,
        firstName: undefined,
        lastName: undefined,
        email: undefined,
        phone: undefined,
        socialMediaName: undefined,
        referralSource: undefined,
      };

      for (const extracted of allExtracted) {
        if (extracted.firstName && !merged.firstName) merged.firstName = extracted.firstName;
        if (extracted.lastName && !merged.lastName) merged.lastName = extracted.lastName;
        if (extracted.email && !merged.email) merged.email = extracted.email;
        if (extracted.phone && !merged.phone) merged.phone = extracted.phone;
        if (extracted.socialMediaName && !merged.socialMediaName) merged.socialMediaName = extracted.socialMediaName;
        if (extracted.referralSource && !merged.referralSource) merged.referralSource = extracted.referralSource;
      }

      const updates: Partial<CustomerInput> = {};
      // Only update fields that are missing or if we have better data
      if (merged.firstName && !customer.firstName) updates.firstName = merged.firstName;
      if (merged.lastName && !customer.lastName) updates.lastName = merged.lastName;
      if (merged.socialMediaName && !customer.socialMediaName) updates.socialMediaName = merged.socialMediaName;
      if (merged.referralSource && !customer.referralSource) updates.referralSource = merged.referralSource;
      if (merged.email && !customer.email) updates.email = merged.email;
      if (merged.phone && !customer.phone) updates.phone = merged.phone;

      const updatedCustomer = await updateCustomer(customerId, updates);

      return NextResponse.json({
        success: true,
        customer: updatedCustomer,
        bookingsChecked: bookingsWithData.length,
        message: `Customer enriched with data from ${bookingsWithData.length} booking record(s)`
      });
    } else {
      return NextResponse.json({
        error: 'Please provide customerId or set allCustomers to true'
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Customer enrich error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to enrich customers',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

