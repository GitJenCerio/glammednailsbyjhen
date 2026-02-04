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

  // Helper function to find field by fuzzy matching (case-insensitive, partial match)
  const findFieldByKeywords = (keywords: string[], excludeKeywords: string[] = []): string | undefined => {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    const lowerExclude = excludeKeywords.map(k => k.toLowerCase());
    
    for (const [key, value] of Object.entries(customerData)) {
      if (!value || !String(value).trim()) continue;
      
      const lowerKey = key.toLowerCase();
      
      // Skip if key contains any exclude keywords
      if (lowerExclude.some(exclude => lowerKey.includes(exclude))) {
        continue;
      }
      
      // Check if key matches any keyword
      if (lowerKeywords.some(kw => lowerKey.includes(kw) || lowerKey === kw)) {
        const trimmed = String(value).trim();
        if (trimmed && trimmed.length > 0 && trimmed.length < 100) {
          return trimmed;
        }
      }
    }
    return undefined;
  };

  // Try to find first name - check common field name variations
  // Priority: exact matches first, then fuzzy matching
  let firstName = '';
  
  // Try exact matches first (including full Google Sheets field names)
  // Check for exact field names from Google Sheets first
  const nameFieldVariations = [
    'Name ( Autofill if repeat clients)',
    'Name (Autofill if repeat clients)',
    'Name',
    'name',
  ];
  
  for (const fieldName of nameFieldVariations) {
    if (customerData[fieldName] && String(customerData[fieldName]).trim()) {
      firstName = String(customerData[fieldName]).trim();
      break;
    }
  }
  
  // If not found, try case-insensitive matching with loop
  if (!firstName) {
    for (const [key, value] of Object.entries(customerData)) {
      const lowerKey = key.toLowerCase().trim();
      // Match "Name" field (but not Surname, Last Name, etc.)
      if ((lowerKey === 'name' || lowerKey.startsWith('name (')) && 
          !lowerKey.includes('surname') && 
          !lowerKey.includes('last name') && 
          !lowerKey.includes('lastname') &&
          !lowerKey.includes('facebook') &&
          !lowerKey.includes('instagram') &&
          !lowerKey.includes('social') &&
          !lowerKey.includes('inquire') &&
          value && String(value).trim()) {
        firstName = String(value).trim();
        break;
      }
    }
  }
  
  // Fallback to common variations
  if (!firstName) {
    firstName = 
      customerData['Name'] || 
      customerData['name'] || 
      customerData['First Name'] ||
      customerData['firstName'] ||
      customerData['Customer Name'] ||
      customerData['customerName'] ||
      '';
  }

  // Try to find last name/surname - exact matches first
  let lastName = '';
  
  // Try exact matches first (including full Google Sheets field names)
  // Check for exact field names from Google Sheets first
  const surnameFieldVariations = [
    'Surname ( Autofill if repeat clients)',
    'Surname (Autofill if repeat clients)',
    'Surname',
    'surname',
  ];
  
  for (const fieldName of surnameFieldVariations) {
    if (customerData[fieldName] && String(customerData[fieldName]).trim()) {
      lastName = String(customerData[fieldName]).trim();
      break;
    }
  }
  
  // If not found, try case-insensitive matching with loop
  if (!lastName) {
    for (const [key, value] of Object.entries(customerData)) {
      const lowerKey = key.toLowerCase().trim();
      // Match "Surname" field (exact or with parentheses)
      if ((lowerKey === 'surname' || lowerKey.startsWith('surname (')) && 
          value && String(value).trim()) {
        lastName = String(value).trim();
        break;
      }
    }
  }
  
  // Fallback to common variations
  if (!lastName) {
    lastName = 
      customerData['Surname'] || 
      customerData['surname'] || 
      customerData['Last Name'] || 
      customerData['lastName'] ||
      customerData['Customer Surname'] ||
      customerData['customerSurname'] ||
      customerData['Family Name'] ||
      customerData['familyName'] ||
      '';
  }

  // If we didn't find first name, try fuzzy search (excluding social media, email, phone, etc.)
  if (!firstName || firstName.trim() === '') {
    firstName = findFieldByKeywords(
      ['first name', 'firstname', 'fname', 'given name', 'name'],
      ['surname', 'last name', 'lastname', 'email', 'phone', 'contact', 'facebook', 'instagram', 'social', 'fb', 'ig', 'booking', 'date', 'time', 'service', 'location', 'referral', 'source', 'inquire']
    ) || '';
  }

  // If we didn't find last name, try fuzzy search
  if (!lastName || lastName.trim() === '') {
    lastName = findFieldByKeywords(
      ['surname', 'last name', 'lastname', 'lname', 'family name'],
      ['first name', 'firstname', 'email', 'phone', 'contact', 'facebook', 'instagram', 'social', 'fb', 'ig', 'booking', 'date', 'time', 'service', 'location', 'referral', 'source', 'inquire']
    ) || '';
  }

  // If we have a "Full Name" field, try to split it
  const fullNameField = customerData['Full Name'] || customerData['fullName'] || customerData['Full name'] || '';
  if (fullNameField && (!firstName || !lastName)) {
    const parts = fullNameField.trim().split(/\s+/);
    if (parts.length >= 2) {
      // Assume first part is first name, rest is last name
      if (!firstName) firstName = parts[0];
      if (!lastName) lastName = parts.slice(1).join(' ');
    } else if (parts.length === 1 && !firstName) {
      // Single name - use as first name
      firstName = parts[0];
    }
  }

  // Build full name - avoid duplicating last name
  // If firstName already contains lastName, don't add it again
  let fullName = '';
  if (firstName && lastName) {
    // Check if firstName already ends with lastName (to avoid duplication)
    const firstNameLower = firstName.toLowerCase().trim();
    const lastNameLower = lastName.toLowerCase().trim();
    if (firstNameLower.endsWith(lastNameLower)) {
      // Last name is already in first name, don't duplicate
      fullName = firstName.trim();
    } else {
      fullName = `${firstName} ${lastName}`.trim();
    }
  } else if (firstName) {
    fullName = firstName.trim();
  } else if (lastName) {
    fullName = lastName.trim();
  }
  
  // If we still don't have a name, try to find ANY field that looks like a name
  if (!fullName || fullName === '') {
    // Search through all fields for something that looks like a name
    for (const [key, value] of Object.entries(customerData)) {
      if (!value || !String(value).trim()) continue;
      
      const lowerKey = key.toLowerCase();
      const strValue = String(value).trim();
      
      // Skip non-name fields
      if (lowerKey.includes('email') || 
          lowerKey.includes('phone') || 
          lowerKey.includes('contact') || 
          lowerKey.includes('booking') || 
          lowerKey.includes('date') || 
          lowerKey.includes('time') ||
          lowerKey.includes('service') || 
          lowerKey.includes('location') || 
          lowerKey.includes('referral') || 
          lowerKey.includes('source') ||
          lowerKey.includes('instagram') || 
          lowerKey.includes('facebook') || 
          lowerKey.includes('social') || 
          lowerKey.includes('fb') ||
          lowerKey.includes('ig') ||
          lowerKey.includes('inquire')) {
        continue;
      }
      
      // If the key contains "name" or the value looks like a name (reasonable length, no @, no numbers)
      if ((lowerKey.includes('name') || strValue.length > 2 && strValue.length < 50 && !strValue.includes('@') && !/^\d+$/.test(strValue))) {
        // Use this as the name
        fullName = strValue;
        if (!firstName) firstName = strValue.split(/\s+/)[0];
        break;
      }
    }
  }

  // Final fallback: use social media name if no other name found
  if (!fullName || fullName.trim() === '') {
    // Try to get social media name as last resort
    const socialMediaName = 
      customerData['Facebook or Instagram Name'] ||
      customerData['FB Name'] ||
      customerData['Social Media Name'] ||
      customerData['Facebook or Instagram Name. (The one you used to inquire with me.)'] ||
      customerData['Facebook or Instagram Name. (The one you used to inquire with me)'] ||
      findFieldByKeywords(['facebook', 'instagram', 'fb name', 'ig name', 'social media name'], []) ||
      undefined;
    
    if (socialMediaName && socialMediaName.trim()) {
      fullName = socialMediaName.trim();
      firstName = fullName.split(/\s+/)[0];
    } else {
      fullName = 'Unknown Customer';
    }
  }

  // Extract email
  const email = 
    customerData['Email'] || 
    customerData['email'] || 
    customerData['E-mail'] ||
    customerData['Email Address'] ||
    customerData['emailAddress'] ||
    undefined;

  // Extract phone - try multiple variations including "Contact Number"
  // Priority: exact matches with full Google Sheets field names first
  let phone: string | undefined = undefined;
  
  // Try exact matches first (including full Google Sheets field names with parentheses)
  // Check for exact field names from Google Sheets first
  const phoneFieldVariations = [
    'Contact Number ( Autofill if repeat clients)',
    'Contact Number (Autofill if repeat clients)',
    'Contact Number',
    'contact number',
  ];
  
  for (const fieldName of phoneFieldVariations) {
    if (customerData[fieldName] && String(customerData[fieldName]).trim()) {
      phone = String(customerData[fieldName]).trim();
      break;
    }
  }
  
  // If not found, try case-insensitive matching with loop
  if (!phone) {
    for (const [key, value] of Object.entries(customerData)) {
      const lowerKey = key.toLowerCase().trim();
      // Match "Contact Number" field (exact or with parentheses/autofill text)
      if ((lowerKey === 'contact number' || 
           lowerKey.startsWith('contact number (')) && 
          value && String(value).trim()) {
        phone = String(value).trim();
        break;
      }
    }
  }
  
  // Fallback to common variations
  if (!phone) {
    phone = 
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
  }

  // Extract social media name (FB/Instagram)
  // Priority: exact matches with full Google Sheets field names first
  let socialMediaName: string | undefined = undefined;
  
  // Try exact matches first (including full Google Sheets field names with all variations)
  // Check for exact field names from Google Sheets first
  const socialMediaFieldVariations = [
    'Facebook or Instagram Name. (The one you used to inquire with me.) Autofill if repeat clients',
    'Facebook or Instagram Name. (The one you used to inquire with me.)',
    'Facebook or Instagram Name. (The one you used to inquire with me)',
    'Facebook or Instagram Name',
    'FB Name',
    'fb name',
  ];
  
  for (const fieldName of socialMediaFieldVariations) {
    if (customerData[fieldName] && String(customerData[fieldName]).trim()) {
      const trimmed = String(customerData[fieldName]).trim();
      // Skip if it looks like a booking ID
      if (!/^GN-\d+$/i.test(trimmed)) {
        socialMediaName = trimmed;
        break;
      }
    }
  }
  
  // If not found, try case-insensitive matching with loop
  if (!socialMediaName) {
    for (const [key, value] of Object.entries(customerData)) {
      const lowerKey = key.toLowerCase().trim();
      // Match Facebook/Instagram name field - must contain "facebook" or "instagram" and "name"
      // But exclude booking ID fields and other non-social-media fields
      if ((lowerKey.includes('facebook') || lowerKey.includes('instagram') || lowerKey.includes('fb') || lowerKey.includes('ig')) &&
          lowerKey.includes('name') &&
          !lowerKey.includes('booking') &&
          !lowerKey.startsWith('gn-') &&
          value && String(value).trim()) {
        const trimmedValue = String(value).trim();
        // Double-check it's not a booking ID
        if (!/^GN-\d+$/i.test(trimmedValue)) {
          socialMediaName = trimmedValue;
          break;
        }
      }
    }
  }
  
  // Fallback to common variations (but skip if it looks like a booking ID)
  if (!socialMediaName) {
    const candidates = [
      customerData['Facebook or Instagram Name. (The one you used to inquire with me.)'],
      customerData['Facebook or Instagram Name. (The one you used to inquire with me)'],
      customerData['Facebook or Instagram Name'],
      customerData['FB Name'],
      customerData['fb name'],
      customerData['Facebook Name'],
      customerData['facebookName'],
      customerData['Instagram Name'],
      customerData['instagramName'],
      customerData['Social Media Name'],
      customerData['socialMediaName'],
      customerData['FB name/Instagram name'],
      customerData['FB/Instagram'],
    ];
    
    for (const candidate of candidates) {
      if (candidate && String(candidate).trim()) {
        const trimmed = String(candidate).trim();
        // Skip if it looks like a booking ID
        if (!/^GN-\d+$/i.test(trimmed)) {
          socialMediaName = trimmed;
          break;
        }
      }
    }
  }

  // Extract referral source (how did you find out about glammednails)
  // Priority: exact matches with full Google Sheets field names first
  let referralSource: string | undefined = undefined;
  
  // Try exact matches first (including full Google Sheets field names with parentheses)
  // Check for exact field names from Google Sheets first
  const referralFieldVariations = [
    'How did you find out about glammednailsbyjhen?  ( Autofill if repeat clients)',
    'How did you find out about glammednailsbyjhen? ( Autofill if repeat clients)',
    'How did you find out about glammednailsbyjhen? (Autofill if repeat clients)',
    'How did you find out about glammednailsbyjhen?',
    'How did you find out about glammednailsbyjhen',
  ];
  
  for (const fieldName of referralFieldVariations) {
    if (customerData[fieldName] && String(customerData[fieldName]).trim()) {
      const trimmedValue = String(customerData[fieldName]).trim();
      // Skip if it looks like a single name word (common last names that might be misidentified)
      // Also skip if it's too short or looks like a name pattern
      const isSingleNameWord = /^[A-Z][a-z]+$/.test(trimmedValue);
      const isLikelyName = trimmedValue.length < 15 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmedValue) && !trimmedValue.includes('?') && !trimmedValue.includes('!');
      if (trimmedValue.length > 2 && !isSingleNameWord && !isLikelyName) {
        referralSource = trimmedValue;
        break;
      }
    }
  }
  
  // If not found, try case-insensitive matching with loop
  if (!referralSource) {
    for (const [key, value] of Object.entries(customerData)) {
      const lowerKey = key.toLowerCase().trim();
      // Match referral source field - must contain "find out" or "glammednails" or "referral"
      // But exclude name fields and other non-referral fields
      if ((lowerKey.includes('find out') || 
           lowerKey.includes('glammednails') || 
           (lowerKey.includes('referral') && lowerKey.includes('source')) || 
           (lowerKey.includes('source') && (lowerKey.includes('referral') || lowerKey.includes('find')))) &&
          !lowerKey.includes('name') &&
          !lowerKey.includes('surname') &&
          !lowerKey.includes('email') &&
          !lowerKey.includes('phone') &&
          !lowerKey.includes('contact') &&
          !lowerKey.includes('booking') &&
          !lowerKey.includes('first') &&
          !lowerKey.includes('last') &&
          value && String(value).trim()) {
        const trimmedValue = String(value).trim();
        // Skip if it looks like a single name word (common last names that might be misidentified)
        // Also skip if it's too short or looks like a name pattern
        const isSingleNameWord = /^[A-Z][a-z]+$/.test(trimmedValue);
        const isLikelyName = trimmedValue.length < 15 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmedValue) && !trimmedValue.includes('?') && !trimmedValue.includes('!');
        if (trimmedValue.length > 2 && !isSingleNameWord && !isLikelyName) {
          referralSource = trimmedValue;
          break;
        }
      }
    }
  }
  
  // Fallback: try by field name variations
  if (!referralSource) {
    referralSource = 
      customerData['How did you find out about glammednailsbyjhen?']?.trim() ||
      customerData['How did you find out about glammednailsbyjhen']?.trim() ||
      customerData['How did you find out about glammednails?']?.trim() ||
      customerData['How did you find out about glammednails']?.trim() ||
      customerData['Referral Source']?.trim() ||
      customerData['referralSource']?.trim() ||
      customerData['How did you hear about us']?.trim() ||
      customerData['How did you hear about us?']?.trim() ||
      customerData['Source']?.trim() ||
      customerData['source']?.trim() ||
      undefined;
  }
  
  // Final fallback: search all keys for variations containing "find out" or "glammednails"
  if (!referralSource) {
    const keys = Object.keys(customerData);
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      if ((lowerKey.includes('find out') || lowerKey.includes('glammednails') || lowerKey.includes('referral') || lowerKey.includes('source')) && 
          !lowerKey.includes('name') &&
          !lowerKey.includes('surname') &&
          customerData[key] && customerData[key].trim()) {
        const trimmed = customerData[key].trim();
        // Skip if it looks like a name (single capitalized word)
        if (trimmed.length > 2 && !/^[A-Z][a-z]+$/.test(trimmed)) {
          referralSource = trimmed;
          break;
        }
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
        // Update name if existing name is "Unknown Customer" or if we have a better name
        if (name && name !== 'Unknown Customer' && 
            (existing.name === 'Unknown Customer' || !existing.name || existing.name.trim() === '')) {
          updates.name = name;
        } else if (firstName || lastName) {
          // Rebuild name from firstName and lastName if we have them
          const rebuiltName = `${firstName || existing.firstName || ''}${(firstName || existing.firstName) && (lastName || existing.lastName) ? ' ' : ''}${lastName || existing.lastName || ''}`.trim();
          if (rebuiltName && rebuiltName !== 'Unknown Customer' && 
              (existing.name === 'Unknown Customer' || !existing.name || existing.name.trim() === '')) {
            updates.name = rebuiltName;
          }
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
        // Update name if existing name is "Unknown Customer" or if we have a better name
        if (name && name !== 'Unknown Customer' && 
            (existing.name === 'Unknown Customer' || !existing.name || existing.name.trim() === '')) {
          updates.name = name;
        } else if (firstName || lastName) {
          // Rebuild name from firstName and lastName if we have them
          const rebuiltName = `${firstName || existing.firstName || ''}${(firstName || existing.firstName) && (lastName || existing.lastName) ? ' ' : ''}${lastName || existing.lastName || ''}`.trim();
          if (rebuiltName && rebuiltName !== 'Unknown Customer' && 
              (existing.name === 'Unknown Customer' || !existing.name || existing.name.trim() === '')) {
            updates.name = rebuiltName;
          }
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

