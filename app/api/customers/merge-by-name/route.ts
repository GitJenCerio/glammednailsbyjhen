import { NextResponse } from 'next/server';
import { listCustomers, getBookingsByCustomer, deleteCustomer, updateCustomer, getCustomerById } from '@/lib/services/customerService';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Customer } from '@/lib/types';

export const dynamic = 'force-dynamic';

const getBookingsCollection = () => adminDb.collection('bookings');

/**
 * Normalize name for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Find customers with the same name
 */
function findCustomersByName(customers: Customer[]): Map<string, Customer[]> {
  const nameMap = new Map<string, Customer[]>();

  for (const customer of customers) {
    const normalizedName = normalizeName(customer.name);
    if (!nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, []);
    }
    nameMap.get(normalizedName)!.push(customer);
  }

  // Filter to only groups with 2+ customers
  const duplicates = new Map<string, Customer[]>();
  for (const [name, group] of nameMap.entries()) {
    if (group.length > 1) {
      duplicates.set(name, group);
    }
  }

  return duplicates;
}

/**
 * Determine which customer to keep (the one with most bookings or most complete data)
 */
async function chooseCustomerToKeep(customers: Customer[]): Promise<{ keep: Customer; merge: Customer[] }> {
  // Get booking counts for each customer
  const customerStats = await Promise.all(
    customers.map(async (customer) => {
      const bookings = await getBookingsByCustomer(customer.id);
      const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
      const totalBookings = bookings.length;
      
      // Calculate completeness score
      let completeness = 0;
      if (customer.email) completeness += 2;
      if (customer.phone) completeness += 2;
      if (customer.firstName) completeness += 1;
      if (customer.lastName) completeness += 1;
      if (customer.socialMediaName) completeness += 1;
      if (customer.referralSource) completeness += 1;
      if (customer.name !== 'Unknown Customer') completeness += 3;

      return {
        customer,
        totalBookings,
        confirmedBookings: confirmedBookings.length,
        completeness,
      };
    })
  );

  // Sort by: confirmed bookings > total bookings > completeness > created date
  customerStats.sort((a, b) => {
    if (b.confirmedBookings !== a.confirmedBookings) {
      return b.confirmedBookings - a.confirmedBookings;
    }
    if (b.totalBookings !== a.totalBookings) {
      return b.totalBookings - a.totalBookings;
    }
    if (b.completeness !== a.completeness) {
      return b.completeness - a.completeness;
    }
    // If all else equal, keep the oldest (first created)
    return new Date(a.customer.createdAt).getTime() - new Date(b.customer.createdAt).getTime();
  });

  const keep = customerStats[0].customer;
  const merge = customerStats.slice(1).map(s => s.customer);

  return { keep, merge };
}

/**
 * Merge customer data (combine all fields, preferring non-empty values)
 */
function mergeCustomerData(keep: Customer, merge: Customer[]): Partial<Customer> {
  const updates: Partial<Customer> = {};

  for (const customer of merge) {
    // Merge email if keep doesn't have one
    if (!keep.email && customer.email) {
      updates.email = customer.email;
    }
    // Merge phone if keep doesn't have one
    if (!keep.phone && customer.phone) {
      updates.phone = customer.phone;
    }
    // Merge firstName if keep doesn't have one
    if (!keep.firstName && customer.firstName) {
      updates.firstName = customer.firstName;
    }
    // Merge lastName if keep doesn't have one
    if (!keep.lastName && customer.lastName) {
      updates.lastName = customer.lastName;
    }
    // Merge socialMediaName if keep doesn't have one
    if (!keep.socialMediaName && customer.socialMediaName) {
      updates.socialMediaName = customer.socialMediaName;
    }
    // Merge referralSource if keep doesn't have one
    if (!keep.referralSource && customer.referralSource) {
      updates.referralSource = customer.referralSource;
    }
    // Merge notes (combine)
    if (customer.notes && customer.notes.trim()) {
      const existingNotes = keep.notes ? `${keep.notes}\n` : '';
      updates.notes = `${existingNotes}Merged from customer ${customer.id}: ${customer.notes}`.trim();
    }
  }

  return updates;
}

/**
 * Update all bookings to point to the merged customer
 */
