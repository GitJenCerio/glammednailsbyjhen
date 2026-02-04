import { NextResponse } from 'next/server';
import { listCustomers, getBookingsByCustomer, deleteCustomer, getCustomerById } from '@/lib/services/customerService';
import type { Customer } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Normalize phone number for comparison (remove spaces, dashes, parentheses)
 */
function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-\(\)]/g, '').trim() || null;
}

/**
 * Normalize email for comparison (lowercase, trim)
 */
function normalizeEmail(email?: string): string | null {
  if (!email) return null;
  return email.toLowerCase().trim() || null;
}

/**
 * Find duplicate customers by email or phone
 * Uses union-find approach to merge customers that match by email OR phone
 */
function findDuplicates(customers: Customer[]): Map<string, Customer[]> {
  // Build index maps for quick lookup
  const emailMap = new Map<string, Customer[]>();
  const phoneMap = new Map<string, Customer[]>();

  // Index customers by email and phone
  for (const customer of customers) {
    const normalizedEmail = normalizeEmail(customer.email);
    const normalizedPhone = normalizePhone(customer.phone);

    if (normalizedEmail) {
      if (!emailMap.has(normalizedEmail)) {
        emailMap.set(normalizedEmail, []);
      }
      emailMap.get(normalizedEmail)!.push(customer);
    }

    if (normalizedPhone) {
      if (!phoneMap.has(normalizedPhone)) {
        phoneMap.set(normalizedPhone, []);
      }
      phoneMap.get(normalizedPhone)!.push(customer);
    }
  }

  // Use union-find to merge customers that are connected by email or phone
  const customerToGroup = new Map<string, Set<Customer>>();
  const processedCustomers = new Set<string>();

  // Process each customer and merge with duplicates
  for (const customer of customers) {
    if (processedCustomers.has(customer.id)) continue;

    const normalizedEmail = normalizeEmail(customer.email);
    const normalizedPhone = normalizePhone(customer.phone);

    // Find all customers connected to this one (by email or phone)
    const connectedCustomers = new Set<Customer>([customer]);
    const toProcess = [customer];

    while (toProcess.length > 0) {
      const current = toProcess.pop()!;
      if (processedCustomers.has(current.id)) continue;
      processedCustomers.add(current.id);

      const currentEmail = normalizeEmail(current.email);
      const currentPhone = normalizePhone(current.phone);

      // Add customers with same email
      if (currentEmail && emailMap.has(currentEmail)) {
        for (const match of emailMap.get(currentEmail)!) {
          if (!connectedCustomers.has(match)) {
            connectedCustomers.add(match);
            toProcess.push(match);
          }
        }
      }

      // Add customers with same phone
      if (currentPhone && phoneMap.has(currentPhone)) {
        for (const match of phoneMap.get(currentPhone)!) {
          if (!connectedCustomers.has(match)) {
            connectedCustomers.add(match);
            toProcess.push(match);
          }
        }
      }
    }

    // Only add as duplicate group if there are 2+ customers
    if (connectedCustomers.size > 1) {
      const groupKey = `group:${customer.id}`;
      customerToGroup.set(groupKey, connectedCustomers);
    }
  }

  // Convert to Map<string, Customer[]>
  const allDuplicates = new Map<string, Customer[]>();
  for (const [groupKey, customerSet] of customerToGroup.entries()) {
    allDuplicates.set(groupKey, Array.from(customerSet));
  }

  return allDuplicates;
}

/**
 * Check if customer has confirmed bookings
 */
async function hasConfirmedBookings(customerId: string): Promise<boolean> {
  const bookings = await getBookingsByCustomer(customerId);
  return bookings.some(booking => booking.status === 'confirmed');
}

/**
 * POST /api/customers/cleanup-duplicates
 * Finds and deletes duplicate customers, keeping the one with confirmed bookings
 */
