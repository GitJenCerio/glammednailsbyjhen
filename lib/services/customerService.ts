import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { Customer, CustomerInput } from '../types';

// Use a getter to avoid touching Firebase at module load time in some places
const getCustomersCollection = () => adminDb.collection('customers');
// Keep direct reference for existing logic that expects a const collection
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
 * Also accepts customerDataOrder to get fields by index position
 */
export function extractCustomerInfo(
  customerData?: Record<string, string>,
  customerDataOrder?: string[]
): { 
  name: string; 
  firstName?: string;
  lastName?: string;
  email?: string; 
  phone?: string;
  socialMediaName?: string;
  referralSource?: string;
} {
  if (!customerData) {
    throw new Error('Customer data is required');
  }

  // Helper function to get value by index in customerDataOrder first, then by field name
  const getValue = (fieldName: string, index?: number): string | undefined => {
    // First try by index in customerDataOrder if provided (most reliable)
    if (index !== undefined && customerDataOrder && customerDataOrder.length > index) {
      const fieldNameFromOrder = customerDataOrder[index];
      if (fieldNameFromOrder && customerData[fieldNameFromOrder]) {
        const value = customerData[fieldNameFromOrder];
        if (value && value.trim()) {
          return value.trim();
        }
      }
    }
    // Then try by exact field name
    if (customerData[fieldName]) {
      const value = customerData[fieldName];
      if (value && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  };

  // Try various field name variations for first name
  const firstName = 
    customerData['Name'] || 
    customerData['name'] || 
    customerData['First Name'] ||
    customerData['firstName'] ||
    customerData['Customer Name'] ||
    customerData['customerName'] ||
    '';

  // Try various field name variations for last name
  const lastName = 
    customerData['Surname'] || 
    customerData['surname'] || 
    customerData['Last Name'] || 
    customerData['lastName'] ||
    customerData['Customer Surname'] ||
    customerData['customerSurname'] ||
    '';

  // Build full name
  const fullName = `${firstName}${firstName && lastName ? ' ' : ''}${lastName}`.trim() || 'Unknown Customer';

  // Extract email
  const email = 
    customerData['Email'] || 
    customerData['email'] || 
    customerData['E-mail'] ||
    customerData['Email Address'] ||
    customerData['emailAddress'] ||
    undefined;

  // Extract phone - try multiple variations including "Contact Number"
  const phone = 
    customerData['Phone'] || 
    customerData['phone'] || 
    customerData['Phone Number'] ||
    customerData['phoneNumber'] ||
    customerData['Contact'] ||
    customerData['contact'] ||
    customerData['Contact Number'] ||
    customerData['contactNumber'] ||
    customerData['Mobile'] ||
    customerData['mobile'] ||
    undefined;

  // Extract social media name (FB/Instagram)
  // Index 02 in customerDataOrder, or check by field name
  const socialMediaName = 
    getValue('Facebook or Instagram Name. (The one you used to inquire with me.)', 2) ||
    getValue('Facebook or Instagram Name. (The one you used to inquire with me)', 2) ||
    getValue('Facebook or Instagram Name', 2) ||
    customerData['FB Name'] ||
    customerData['fb name'] ||
    customerData['Facebook Name'] ||
    customerData['facebookName'] ||
    customerData['Instagram Name'] ||
    customerData['instagramName'] ||
    customerData['Social Media Name'] ||
    customerData['socialMediaName'] ||
    customerData['FB name/Instagram name'] ||
    customerData['FB/Instagram'] ||
    undefined;

  // Extract referral source (how did you find out about glammednails)
  // Index 09 in customerDataOrder - try both index 9 and 8 (in case of off-by-one)
  // First, directly check index 9 in customerDataOrder if it exists
  let referralSource: string | undefined = undefined;
  
  if (customerDataOrder && customerDataOrder.length > 9) {
    const fieldNameAtIndex9 = customerDataOrder[9];
    if (fieldNameAtIndex9 && customerData[fieldNameAtIndex9]) {
      referralSource = customerData[fieldNameAtIndex9].trim();
    }
  }
  
  // If not found, try index 8
  if (!referralSource && customerDataOrder && customerDataOrder.length > 8) {
    const fieldNameAtIndex8 = customerDataOrder[8];
    if (fieldNameAtIndex8 && customerData[fieldNameAtIndex8]) {
      referralSource = customerData[fieldNameAtIndex8].trim();
    }
  }
  
  // Then try by field name variations
  if (!referralSource) {
    referralSource = 
      getValue('How did you find out about glammednailsbyjhen?', 9) ||
      getValue('How did you find out about glammednailsbyjhen?', 8);
  }
  
  if (!referralSource) {
    // Try other field name variations with both indices
    referralSource = 
      getValue('How did you find out about glammednailsbyjhen', 9) ||
      getValue('How did you find out about glammednailsbyjhen', 8) ||
      getValue('How did you find out about glammednails', 9) ||
      getValue('How did you find out about glammednails', 8) ||
      getValue('How did you find out about glammednailsbyjhen', 9) ||
      getValue('How did you find out about glammednailsbyjhen', 9) ||
      customerData['How did you find out about glammednailsbyjhen?']?.trim() ||
      customerData['How did you find out about glammednailsbyjhen']?.trim() ||
      customerData['Referral Source']?.trim() ||
      customerData['referralSource']?.trim() ||
      customerData['How did you hear about us']?.trim() ||
      customerData['How did you hear about us?']?.trim() ||
      customerData['Source']?.trim() ||
      customerData['source']?.trim() ||
      undefined;
  }
  
  // Fallback: search all keys for variations containing "find out" or "glammednails"
  if (!referralSource) {
    const keys = Object.keys(customerData);
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      if ((lowerKey.includes('find out') || lowerKey.includes('glammednails') || lowerKey.includes('referral') || lowerKey.includes('source')) && 
          customerData[key] && customerData[key].trim()) {
        referralSource = customerData[key].trim();
        break;
      }
    }
  }
  
  // Debug: if customerDataOrder exists, log what's at index 9
  if (process.env.NODE_ENV === 'development' && customerDataOrder && customerDataOrder.length > 9) {
    console.log('customerDataOrder[9]:', customerDataOrder[9]);
    console.log('Value at that key:', customerData[customerDataOrder[9]]);
  }

  return { 
    name: fullName, 
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    email, 
    phone,
    socialMediaName,
    referralSource
  };
}

// OPTIMIZED: Customer lookup cache to reduce Firestore reads during Google Sheets sync
// Customer lookups happen frequently during sync - caching reduces reads significantly
interface CachedCustomer {
  customer: Customer;
  timestamp: number;
}

class CustomerLookupCache {
  private cache: Map<string, CachedCustomer> = new Map();
  private readonly TTL = 10 * 60 * 1000; // 10 minutes cache
  private readonly MAX_SIZE = 500; // Max 500 cached customers

  get(key: string): Customer | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.customer;
  }

  set(key: string, customer: Customer): void {
    if (this.cache.size >= this.MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { customer, timestamp: Date.now() });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}

const customerLookupCache = new CustomerLookupCache();

/**
 * Find or create a customer based on email or phone
 * If neither exists, creates a new customer
 * OPTIMIZED: Added caching to reduce Firestore reads during Google Sheets sync
 */
export async function findOrCreateCustomer(
  customerData?: Record<string, string>,
  customerDataOrder?: string[],
  isRepeatClient?: boolean // Optional: mark as repeat client (for imports from old sheets)
): Promise<Customer> {
  if (!customerData) {
    throw new Error('Customer data is required');
  }

  const { name, firstName, lastName, email, phone, socialMediaName, referralSource } = extractCustomerInfo(customerData, customerDataOrder);

  // OPTIMIZED: Check cache first to reduce Firestore reads
  if (email) {
    const cached = customerLookupCache.get(`email:${email.toLowerCase()}`);
    if (cached) {
      // Found in cache - return immediately (no Firestore read!)
      return cached;
    }
  }
  
  if (phone) {
    const cached = customerLookupCache.get(`phone:${phone}`);
    if (cached) {
      return cached;
    }
  }

  // Try to find existing customer by email first
  if (email) {
    const emailSnapshot = await getCustomersCollection().where('email', '==', email).limit(1).get();
    if (!emailSnapshot.empty) {
      const existing = docToCustomer(emailSnapshot.docs[0].id, emailSnapshot.docs[0].data());
      // If the same email is used but the name is clearly different (e.g. booking for a sister),
      // create a NEW customer instead of merging into the existing one.
      if (name && existing.name && name.trim() !== existing.name.trim()) {
        // fall through to \"create new customer\" section below
      } else {
        // Otherwise, update missing fields or changed fields
        const updates: any = { updatedAt: Timestamp.now().toDate().toISOString() };
        if (phone && phone !== existing.phone) {
          updates.phone = phone;
        }
        if (firstName && !existing.firstName) {
          updates.firstName = firstName;
        }
        if (lastName && !existing.lastName) {
          updates.lastName = lastName;
        }
        if (socialMediaName && !existing.socialMediaName) {
          updates.socialMediaName = socialMediaName;
        }
        if (referralSource && (!existing.referralSource || referralSource !== existing.referralSource)) {
          updates.referralSource = referralSource;
        }
        // If isRepeatClient is provided and different from existing, update it
        if (isRepeatClient !== undefined && existing.isRepeatClient !== isRepeatClient) {
          updates.isRepeatClient = isRepeatClient;
        }
        // Preserve existing email - don't update if customer already has an email saved
        // Only update email if the existing customer doesn't have one
        if (email && !existing.email) {
          updates.email = email;
        }
        if (Object.keys(updates).length > 1) {
          await emailSnapshot.docs[0].ref.set(updates, { merge: true });
          const updated = { ...existing, ...updates };
          // OPTIMIZED: Cache the result
          if (email) customerLookupCache.set(`email:${email.toLowerCase()}`, updated);
          if (phone) customerLookupCache.set(`phone:${phone}`, updated);
          return updated;
        }
        // OPTIMIZED: Cache the result even if no updates
        if (email) customerLookupCache.set(`email:${email.toLowerCase()}`, existing);
        if (phone) customerLookupCache.set(`phone:${phone}`, existing);
        return existing;
      }
    }
  }

  // Try to find by phone if no email match
  if (phone) {
    const phoneSnapshot = await getCustomersCollection().where('phone', '==', phone).limit(1).get();
    if (!phoneSnapshot.empty) {
      const existing = docToCustomer(phoneSnapshot.docs[0].id, phoneSnapshot.docs[0].data());
      // If the same phone is used but the name is different, create a NEW customer.
      if (name && existing.name && name.trim() !== existing.name.trim()) {
        // fall through to \"create new customer\" section below
      } else {
        // Otherwise, update missing fields or changed fields
        const updates: any = { updatedAt: Timestamp.now().toDate().toISOString() };
        // Preserve existing email - don't update if customer already has an email saved
        // Only update email if the existing customer doesn't have one
        if (email && !existing.email) {
          updates.email = email;
        }
        if (firstName && !existing.firstName) {
          updates.firstName = firstName;
        }
        if (lastName && !existing.lastName) {
          updates.lastName = lastName;
        }
        if (socialMediaName && !existing.socialMediaName) {
          updates.socialMediaName = socialMediaName;
        }
        if (referralSource && (!existing.referralSource || referralSource !== existing.referralSource)) {
          updates.referralSource = referralSource;
        }
        // If isRepeatClient is provided and different from existing, update it
        if (isRepeatClient !== undefined && existing.isRepeatClient !== isRepeatClient) {
          updates.isRepeatClient = isRepeatClient;
        }
        if (Object.keys(updates).length > 1) {
          await phoneSnapshot.docs[0].ref.set(updates, { merge: true });
          const updated = { ...existing, ...updates };
          // OPTIMIZED: Cache the result
          if (email) customerLookupCache.set(`email:${email.toLowerCase()}`, updated);
          if (phone) customerLookupCache.set(`phone:${phone}`, updated);
          return updated;
        }
        // OPTIMIZED: Cache the result even if no updates
        if (email) customerLookupCache.set(`email:${email.toLowerCase()}`, existing);
        if (phone) customerLookupCache.set(`phone:${phone}`, existing);
        return existing;
      }
    }
  }

  // Create new customer
  const newCustomer = {
    name,
    firstName,
    lastName,
    email,
    phone,
    socialMediaName,
    referralSource,
    isRepeatClient: isRepeatClient ?? undefined,
    createdAt: Timestamp.now().toDate().toISOString(),
    updatedAt: Timestamp.now().toDate().toISOString(),
  };

  const dataToSave = omitUndefined(newCustomer);
  const docRef = await getCustomersCollection().add(dataToSave);
  const created = docToCustomer(docRef.id, dataToSave);
  
  // OPTIMIZED: Cache the newly created customer
  if (email) customerLookupCache.set(`email:${email.toLowerCase()}`, created);
  if (phone) customerLookupCache.set(`phone:${phone}`, created);
  
  return created;
}

/**
 * Get customer by ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const snapshot = await getCustomersCollection().doc(id).get();
  if (!snapshot.exists) return null;
  return docToCustomer(snapshot.id, snapshot.data()!);
}

/**
 * Find customer by email (case-insensitive)
 */
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  if (!email) return null;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  
  const snapshot = await getCustomersCollection()
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  return docToCustomer(snapshot.docs[0].id, snapshot.docs[0].data());
}