async function updateBookingsCustomerId(oldCustomerId: string, newCustomerId: string): Promise<number> {
  const bookingsCollection = getBookingsCollection();
  const bookingsSnapshot = await bookingsCollection
    .where('customerId', '==', oldCustomerId)
    .get();

  if (bookingsSnapshot.empty) {
    return 0;
  }

  const batch = adminDb.batch();
  let count = 0;

  for (const doc of bookingsSnapshot.docs) {
    batch.update(doc.ref, {
      customerId: newCustomerId,
      updatedAt: Timestamp.now().toDate().toISOString(),
    });
    count++;
  }

  // Firestore batch limit is 500, but we'll process in batches if needed
  if (count > 0) {
    await batch.commit();
  }

  return count;
}

/**
 * POST /api/customers/merge-by-name
 * Merges customers with the same name and updates their bookings
 */
export async function POST(request: Request) {
  try {
    const { dryRun = false, minSimilarity = 1.0 } = await request.json().catch(() => ({ 
      dryRun: false, 
      minSimilarity: 1.0 
    }));

    // Get all customers
    const customers = await listCustomers(10000);
    console.log(`Found ${customers.length} total customers`);

    // Find customers with the same name
    const nameGroups = findCustomersByName(customers);
    console.log(`Found ${nameGroups.size} groups of customers with the same name`);

    const results = {
      totalCustomers: customers.length,
      duplicateGroups: nameGroups.size,
      processed: 0,
      merged: 0,
      bookingsUpdated: 0,
      customersDeleted: 0,
      errors: [] as string[],
      details: [] as Array<{
        groupName: string;
        customers: Array<{ id: string; name: string; bookings: number; kept: boolean }>;
        action: string;
      }>,
    };

    // Process each duplicate group
    for (const [normalizedName, group] of nameGroups.entries()) {
      if (group.length < 2) continue;

      try {
        // Choose which customer to keep
        const { keep, merge } = await chooseCustomerToKeep(group);

        // Get booking counts for reporting
        const customerStats = await Promise.all(
          group.map(async (customer) => {
            const bookings = await getBookingsByCustomer(customer.id);
            return {
              id: customer.id,
              name: customer.name,
              bookings: bookings.length,
              kept: customer.id === keep.id,
            };
          })
        );

        // Merge customer data
        const customerUpdates = mergeCustomerData(keep, merge);

        // Store details
        results.details.push({
          groupName: keep.name,
          customers: customerStats,
          action: `Keeping customer ${keep.id}, merging ${merge.length} customer(s)`,
        });

        if (!dryRun) {
          // Update the kept customer with merged data
          if (Object.keys(customerUpdates).length > 0) {
            await updateCustomer(keep.id, customerUpdates);
          }

          // Update all bookings to point to the kept customer
          let totalBookingsUpdated = 0;
          for (const customerToMerge of merge) {
            const bookingsUpdated = await updateBookingsCustomerId(customerToMerge.id, keep.id);
            totalBookingsUpdated += bookingsUpdated;
          }
          results.bookingsUpdated += totalBookingsUpdated;

          // Delete merged customers
          for (const customerToMerge of merge) {
            try {
              await deleteCustomer(customerToMerge.id);
              results.customersDeleted++;
              console.log(`Merged and deleted customer: ${customerToMerge.id} (${customerToMerge.name}) -> ${keep.id}`);
            } catch (error: any) {
              results.errors.push(`Failed to delete customer ${customerToMerge.id} (${customerToMerge.name}): ${error.message}`);
            }
          }
        } else {
          // Dry run: just count what would be merged
          let totalBookings = 0;
          for (const customerToMerge of merge) {
            const bookings = await getBookingsByCustomer(customerToMerge.id);
            totalBookings += bookings.length;
          }
          results.bookingsUpdated += totalBookings;
          results.customersDeleted += merge.length;
        }

        results.merged += merge.length;
        results.processed++;
      } catch (error: any) {
        results.errors.push(`Error processing group "${normalizedName}": ${error.message}`);
        console.error(`Error processing group "${normalizedName}":`, error);
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalCustomers: results.totalCustomers,
        duplicateGroups: results.duplicateGroups,
        processed: results.processed,
        merged: results.merged,
        bookingsUpdated: results.bookingsUpdated,
        customersDeleted: results.customersDeleted,
        errors: results.errors.length,
      },
      details: results.details,
      errors: results.errors,
    });
  } catch (error: any) {
    console.error('Error merging customers by name:', error);
    return NextResponse.json(
      { error: error.message ?? 'Failed to merge customers by name.' },
      { status: 500 }
    );
  }
}


