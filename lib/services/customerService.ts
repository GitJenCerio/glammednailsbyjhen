import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { Customer, CustomerInput } from '../types';

const customersCollection = adminDb.collection('customers');

// Helper to strip undefined values before writing to Firestore
function omitUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      clean[key] = value;
    }
  });
  return clean as T;
}

/**
 * Extract customer information from booking customerData
 */
export function extractCustomerInfo(customerData?: Record<string, string>): { name: string; email?: string; phone?: string } {
  if (!customerData) {
    throw new Error('Customer data is required');
  }

  // Try various field name variations
  const name = 
    customerData['Name'] || 
    customerData['name'] || 
    customerData['Full Name'] || 
    customerData['fullName'] ||
    customerData['Customer Name'] ||
    customerData['customerName'] ||
    '';

  const surname = 
    customerData['Surname'] || 
    customerData['surname'] || 
    customerData['Last Name'] || 
    customerData['lastName'] ||
    customerData['Customer Surname'] ||
    customerData['customerSurname'] ||
    '';

  const fullName = `${name}${name && surname ? ' ' : ''}${surname}`.trim() || 'Unknown Customer';

  const email = 
    customerData['Email'] || 
    customerData['email'] || 
    customerData['E-mail'] ||
    customerData['Email Address'] ||
    customerData['emailAddress'] ||
    undefined;

  const phone = 
    customerData['Phone'] || 
    customerData['phone'] || 
    customerData['Phone Number'] ||
    customerData['phoneNumber'] ||
    customerData['Contact'] ||
    customerData['contact'] ||
    customerData['Mobile'] ||
    customerData['mobile'] ||
    undefined;

  return { name: fullName, email, phone };
}

/**
 * Find or create a customer based on email or phone
 * If neither exists, creates a new customer
 */
export async function findOrCreateCustomer(customerData?: Record<string, string>): Promise<Customer> {
  if (!customerData) {
    throw new Error('Customer data is required');
  }

  const { name, email, phone } = extractCustomerInfo(customerData);

  // Try to find existing customer by email first
  if (email) {
    const emailSnapshot = await customersCollection.where('email', '==', email).limit(1).get();
    if (!emailSnapshot.empty) {
      const existing = docToCustomer(emailSnapshot.docs[0].id, emailSnapshot.docs[0].data());
      // If the same email is used but the name is clearly different (e.g. booking for a sister),
      // create a NEW customer instead of merging into the existing one.
      if (name && existing.name && name.trim() !== existing.name.trim()) {
        // fall through to \"create new customer\" section below
      } else {
        // Otherwise, update phone if it's changed.
        const updates: any = { updatedAt: Timestamp.now().toDate().toISOString() };
        if (phone && phone !== existing.phone) {
          updates.phone = phone;
        }
        if (Object.keys(updates).length > 1) {
          await emailSnapshot.docs[0].ref.set(updates, { merge: true });
          return { ...existing, ...updates };
        }
        return existing;
      }
    }
  }

  // Try to find by phone if no email match
  if (phone) {
    const phoneSnapshot = await customersCollection.where('phone', '==', phone).limit(1).get();
    if (!phoneSnapshot.empty) {
      const existing = docToCustomer(phoneSnapshot.docs[0].id, phoneSnapshot.docs[0].data());
      // If the same phone is used but the name is different, create a NEW customer.
      if (name && existing.name && name.trim() !== existing.name.trim()) {
        // fall through to \"create new customer\" section below
      } else {
        // Otherwise, update email if it's changed.
        const updates: any = { updatedAt: Timestamp.now().toDate().toISOString() };
        if (email && email !== existing.email) {
          updates.email = email;
        }
        if (Object.keys(updates).length > 1) {
          await phoneSnapshot.docs[0].ref.set(updates, { merge: true });
          return { ...existing, ...updates };
        }
        return existing;
      }
    }
  }

  // Create new customer
  const newCustomer = {
    name,
    email,
    phone,
    createdAt: Timestamp.now().toDate().toISOString(),
    updatedAt: Timestamp.now().toDate().toISOString(),
  };

  const dataToSave = omitUndefined(newCustomer);
  const docRef = await customersCollection.add(dataToSave);
  return docToCustomer(docRef.id, dataToSave);
}

/**
 * Get customer by ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const snapshot = await customersCollection.doc(id).get();
  if (!snapshot.exists) return null;
  return docToCustomer(snapshot.id, snapshot.data()!);
}

/**
 * List all customers
 */
export async function listCustomers(): Promise<Customer[]> {
  const snapshot = await customersCollection.orderBy('name').get();
  return snapshot.docs.map((doc) => docToCustomer(doc.id, doc.data()));
}

/**
 * Get bookings for a specific customer
 */
export async function getBookingsByCustomer(customerId: string) {
  const { listBookings } = await import('./bookingService');
  const allBookings = await listBookings();
  return allBookings.filter((booking) => booking.customerId === customerId);
}

/**
 * Calculate customer lifetime value (total revenue from all bookings)
 */
export async function calculateCustomerLifetimeValue(customerId: string): Promise<number> {
  const bookings = await getBookingsByCustomer(customerId);
  return bookings.reduce((total, booking) => {
    const invoiceTotal = booking.invoice?.total || 0;
    const tipAmount = booking.tipAmount || 0;
    return total + invoiceTotal + tipAmount;
  }, 0);
}

/**
 * Update customer information
 */
export async function updateCustomer(id: string, updates: Partial<CustomerInput>): Promise<Customer> {
  const updateData = omitUndefined({
    ...updates,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
  await customersCollection.doc(id).set(updateData, { merge: true });
  const updated = await getCustomerById(id);
  if (!updated) throw new Error('Customer not found after update');
  return updated;
}

/**
 * Create a customer manually
 */
export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const customerData = omitUndefined({
    ...input,
    createdAt: Timestamp.now().toDate().toISOString(),
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
  const docRef = await customersCollection.add(customerData);
  return docToCustomer(docRef.id, customerData);
}

function docToCustomer(id: string, data: FirebaseFirestore.DocumentData): Customer {
  return {
    id,
    name: data.name,
    email: data.email ?? undefined,
    phone: data.phone ?? undefined,
    notes: data.notes ?? undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