/**
 * Find customer by phone number (normalized)
 */
export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  if (!phone) return null;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;
  
  const snapshot = await getCustomersCollection()
    .where('phone', '==', normalizedPhone)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  return docToCustomer(snapshot.docs[0].id, snapshot.docs[0].data());
}

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
 * List all customers
 * OPTIMIZED: Added default limit of 500 to prevent fetching all customers
 * This reduces reads significantly (was fetching 338+ customers every time)
 */
export async function listCustomers(limitCount?: number): Promise<Customer[]> {
  const limit = limitCount ?? 500; // Default limit - enough for admin dashboard
  const snapshot = await getCustomersCollection()
    .orderBy('name')
    .limit(limit)
    .get();
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
  await getCustomersCollection().doc(id).set(updateData, { merge: true });
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
  const docRef = await getCustomersCollection().add(customerData);
  return docToCustomer(docRef.id, customerData);
}

/**
 * Delete a customer by ID
 */
export async function deleteCustomer(id: string): Promise<void> {
  await getCustomersCollection().doc(id).delete();
}

function docToCustomer(id: string, data: FirebaseFirestore.DocumentData): Customer {
  return {
    id,
    name: data.name,
    firstName: data.firstName ?? undefined,
    lastName: data.lastName ?? undefined,
    email: data.email ?? undefined,
    phone: data.phone ?? undefined,
    socialMediaName: data.socialMediaName ?? undefined,
    referralSource: data.referralSource ?? undefined,
    isRepeatClient: data.isRepeatClient ?? undefined,
    notes: data.notes ?? undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