export async function POST(request: Request) {
  try {
    const { dryRun = false } = await request.json().catch(() => ({ dryRun: false }));

    // Get all customers
    const customers = await listCustomers(10000); // Get a large number to find all duplicates
    console.log(`Found ${customers.length} total customers`);

    // Find duplicates
    const duplicates = findDuplicates(customers);
    console.log(`Found ${duplicates.size} duplicate groups`);

    const results = {
      totalCustomers: customers.length,
      duplicateGroups: duplicates.size,
      processed: 0,
      deleted: 0,
      kept: 0,
      errors: [] as string[],
      details: [] as Array<{
        groupKey: string;
        customers: Array<{ id: string; name: string; email?: string; phone?: string; hasConfirmed: boolean }>;
        action: string;
      }>,
    };

    // Process each duplicate group
    for (const [groupKey, group] of duplicates.entries()) {
      if (group.length < 2) continue; // Skip if not actually duplicates

      // Check which customers have confirmed bookings
      const customerStatuses = await Promise.all(
        group.map(async (customer) => {
          const hasConfirmed = await hasConfirmedBookings(customer.id);
          return {
            customer,
            hasConfirmed,
          };
        })
      );

      // Separate customers with and without confirmed bookings
      const withConfirmed = customerStatuses.filter(s => s.hasConfirmed);
      const withoutConfirmed = customerStatuses.filter(s => !s.hasConfirmed);

      // Determine action
      let action: string;
      let customersToDelete: Customer[] = [];

      if (withConfirmed.length === 0) {
        // No one has confirmed bookings - keep the one with most bookings or first one
        // For now, keep the first one and delete the rest
        action = `No confirmed bookings in group - keeping first customer, deleting ${withoutConfirmed.length - 1} others`;
        customersToDelete = withoutConfirmed.slice(1).map(s => s.customer);
      } else if (withoutConfirmed.length === 0) {
        // All have confirmed bookings - keep all (shouldn't happen, but be safe)
        action = 'All customers have confirmed bookings - keeping all';
        customersToDelete = [];
      } else {
        // Some have confirmed, some don't - delete the ones without confirmed bookings
        action = `Keeping ${withConfirmed.length} customer(s) with confirmed bookings, deleting ${withoutConfirmed.length} without confirmed bookings`;
        customersToDelete = withoutConfirmed.map(s => s.customer);
      }

      // Store details
      results.details.push({
        groupKey,
        customers: customerStatuses.map(s => ({
          id: s.customer.id,
          name: s.customer.name,
          email: s.customer.email,
          phone: s.customer.phone,
          hasConfirmed: s.hasConfirmed,
        })),
        action,
      });

      // Delete customers (if not dry run)
      if (!dryRun && customersToDelete.length > 0) {
        for (const customerToDelete of customersToDelete) {
          try {
            // Double-check: don't delete if they have confirmed bookings
            const hasConfirmed = await hasConfirmedBookings(customerToDelete.id);
            if (hasConfirmed) {
              results.errors.push(`Skipped deleting ${customerToDelete.id} (${customerToDelete.name}) - has confirmed bookings`);
              continue;
            }

            // Check if customer has any bookings at all
            const bookings = await getBookingsByCustomer(customerToDelete.id);
            if (bookings.length > 0) {
              // Has bookings but none confirmed - check if we should still delete
              // For safety, only delete if all bookings are cancelled
              const allCancelled = bookings.every(b => b.status === 'cancelled');
              if (!allCancelled) {
                results.errors.push(`Skipped deleting ${customerToDelete.id} (${customerToDelete.name}) - has non-cancelled bookings`);
                continue;
              }
            }

            await deleteCustomer(customerToDelete.id);
            results.deleted++;
            console.log(`Deleted duplicate customer: ${customerToDelete.id} (${customerToDelete.name})`);
          } catch (error: any) {
            results.errors.push(`Failed to delete ${customerToDelete.id} (${customerToDelete.name}): ${error.message}`);
          }
        }
      } else if (dryRun) {
        results.deleted += customersToDelete.length;
      }

      results.kept += group.length - customersToDelete.length;
      results.processed++;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalCustomers: results.totalCustomers,
        duplicateGroups: results.duplicateGroups,
        processed: results.processed,
        deleted: results.deleted,
        kept: results.kept,
        errors: results.errors.length,
      },
      details: results.details,
      errors: results.errors,
    });
  } catch (error: any) {
    console.error('Error cleaning up duplicate customers:', error);
    return NextResponse.json(
      { error: error.message ?? 'Failed to cleanup duplicate customers.' },
      { status: 500 }
    );
  }
}

