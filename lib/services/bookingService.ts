import { Timestamp } from 'firebase-admin/firestore';
import type admin from 'firebase-admin';
import { format, parseISO } from 'date-fns';
import { adminDb } from '../firebaseAdmin';
import { Booking, BookingStatus, ServiceType, Slot, Invoice, PaymentStatus } from '../types';
import { listBlockedDates } from './blockService';
import { slotIsBlocked } from '../scheduling';
import { buildPrefilledGoogleFormUrl } from '../googleForms';
import { getNextSlotTime } from '../constants/slots';
import { findOrCreateCustomer, getCustomerById, getCustomerByEmail, getCustomerByPhone } from './customerService';
import { getDefaultNailTech } from './nailTechService';
// Email functionality disabled - imports removed

// Use getters to avoid touching Firebase at module load time in some places
const getBookingsCollection = () => adminDb.collection('bookings');
const getSlotsCollection = () => adminDb.collection('slots');
const getCustomersCollection = () => adminDb.collection('customers');
// Keep direct references for existing logic that expects const collections
const bookingsCollection = adminDb.collection('bookings');
const slotsCollection = adminDb.collection('slots');
const customersCollection = adminDb.collection('customers');

export async function listBookings(limitCount?: number): Promise<Booking[]> {
  // OPTIMIZED: Added default limit of 5000 most recent bookings to prevent quota exhaustion
  // This is enough for most admin dashboard use cases while preventing excessive reads
  // If you need more, pass a higher limitCount or implement pagination
  const limit = limitCount ?? 5000;
  
  const snapshot = await getBookingsCollection()
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  // Handle backward compatibility: assign default nail tech to bookings without one
  const defaultNailTech = await getDefaultNailTech();
  const bookings: Booking[] = [];
  const bookingsToUpdate: Array<{ ref: admin.firestore.DocumentReference; nailTechId: string }> = [];
  
  // First pass: collect bookings and identify which need updates
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.nailTechId && defaultNailTech) {
      // Queue for batch update (don't block on individual writes)
      bookingsToUpdate.push({ ref: doc.ref, nailTechId: defaultNailTech.id });
      bookings.push(docToBooking(doc.id, { ...data, nailTechId: defaultNailTech.id }));
    } else {
      bookings.push(docToBooking(doc.id, data));
    }
  }
  
  // OPTIMIZED: Batch update bookings that need nailTechId (non-blocking, fire and forget)
  // This reduces writes from N individual writes to 1 batch write
  if (bookingsToUpdate.length > 0) {
    const batch = adminDb.batch();
    bookingsToUpdate.forEach(({ ref, nailTechId }) => {
      batch.set(ref, { nailTechId }, { merge: true });
    });
    // Execute in background - don't block response
    batch.commit().catch(err => {
      console.warn('Background booking update failed (non-critical):', err);
    });
  }
  
  return bookings;
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const snapshot = await getBookingsCollection().doc(id).get();
  if (!snapshot.exists) return null;
  
  const data = snapshot.data()!;
  // Handle backward compatibility
  if (!data.nailTechId) {
    const defaultNailTech = await getDefaultNailTech();
    if (defaultNailTech) {
      await snapshot.ref.set({ nailTechId: defaultNailTech.id }, { merge: true });
      return docToBooking(snapshot.id, { ...data, nailTechId: defaultNailTech.id });
    }
  }
  
  return docToBooking(snapshot.id, data);
}

type CreateBookingOptions = {
  serviceType?: ServiceType;
  pairedSlotId?: string | null;
  linkedSlotIds?: string[] | null;
  clientType?: 'new' | 'repeat';
  repeatClientEmail?: string; // Email for repeat clients to lookup and prefill
  serviceLocation?: 'homebased_studio' | 'home_service';
  socialMediaName?: string; // Facebook or Instagram name for new clients
};

export function getRequiredSlotCount(serviceType: ServiceType): number {
  switch (serviceType) {
    case 'mani_pedi':
    case 'home_service_2slots':
      return 2;
    case 'home_service_3slots':
      return 3;
    default:
      return 1;
  }
}

/**
 * Get the next sequential booking number
 * Returns the next number in sequence (e.g., 1, 2, 3...) based on existing bookings
 * Only considers sequential IDs (GN-00001, GN-00002, etc.) and ignores old timestamp-based IDs
 * OPTIMIZED: Queries only recent bookings (last 1000) ordered by createdAt to find max number
 */
/**
 * Get the next booking number using a Firestore counter document.
 * This replaces the previous approach that queried 1000 bookings (saves ~1000 reads per booking).
 * Uses a transaction to ensure atomic increment and prevent race conditions.
 */
async function getNextBookingNumber(): Promise<number> {
  const counterRef = adminDb.collection('counters').doc('bookingNumber');
  
  // Use transaction to atomically read and increment
  return await adminDb.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    let currentValue = 0;
    if (counterDoc.exists) {
      const data = counterDoc.data();
      currentValue = data?.value || 0;
    }
    
    // Increment and update
    const nextValue = currentValue + 1;
    transaction.set(counterRef, { value: nextValue }, { merge: true });
    
    return nextValue;
  });
}

export async function createBooking(slotId: string, options?: CreateBookingOptions) {
  // Generate sequential booking ID: GN-00001, GN-00002, etc.
  const nextNumber = await getNextBookingNumber();
  const bookingId = `GN-${nextNumber.toString().padStart(5, '0')}`;
  const formEntryKey = process.env.GOOGLE_FORM_BOOKING_ID_ENTRY;
  const formDateEntryKey = process.env.GOOGLE_FORM_DATE_ENTRY;
  const formTimeEntryKey = process.env.GOOGLE_FORM_TIME_ENTRY;
  const formServiceLocationEntryKey = process.env.GOOGLE_FORM_SERVICE_LOCATION_ENTRY;
  
  // Customer data prefill entry keys (optional - set in environment variables)
  const formNameEntryKey = process.env.GOOGLE_FORM_NAME_ENTRY;
  const formEmailEntryKey = process.env.GOOGLE_FORM_EMAIL_ENTRY;
  // Get phone entry key and fix common typos (like "eentry" instead of "entry")
  let formPhoneEntryKey = process.env.GOOGLE_FORM_PHONE_ENTRY || process.env.GOOGLE_FORM_CONTACT_NUMBER_ENTRY;
  if (formPhoneEntryKey && formPhoneEntryKey.startsWith('eentry.')) {
    // Fix typo: eentry. -> entry.
    formPhoneEntryKey = 'entry.' + formPhoneEntryKey.substring(7);
    console.warn(`Fixed typo in phone entry key: changed "${process.env.GOOGLE_FORM_PHONE_ENTRY || process.env.GOOGLE_FORM_CONTACT_NUMBER_ENTRY}" to "${formPhoneEntryKey}"`);
  }
  const formFirstNameEntryKey = process.env.GOOGLE_FORM_FIRST_NAME_ENTRY;
  const formLastNameEntryKey = process.env.GOOGLE_FORM_LAST_NAME_ENTRY;
  const formSocialMediaEntryKey = process.env.GOOGLE_FORM_SOCIAL_MEDIA_ENTRY;
  const formReferralSourceEntryKey = process.env.GOOGLE_FORM_REFERRAL_SOURCE_ENTRY;
  
  // Look up customer by email or phone if repeat client identifier is provided
  let customerData: { name?: string; firstName?: string; lastName?: string; email?: string; phone?: string; socialMediaName?: string; referralSource?: string } | null = null;
  let foundCustomerId: string | null = null;
  if (options?.repeatClientEmail) {
    // Determine if it's an email or phone number
    const isEmail = options.repeatClientEmail.includes('@');
    let customer = null;
    
    if (isEmail) {
      // Try email first
      customer = await getCustomerByEmail(options.repeatClientEmail);
      if (customer) {
        console.log(`Found customer by email: ${customer.name} (${customer.email})`);
      }
    } else {
      // Try phone number
      customer = await getCustomerByPhone(options.repeatClientEmail);
      if (customer) {
        console.log(`Found customer by phone: ${customer.name} (${customer.phone})`);
      }
    }
    
    // If not found and it was an email, try phone as fallback
    // If not found and it was a phone, try email as fallback (though unlikely to have email in phone format)
    if (!customer && isEmail) {
      // Could also try phone, but we don't have phone in this case
    }
    
    if (customer) {
      foundCustomerId = customer.id; // Store the customer ID for later use
      customerData = {
        name: customer.name,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        socialMediaName: customer.socialMediaName,
        referralSource: customer.referralSource,
      };
    } else {
      console.log(`No customer found with ${isEmail ? 'email' : 'phone'}: ${options.repeatClientEmail}`);
    }
  }
  const formUrl = process.env.GOOGLE_FORM_BASE_URL;

  if (!formEntryKey || !formUrl) {
    throw new Error('Missing Google Form configuration.');
  }

  const serviceType = options?.serviceType ?? 'manicure';
  const requiredSlotCount = getRequiredSlotCount(serviceType);
  const providedLinkedSlotIds = options?.linkedSlotIds ?? (options?.pairedSlotId ? [options.pairedSlotId] : []);
  const serviceLocation = options?.serviceLocation ?? 'homebased_studio';
  const blocks = await listBlockedDates();
  let slotDate: string | null = null;
  let slotTime: string | null = null;
  let finalLinkedSlotTime: string | null = null;

  let slotNailTechId: string | null = null;

  await adminDb.runTransaction(async (transaction) => {
    const slotRef = getSlotsCollection().doc(slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists) throw new Error('Slot not found.');
    const slot = docToSlot(slotSnap.id, slotSnap.data()!);
    slotDate = slot.date; // Store date for use after transaction
    slotTime = slot.time; // Store time for use after transaction
    slotNailTechId = slot.nailTechId; // Store nail tech ID from slot

    if (slot.status !== 'available') {
      throw new Error(`Slot is no longer available. Current status: ${slot.status}. Please select a different slot.`);
    }

    if (slotIsBlocked(slot, blocks)) {
      throw new Error('Slot is blocked.');
    }

    if (requiredSlotCount === 1 && providedLinkedSlotIds.length > 0) {
      throw new Error('Additional slots provided for a single-slot service.');
    }

    if (requiredSlotCount > 1 && providedLinkedSlotIds.length !== requiredSlotCount - 1) {
      throw new Error(`This service requires ${requiredSlotCount} consecutive slots.`);
    }

    const linkedSlotIds: string[] = [];
    const linkedSlotTimes: string[] = [];
    let previousSlot = slot;

    for (let index = 0; index < providedLinkedSlotIds.length; index += 1) {
      const linkedSlotId = providedLinkedSlotIds[index];
      const linkedRef = slotsCollection.doc(linkedSlotId);
      const linkedSnap = await transaction.get(linkedRef);
      if (!linkedSnap.exists) throw new Error('The consecutive slot was not found.');
      const linkedSlot = docToSlot(linkedSnap.id, linkedSnap.data()!);

      if (linkedSlot.status !== 'available') {
        throw new Error('The consecutive slot is no longer available.');
      }
      if (linkedSlot.date !== slot.date) {
        throw new Error('Consecutive slots must be on the same day.');
      }
      // Ensure linked slots belong to the same nail tech
      if (linkedSlot.nailTechId !== slot.nailTechId) {
        throw new Error('Consecutive slots must belong to the same nail tech.');
      }
      
      // Check if slots are consecutive in the time sequence
      // We allow skipping over times that don't have slots created
      // The frontend already validated that these are consecutive (no booked slots between them)
      // Here we just verify the linked slot comes after the previous one in the time sequence
      const { SLOT_TIMES } = await import('../constants/slots');
      const previousTime = previousSlot.time.trim();
      const linkedTime = linkedSlot.time.trim();
      
      const previousIndex = SLOT_TIMES.indexOf(previousTime as any);
      const linkedIndex = SLOT_TIMES.indexOf(linkedTime as any);
      
      if (previousIndex === -1) {
        throw new Error(`Previous slot time ${previousTime} is not a valid slot time.`);
      }
      
      if (linkedIndex === -1) {
        throw new Error(`Linked slot time ${linkedTime} is not a valid slot time.`);
      }
      
      if (linkedIndex <= previousIndex) {
        // Linked slot is not after the previous slot - not consecutive
        throw new Error('Selected slots are not consecutive.');
      }
      
      // Verify the linked slot is reachable from the previous slot by following the time sequence
      // (allowing for gaps where slots don't exist at intermediate times)
      // We iterate through times after previousSlot.time and verify linkedTime is encountered
      let currentCheckTime = previousTime;
      let foundLinkedSlot = false;
      
      while (!foundLinkedSlot) {
        const nextTime = getNextSlotTime(currentCheckTime);
        if (!nextTime) {
          // No more times in sequence - linked slot is not reachable
          throw new Error('Selected slots are not consecutive.');
        }
        
        const nextTimeTrimmed = nextTime.trim();
        
        if (nextTimeTrimmed === linkedTime) {
          // Found the linked slot as the next time in sequence - it's consecutive
          foundLinkedSlot = true;
          break;
        }
        
        // Check if we've passed the linked slot time
        const nextIndex = SLOT_TIMES.indexOf(nextTimeTrimmed as any);
        if (nextIndex > linkedIndex) {
          // We've passed the linked slot time - it's not in the correct sequence
          throw new Error('Selected slots are not consecutive.');
        }
        
        // Continue to next time - the linked slot might be at a later time
        // (skipping over times where slots don't exist)
        currentCheckTime = nextTimeTrimmed;
      }
      
      if (slotIsBlocked(linkedSlot, blocks)) {
        throw new Error('One of the consecutive slots is blocked.');
      }

      transaction.update(linkedRef, {
        status: 'pending',
        updatedAt: Timestamp.now().toDate().toISOString(),
      });

      linkedSlotIds.push(linkedSlot.id);
      linkedSlotTimes.push(linkedSlot.time);
      previousSlot = linkedSlot;
    }

    if (linkedSlotTimes.length > 0) {
      finalLinkedSlotTime = linkedSlotTimes[linkedSlotTimes.length - 1];
    }

    transaction.update(slotRef, {
      status: 'pending',
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    const bookingRef = bookingsCollection.doc();
    const clientType = options?.clientType;
    
    // For repeat clients, if we found the customer by email, use their customerId
    // Otherwise, use placeholder that will be updated when form is submitted
    const bookingData: any = {
      slotId,
      bookingId,
      customerId: foundCustomerId || 'PENDING_FORM_SUBMISSION', // Use found customerId if available, otherwise placeholder
      nailTechId: slotNailTechId || '', // Required: get from slot
      serviceType,
      status: 'pending_form' as BookingStatus,
      createdAt: Timestamp.now().toDate().toISOString(),
      updatedAt: Timestamp.now().toDate().toISOString(),
    };
    
    if (linkedSlotIds.length > 0) {
      bookingData.pairedSlotId = linkedSlotIds[0];
      bookingData.linkedSlotIds = linkedSlotIds;
    } else {
      bookingData.pairedSlotId = null;
    }
    
    if (clientType) {
      bookingData.clientType = clientType;
    }
    
    if (options?.serviceLocation) {
      bookingData.serviceLocation = options.serviceLocation;
    }
    
    // Store social media name in customerData for new clients (even if they don't complete the form)
    if (clientType === 'new' && options?.socialMediaName && options.socialMediaName.trim()) {
      bookingData.customerData = {
        'Facebook or Instagram Name': options.socialMediaName.trim(),
        'FB Name': options.socialMediaName.trim(),
        'Social Media Name': options.socialMediaName.trim(),
      };
      bookingData.customerDataOrder = ['Facebook or Instagram Name'];
    }
    
    transaction.set(bookingRef, bookingData);
  });

  // Format date for Google Forms
  // Support multiple formats based on environment variable
  let formattedDate: string | undefined = undefined;
  if (slotDate && formDateEntryKey) {
    const dateFormat = process.env.GOOGLE_FORM_DATE_FORMAT || 'FULL'; // Default to full format: "Friday, November 28, 2025"
    const dateObj = parseISO(slotDate);
    
    switch (dateFormat.toUpperCase()) {
      case 'FULL':
      case 'LONG':
        // Full format: "Friday, November 28, 2025"
        formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy');
        break;
      case 'YYYY-MM-DD':
        // For Google Forms "Date" picker field type (ISO format)
        formattedDate = format(dateObj, 'yyyy-MM-dd');
        break;
      case 'DD/MM/YYYY':
        // For Google Forms "Date" picker with dd/mm/yyyy format
        formattedDate = format(dateObj, 'dd/MM/yyyy');
        break;
      case 'MM/DD/YYYY':
        // For "Short answer" field type (US format)
        formattedDate = format(dateObj, 'MM/dd/yyyy');
        break;
      default:
        // Default to FULL format
        formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy');
        break;
    }
  }

  // Format time for Google Forms (convert 24-hour to 12-hour format)
  // Note: Google Forms time picker fields may not support pre-filling
  // If your form uses a time picker, you may need to use a "Short answer" field instead
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    // Ensure minutes are always 2 digits
    const mins = minutes.padStart(2, '0');
    return `${hour12}:${mins} ${ampm}`;
  };

  let formattedTime: string | undefined = undefined;
  if (slotTime && formTimeEntryKey) {
    if (finalLinkedSlotTime) {
      // For multi-slot bookings, show time range: "10:30 AM - 3:00 PM"
      formattedTime = `${formatTime12Hour(slotTime)} - ${formatTime12Hour(finalLinkedSlotTime)}`;
    } else {
      // For single slot, show single time: "10:30 AM"
      formattedTime = formatTime12Hour(slotTime);
    }
  }

  const prefillFields: Record<string, string> = {
    [formEntryKey]: bookingId,
  };

  if (formDateEntryKey && formattedDate) {
    prefillFields[formDateEntryKey] = formattedDate;
  } else if (slotDate && !formDateEntryKey) {
    console.warn('GOOGLE_FORM_DATE_ENTRY not set - date will not be pre-filled in form');
  }

  if (formTimeEntryKey && formattedTime) {
    prefillFields[formTimeEntryKey] = formattedTime;
  } else if (slotTime && !formTimeEntryKey) {
    console.warn('GOOGLE_FORM_TIME_ENTRY not set - time will not be pre-filled in form');
  }

  // Format service location for Google Forms
  if (formServiceLocationEntryKey && serviceLocation) {
    const formattedServiceLocation = serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio';
    prefillFields[formServiceLocationEntryKey] = formattedServiceLocation;
  } else if (serviceLocation && !formServiceLocationEntryKey) {
    console.warn('GOOGLE_FORM_SERVICE_LOCATION_ENTRY not set - service location will not be pre-filled in form');
  }

  // Add customer data to prefill if found
  if (customerData) {
    console.log('Customer data found for prefill:', {
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      hasPhone: !!customerData.phone,
      phoneEntryKey: formPhoneEntryKey
    });
    
    if (formNameEntryKey && customerData.name) {
      prefillFields[formNameEntryKey] = customerData.name;
    }
    if (formFirstNameEntryKey && customerData.firstName) {
      prefillFields[formFirstNameEntryKey] = customerData.firstName;
    }
    if (formLastNameEntryKey && customerData.lastName) {
      prefillFields[formLastNameEntryKey] = customerData.lastName;
    }
    if (formEmailEntryKey && customerData.email) {
      prefillFields[formEmailEntryKey] = customerData.email;
    }
    if (formPhoneEntryKey && customerData.phone) {
      prefillFields[formPhoneEntryKey] = customerData.phone;
      console.log(`Adding phone to prefill: ${formPhoneEntryKey} = ${customerData.phone}`);
    } else if (customerData.phone && !formPhoneEntryKey) {
      console.warn('Customer has phone number but GOOGLE_FORM_PHONE_ENTRY or GOOGLE_FORM_CONTACT_NUMBER_ENTRY is not set in environment variables');
    } else if (!customerData.phone) {
      console.log('Customer record does not have a phone number');
    }
    if (formSocialMediaEntryKey && customerData.socialMediaName) {
      prefillFields[formSocialMediaEntryKey] = customerData.socialMediaName;
    }
    if (formReferralSourceEntryKey && customerData.referralSource) {
      prefillFields[formReferralSourceEntryKey] = customerData.referralSource;
    }
  }

  // Note: Client type is stored in the booking record, not pre-filled in Google Form
  const googleFormUrl = buildPrefilledGoogleFormUrl(formUrl, prefillFields);
  
  // Debug logging
  console.log('=== Google Form Prefill Debug ===');
  console.log('Prefill fields being added:', Object.keys(prefillFields));
  console.log('Phone entry key:', formPhoneEntryKey ? `Set (${formPhoneEntryKey})` : 'NOT SET - Add GOOGLE_FORM_PHONE_ENTRY or GOOGLE_FORM_CONTACT_NUMBER_ENTRY to .env.local');
  console.log('Date entry key:', formDateEntryKey ? `Set (${formDateEntryKey})` : 'Not set');
  console.log('Time entry key:', formTimeEntryKey ? `Set (${formTimeEntryKey})` : 'Not set');
  if (customerData) {
    console.log('Customer phone number:', customerData.phone || 'NOT FOUND in customer record');
  }
  if (formattedDate) {
    console.log('Formatted date:', formattedDate);
  }
  if (formattedTime) {
    console.log('Formatted time:', formattedTime);
  }
  console.log('All prefill values:', prefillFields);
  console.log('Full prefill URL:', googleFormUrl);

  return { bookingId, googleFormUrl };
}

/**
 * Generate or regenerate the Google Form URL for an existing booking
 * This is useful for recovering/resending form links to clients
 */
export async function getBookingFormUrl(bookingId: string): Promise<string> {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new Error('Booking not found.');
  }

  // Get the slot information
  const slot = await getSlotById(booking.slotId);
  if (!slot) {
    throw new Error('Slot not found for this booking.');
  }

  // Get linked slots if any
  const linkedSlots: Slot[] = [];
  if (booking.linkedSlotIds && booking.linkedSlotIds.length > 0) {
    for (const linkedSlotId of booking.linkedSlotIds) {
      const linkedSlot = await getSlotById(linkedSlotId);
      if (linkedSlot) {
        linkedSlots.push(linkedSlot);
      }
    }
  } else if (booking.pairedSlotId) {
    const pairedSlot = await getSlotById(booking.pairedSlotId);
    if (pairedSlot) {
      linkedSlots.push(pairedSlot);
    }
  }

  // Get customer information
  const customer = await getCustomerById(booking.customerId);

  // Environment variables for Google Form
  const formUrl = process.env.GOOGLE_FORM_BASE_URL;
  if (!formUrl) {
    throw new Error('GOOGLE_FORM_BASE_URL environment variable is not set.');
  }

  const formEntryKey = process.env.GOOGLE_FORM_BOOKING_ID_ENTRY || 'entry.123456789';
  const formDateEntryKey = process.env.GOOGLE_FORM_DATE_ENTRY;
  const formTimeEntryKey = process.env.GOOGLE_FORM_TIME_ENTRY;
  const formServiceLocationEntryKey = process.env.GOOGLE_FORM_SERVICE_LOCATION_ENTRY;
  const formNameEntryKey = process.env.GOOGLE_FORM_NAME_ENTRY;
  const formFirstNameEntryKey = process.env.GOOGLE_FORM_FIRST_NAME_ENTRY;
  const formLastNameEntryKey = process.env.GOOGLE_FORM_LAST_NAME_ENTRY;
  const formEmailEntryKey = process.env.GOOGLE_FORM_EMAIL_ENTRY;
  const formPhoneEntryKey = process.env.GOOGLE_FORM_PHONE_ENTRY || process.env.GOOGLE_FORM_CONTACT_NUMBER_ENTRY;
  const formSocialMediaEntryKey = process.env.GOOGLE_FORM_SOCIAL_MEDIA_ENTRY;
  const formReferralSourceEntryKey = process.env.GOOGLE_FORM_REFERRAL_SOURCE_ENTRY;

  // Format date for Google Forms
  let formattedDate: string | undefined = undefined;
  if (slot.date && formDateEntryKey) {
    const dateFormat = process.env.GOOGLE_FORM_DATE_FORMAT || 'FULL';
    const dateObj = parseISO(slot.date);
    
    switch (dateFormat.toUpperCase()) {
      case 'FULL':
      case 'LONG':
        formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy');
        break;
      case 'YYYY-MM-DD':
        formattedDate = format(dateObj, 'yyyy-MM-dd');
        break;
      case 'DD/MM/YYYY':
        formattedDate = format(dateObj, 'dd/MM/yyyy');
        break;
      case 'MM/DD/YYYY':
        formattedDate = format(dateObj, 'MM/dd/yyyy');
        break;
      default:
        formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy');
        break;
    }
  }

  // Format time for Google Forms
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const mins = minutes.padStart(2, '0');
    return `${hour12}:${mins} ${ampm}`;
  };

  let formattedTime: string | undefined = undefined;
  if (slot.time && formTimeEntryKey) {
    const finalLinkedSlot = linkedSlots.length > 0 ? linkedSlots[linkedSlots.length - 1] : null;
    if (finalLinkedSlot) {
      formattedTime = `${formatTime12Hour(slot.time)} - ${formatTime12Hour(finalLinkedSlot.time)}`;
    } else {
      formattedTime = formatTime12Hour(slot.time);
    }
  }

  // Build prefill fields
  const prefillFields: Record<string, string> = {
    [formEntryKey]: booking.bookingId,
  };

  if (formDateEntryKey && formattedDate) {
    prefillFields[formDateEntryKey] = formattedDate;
  }

  if (formTimeEntryKey && formattedTime) {
    prefillFields[formTimeEntryKey] = formattedTime;
  }

  // Format service location for Google Forms
  if (formServiceLocationEntryKey && booking.serviceLocation) {
    const formattedServiceLocation = booking.serviceLocation === 'home_service' ? 'Home Service' : 'Homebased Studio';
    prefillFields[formServiceLocationEntryKey] = formattedServiceLocation;
  }

  // Add customer data to prefill if available
  if (customer) {
    if (formNameEntryKey && customer.name) {
      prefillFields[formNameEntryKey] = customer.name;
    }
    if (formFirstNameEntryKey && customer.firstName) {
      prefillFields[formFirstNameEntryKey] = customer.firstName;
    }
    if (formLastNameEntryKey && customer.lastName) {
      prefillFields[formLastNameEntryKey] = customer.lastName;
    }
    if (formEmailEntryKey && customer.email) {
      prefillFields[formEmailEntryKey] = customer.email;
    }
    if (formPhoneEntryKey && customer.phone) {
      prefillFields[formPhoneEntryKey] = customer.phone;
    }
    if (formSocialMediaEntryKey && customer.socialMediaName) {
      prefillFields[formSocialMediaEntryKey] = customer.socialMediaName;
    }
    if (formReferralSourceEntryKey && customer.referralSource) {
      prefillFields[formReferralSourceEntryKey] = customer.referralSource;
    }
  }

  // Build the prefilled Google Form URL
  const googleFormUrl = buildPrefilledGoogleFormUrl(formUrl, prefillFields);
  
  return googleFormUrl;
}

/**
 * Recover an expired booking from Google Sheets form data
 * This recreates a booking with a specific booking ID (e.g., GN-00001)
 */
export async function recoverBookingFromForm(
  bookingId: string,
  slotId: string,
  options: CreateBookingOptions,
  formData: Record<string, string>,
  fieldOrder?: string[],
  formResponseId?: string,
) {
  const serviceType = options?.serviceType ?? 'manicure';
  const requiredSlotCount = getRequiredSlotCount(serviceType);
  const providedLinkedSlotIds = options?.linkedSlotIds ?? (options?.pairedSlotId ? [options.pairedSlotId] : []);
  const serviceLocation = options?.serviceLocation ?? 'homebased_studio';
  const blocks = await listBlockedDates();

  let slotNailTechId: string | null = null;

  await adminDb.runTransaction(async (transaction) => {
    const slotRef = slotsCollection.doc(slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists) throw new Error('Slot not found.');
    const slot = docToSlot(slotSnap.id, slotSnap.data()!);
    slotNailTechId = slot.nailTechId; // Store nail tech ID from slot

    // Allow recovering even if slot is pending (it might have been released)
    if (slot.status !== 'available' && slot.status !== 'pending') {
      throw new Error(`Slot is ${slot.status} and cannot be used for recovery.`);
    }

    if (slotIsBlocked(slot, blocks)) {
      throw new Error('Slot is blocked.');
    }

    if (requiredSlotCount === 1 && providedLinkedSlotIds.length > 0) {
      throw new Error('Additional slots provided for a single-slot service.');
    }

    if (requiredSlotCount > 1 && providedLinkedSlotIds.length !== requiredSlotCount - 1) {
      throw new Error(`This service requires ${requiredSlotCount} consecutive slots.`);
    }

    const linkedSlotIds: string[] = [];
    let previousSlot = slot;

    for (let index = 0; index < providedLinkedSlotIds.length; index += 1) {
      const linkedSlotId = providedLinkedSlotIds[index];
      const linkedRef = slotsCollection.doc(linkedSlotId);
      const linkedSnap = await transaction.get(linkedRef);
      if (!linkedSnap.exists) throw new Error('The consecutive slot was not found.');
      const linkedSlot = docToSlot(linkedSnap.id, linkedSnap.data()!);

      if (linkedSlot.status !== 'available' && linkedSlot.status !== 'pending') {
        throw new Error('The consecutive slot is not available for recovery.');
      }
      if (linkedSlot.date !== slot.date) {
        throw new Error('Consecutive slots must be on the same day.');
      }
      // Ensure linked slots belong to the same nail tech
      if (linkedSlot.nailTechId !== slot.nailTechId) {
        throw new Error('Consecutive slots must belong to the same nail tech.');
      }
      const expectedNextTime = getNextSlotTime(previousSlot.time);
      if (!expectedNextTime || linkedSlot.time !== expectedNextTime) {
        throw new Error('Selected slots are not consecutive.');
      }
      if (slotIsBlocked(linkedSlot, blocks)) {
        throw new Error('One of the consecutive slots is blocked.');
      }

      transaction.update(linkedRef, {
        status: 'pending',
        updatedAt: Timestamp.now().toDate().toISOString(),
      });

      linkedSlotIds.push(linkedSlot.id);
      previousSlot = linkedSlot;
    }

    transaction.update(slotRef, {
      status: 'pending',
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    // Find or create customer from form data
    const customer = await findOrCreateCustomer(formData, fieldOrder);
    
    // Determine client type automatically:
    // 1. Use customer's isRepeatClient field if set
    // 2. Otherwise, check if customer has previous bookings (excluding cancelled)
    let determinedClientType: 'new' | 'repeat' | undefined = undefined;
    if (customer.isRepeatClient === true) {
      determinedClientType = 'repeat';
    } else if (customer.isRepeatClient === false) {
      determinedClientType = 'new';
    } else {
      // Check booking history if isRepeatClient is not set
      // Exclude cancelled bookings and the current booking (by bookingId)
      const existingBookings = await bookingsCollection
        .where('customerId', '==', customer.id)
        .get();
      
      // Filter out cancelled bookings and the current booking
      const validPreviousBookings = existingBookings.docs.filter(doc => {
        const data = doc.data();
        return data.status !== 'cancelled' && data.bookingId !== bookingId;
      });
      
      // If customer has any previous non-cancelled bookings, they're a repeat client
      if (validPreviousBookings.length > 0) {
        determinedClientType = 'repeat';
        // Also update customer to mark as repeat client
        await getCustomersCollection().doc(customer.id).set({
          isRepeatClient: true,
          updatedAt: Timestamp.now().toDate().toISOString()
        }, { merge: true });
      } else {
        determinedClientType = 'new';
      }
    }

    const bookingRef = bookingsCollection.doc();
    const bookingData: any = {
      slotId,
      bookingId, // Use the specified booking ID
      customerId: customer.id,
      nailTechId: slotNailTechId || '', // Required: get from slot
      serviceType,
      status: 'pending_payment', // Set directly to pending_payment since form is already submitted
      customerData: formData,
      formResponseId,
      createdAt: Timestamp.now().toDate().toISOString(),
      updatedAt: Timestamp.now().toDate().toISOString(),
    };

    if (linkedSlotIds.length > 0) {
      bookingData.pairedSlotId = linkedSlotIds[0];
      bookingData.linkedSlotIds = linkedSlotIds;
    } else {
      bookingData.pairedSlotId = null;
    }

    // Use determined client type, or fall back to option if provided
    bookingData.clientType = determinedClientType || options?.clientType;

    if (options?.serviceLocation) {
      bookingData.serviceLocation = options.serviceLocation;
    }

    if (fieldOrder && fieldOrder.length > 0) {
      bookingData.customerDataOrder = fieldOrder;
    }

    transaction.set(bookingRef, bookingData);
  });

  // Return the recovered booking
  const bookingSnapshot = await bookingsCollection.where('bookingId', '==', bookingId).limit(1).get();
  if (bookingSnapshot.empty) {
    throw new Error('Failed to retrieve recovered booking.');
  }

  const doc = bookingSnapshot.docs[0];
  const docData = doc.data();
  if (!docData) return null;
  return docToBooking(doc.id, docData);
}

export async function syncBookingWithForm(
  bookingId: string,
  formData: Record<string, string>,
  fieldOrder?: string[],
  formResponseId?: string,
) {
  // OPTIMIZED: Check cache first to reduce Firestore reads
  // This query was called 48,590 times - caching will dramatically reduce reads
  const { bookingCache } = await import('./bookingCache');
  const cached = bookingCache.get(bookingId);
  
  let bookingDoc: admin.firestore.DocumentSnapshot | null = null;
  let booking: Booking | null = null;
  
  if (cached) {
    // Use cached booking - but we still need doc ref for updates
    // Get document reference by querying (unavoidable for updates, but cache reduces reads for lookups)
    const bookingSnapshot = await bookingsCollection.where('bookingId', '==', bookingId).limit(1).get();
    if (bookingSnapshot.empty) return null;
    bookingDoc = bookingSnapshot.docs[0];
    booking = cached; // Use cached booking data
  } else {
    // Not in cache, fetch from Firestore
    const bookingSnapshot = await bookingsCollection.where('bookingId', '==', bookingId).limit(1).get();
    if (bookingSnapshot.empty) return null;
    bookingDoc = bookingSnapshot.docs[0];
    
    // Convert to booking and cache
    const bookingData = bookingDoc.data();
    if (!bookingData) return null;
    booking = docToBooking(bookingDoc.id, bookingData);
    bookingCache.set(bookingId, booking);
  }
  
  if (!bookingDoc || !booking) return null;

  const doc = bookingDoc;
  const docData = doc.data();
  if (formResponseId && docData && docData.formResponseId === formResponseId) {
    return null;
  }

  // Validate date and time if they were submitted
  const formDateEntryKey = process.env.GOOGLE_FORM_DATE_ENTRY;
  const formTimeEntryKey = process.env.GOOGLE_FORM_TIME_ENTRY;
  let dateChanged = false;
  let timeChanged = false;
  const validationWarnings: string[] = [];

  // Booking already loaded from cache or query above
  // Use the booking we already have

  // Validate that we actually have form data before proceeding
  // Check if formData has at least some meaningful content (not all empty values)
  if (!formData || Object.keys(formData).length === 0) {
    console.warn(`syncBookingWithForm: No form data received for booking ${bookingId}. Skipping sync.`);
    return null;
  }
  
  // Check if form data has at least one non-empty value
  const hasValidFormData = Object.values(formData).some(value => 
    value !== null && value !== undefined && String(value).trim().length > 0
  );
  
  if (!hasValidFormData) {
    console.warn(`syncBookingWithForm: Form data for booking ${bookingId} contains only empty values. Skipping sync.`);
    return null;
  }

  // Only proceed with sync if booking is still in pending_form status
  // If it's already pending_payment or confirmed, we should only update customerData, not change status
  // unless there's a specific reason to do so
  if (formDateEntryKey || formTimeEntryKey) {
    // Get the slot information for this booking
    const slotRef = slotsCollection.doc(booking.slotId);
    const slotSnap = await slotRef.get();
    
    if (slotSnap.exists) {
      const slot = docToSlot(slotSnap.id, slotSnap.data()!);
      
      // Check if date was changed
      if (formDateEntryKey && formData[formDateEntryKey]) {
        const submittedDate = formData[formDateEntryKey];
        // Convert submitted date to YYYY-MM-DD format for comparison
        // Handle MM/DD/YYYY format
        const dateMatch = submittedDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
          const [, month, day, year] = dateMatch;
          const formattedSubmittedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          if (formattedSubmittedDate !== slot.date) {
            dateChanged = true;
            validationWarnings.push(`Date changed from ${slot.date} to ${submittedDate}`);
          }
        }
      }

      // Check if time was changed
      if (formTimeEntryKey && formData[formTimeEntryKey]) {
        const submittedTime = formData[formTimeEntryKey];
        // Get expected time format
        const formatTime12Hour = (time24: string): string => {
          const [hours, minutes] = time24.split(':');
          const hour = parseInt(hours, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const hour12 = hour % 12 || 12;
          return `${hour12}:${minutes} ${ampm}`;
        };

        let expectedTime: string;
        const linkedSlotIds = booking.linkedSlotIds?.length
          ? booking.linkedSlotIds
          : booking.pairedSlotId
            ? [booking.pairedSlotId]
            : [];
        if (linkedSlotIds.length > 0) {
          const lastLinkedId = linkedSlotIds[linkedSlotIds.length - 1];
          const linkedSlotRef = slotsCollection.doc(lastLinkedId);
          const linkedSlotSnap = await linkedSlotRef.get();
          if (linkedSlotSnap.exists) {
            const linkedSlot = docToSlot(linkedSlotSnap.id, linkedSlotSnap.data()!);
            expectedTime = `${formatTime12Hour(slot.time)} - ${formatTime12Hour(linkedSlot.time)}`;
          } else {
            expectedTime = formatTime12Hour(slot.time);
          }
        } else {
          expectedTime = formatTime12Hour(slot.time);
        }

        // Normalize times for comparison (remove extra spaces, case insensitive)
        const normalizedSubmitted = submittedTime.trim().replace(/\s+/g, ' ');
        const normalizedExpected = expectedTime.trim().replace(/\s+/g, ' ');
        
        if (normalizedSubmitted.toLowerCase() !== normalizedExpected.toLowerCase()) {
          timeChanged = true;
          validationWarnings.push(`Time changed from "${expectedTime}" to "${submittedTime}"`);
        }
      }
    }
  }

  // Check if booking already has a customerId (e.g., from repeat client booking)
  let customer;
  
  if (booking.customerId && booking.customerId !== 'PENDING_FORM_SUBMISSION') {
    // Booking already linked to a customer (repeat client), use that customer
    customer = await getCustomerById(booking.customerId);
    if (!customer) {
      // Customer not found, fall back to findOrCreateCustomer
      customer = await findOrCreateCustomer(formData);
    }
  } else {
    // No existing customer link, find or create customer from form data
    customer = await findOrCreateCustomer(formData);
  }
  
  // If customer already has an email saved in the system, replace the form email with the saved email
  // This prevents different emails from overwriting the customer's primary email
  if (customer.email) {
    // Find all possible email field keys in the form data
    const emailKeys = Object.keys(formData).filter(key => {
      const lowerKey = key.toLowerCase();
      return lowerKey.includes('email') && formData[key];
    });
    
    // Replace all email fields in formData with the customer's saved email
    // TypeScript: customer.email is already checked in the if condition, but we need to assert it's defined
    const customerEmail = customer.email;
    emailKeys.forEach(key => {
      if (formData[key] !== customerEmail) {
        formData[key] = customerEmail;
      }
    });
  }
  
  // Determine client type automatically:
  // 1. Use customer's isRepeatClient field if set
  // 2. Otherwise, check if customer has previous bookings (excluding cancelled and current)
  let determinedClientType: 'new' | 'repeat' | undefined = undefined;
  if (customer.isRepeatClient === true) {
    determinedClientType = 'repeat';
  } else if (customer.isRepeatClient === false) {
    determinedClientType = 'new';
  } else {
    // Check booking history if isRepeatClient is not set
    const existingBookings = await bookingsCollection
      .where('customerId', '==', customer.id)
      .get();
    
    // Filter out cancelled bookings and the current booking (by bookingId)
    const validPreviousBookings = existingBookings.docs.filter(doc => {
      const data = doc.data();
      return data.status !== 'cancelled' && data.bookingId !== bookingId;
    });
    
    // If customer has any previous non-cancelled bookings, they're a repeat client
    if (validPreviousBookings.length > 0) {
      determinedClientType = 'repeat';
      // Also update customer to mark as repeat client
      await getCustomersCollection().doc(customer.id).set({
        isRepeatClient: true,
        updatedAt: Timestamp.now().toDate().toISOString()
      }, { merge: true });
    } else {
      determinedClientType = 'new';
    }
  }
  
  const updateData: any = {
    customerId: customer.id, // Link booking to customer
    customerData: formData,
    formResponseId,
    clientType: determinedClientType, // Set automatically determined client type
    updatedAt: Timestamp.now().toDate().toISOString(),
  };
  
  // Only change status to 'pending_payment' if booking is currently 'pending_form'
  // This ensures bookings don't incorrectly skip the 'pending_form' stage
  if (booking.status === 'pending_form') {
    updateData.status = 'pending_payment';
  }
  
  // Store field order to preserve exact form order when displaying
  if (fieldOrder && fieldOrder.length > 0) {
    updateData.customerDataOrder = fieldOrder;
  }

  // Only include these fields if they are true (Firestore doesn't allow undefined)
  if (dateChanged) {
    updateData.dateChanged = true;
  }
  if (timeChanged) {
    updateData.timeChanged = true;
  }
  if (validationWarnings.length > 0) {
    updateData.validationWarnings = validationWarnings;
  }

  await doc.ref.set(updateData, { merge: true });

  // Log warning if date/time was changed
  if (validationWarnings.length > 0) {
    console.warn(`Booking ${bookingId} - Date/Time changed:`, validationWarnings);
  }

  const updatedBooking = docToBooking(doc.id, { 
    ...doc.data(), 
    customerData: formData,
    customerDataOrder: fieldOrder && fieldOrder.length > 0 ? fieldOrder : undefined,
    status: 'pending_payment',
    dateChanged,
    timeChanged,
    validationWarnings: validationWarnings.length > 0 ? validationWarnings : undefined,
  });

  // Email functionality disabled
  return updatedBooking;
}

async function getSlotById(slotId: string): Promise<Slot | null> {
  const snapshot = await slotsCollection.doc(slotId).get();
  if (!snapshot.exists) return null;
  return docToSlot(snapshot.id, snapshot.data()!);
}

export async function confirmBooking(bookingId: string, depositAmount?: number, depositPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') {
  let booking: Booking | null = null;
  let slot: Slot | null = null;
  let customerId: string | null = null;

  await adminDb.runTransaction(async (transaction) => {
    // ALL READS MUST HAPPEN FIRST
    const bookingRef = getBookingsCollection().doc(bookingId);
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new Error('Booking not found.');
    booking = docToBooking(bookingSnap.id, bookingSnap.data()!);
    customerId = booking.customerId;

    const slotRef = slotsCollection.doc(booking.slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists) throw new Error('Slot not found.');
    slot = docToSlot(slotSnap.id, slotSnap.data()!);

    // Get linked slot IDs first
    const linkedSlotIds = booking.linkedSlotIds?.length
      ? booking.linkedSlotIds
      : booking.pairedSlotId
        ? [booking.pairedSlotId]
        : [];

    // Read all linked slots BEFORE any writes
    const linkedRefs: FirebaseFirestore.DocumentReference[] = [];
    const linkedSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
    for (const linkedId of linkedSlotIds) {
      const linkedRef = slotsCollection.doc(linkedId);
      linkedRefs.push(linkedRef);
      linkedSnaps.push(await transaction.get(linkedRef));
    }

    // Validate before writes
    if (slot.status === 'blocked') {
      throw new Error('Cannot confirm booking on a blocked slot.');
    }

    const blocks = await listBlockedDates();
    if (slotIsBlocked(slot, blocks)) {
      throw new Error('Cannot confirm booking on a blocked date.');
    }

    // NOW ALL WRITES CAN HAPPEN
    const updateData: any = {
      status: 'confirmed',
      updatedAt: Timestamp.now().toDate().toISOString(),
    };
    
    // Separate booking status and payment status
    // Booking status: confirmed (appointment is confirmed)
    // Payment status: unpaid (no deposit), partial (has deposit), paid (fully paid)
    
    // When confirming with a deposit, record it separately.
    // We intentionally do NOT set paidAmount here.
    // paidAmount is used for payments made AFTER the deposit (e.g. remaining balance).
    if (depositAmount !== undefined && depositAmount !== null && depositAmount > 0) {
      updateData.depositAmount = depositAmount;
      updateData.depositDate = Timestamp.now().toDate().toISOString(); // Track when deposit was paid
      updateData.paymentStatus = 'partial'; // Has deposit = partial payment
      if (depositPaymentMethod !== undefined) {
        updateData.depositPaymentMethod = depositPaymentMethod;
      }
    } else {
      // No deposit = unpaid
      updateData.paymentStatus = 'unpaid';
    }

    transaction.update(bookingRef, updateData);

    transaction.update(slotRef, {
      status: 'confirmed',
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    // Update linked slots
    linkedRefs.forEach((linkedRef, index) => {
      const linkedSnap = linkedSnaps[index];
      if (linkedSnap?.exists) {
        transaction.update(linkedRef, {
          status: 'confirmed',
          updatedAt: Timestamp.now().toDate().toISOString(),
        });
      }
    });
  });

  // Email functionality disabled
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus, releaseSlot: boolean = true) {
  // Get booking and related data before updating (for email notifications)
  const bookingSnap = await getBookingsCollection().doc(bookingId).get();
  const booking = bookingSnap.exists ? docToBooking(bookingSnap.id, bookingSnap.data()!) : null;
  const slot = booking ? await getSlotById(booking.slotId) : null;
  const customer = booking ? await getCustomerById(booking.customerId) : null;

  const updateData: any = {
    status,
    updatedAt: Timestamp.now().toDate().toISOString(),
  };

  // When cancelling a booking with a quote, remove the quote and set total to paid deposit (forfeited)
  if (status === 'cancelled' && booking) {
    const depositAmount = booking.depositAmount || 0;
    
    // Remove the invoice/quote
    updateData.invoice = null;
    
    // If there's a deposit, create a new invoice with total = deposit amount (forfeited)
    if (depositAmount > 0) {
      const now = Timestamp.now().toDate().toISOString();
      updateData.invoice = {
        items: [
          {
            id: 'forfeited-deposit',
            description: 'Forfeited Deposit (Cancelled Booking)',
            unitPrice: depositAmount,
            quantity: 1,
          },
        ],
        total: depositAmount,
        notes: 'Deposit forfeited due to cancellation',
        createdAt: now,
        updatedAt: now,
      };
    }

    // Release slots if requested
    if (releaseSlot) {
      await adminDb.runTransaction(async (transaction) => {
        const bookingRef = getBookingsCollection().doc(bookingId);
        const slotRef = getSlotsCollection().doc(booking.slotId);
        
        // Get linked slot IDs
        const linkedSlotIds = booking.linkedSlotIds || [];
        const linkedRefs = linkedSlotIds.map((id) => slotsCollection.doc(id));
        
        // Fetch all slot docs in one call
        const allSlotSnaps = await transaction.getAll(slotRef, ...linkedRefs);
        const slotSnap = allSlotSnaps[0];
        const linkedSnaps = allSlotSnaps.slice(1);
        
        // Release the main slot
        if (slotSnap.exists) {
          const slotStatus = slotSnap.data()?.status;
          if (slotStatus && slotStatus !== 'available') {
            transaction.update(slotRef, {
              status: 'available',
              updatedAt: Timestamp.now().toDate().toISOString(),
            });
          }
        }
        
        // Release linked slots
        linkedRefs.forEach((ref, index) => {
          const snap = linkedSnaps[index];
          if (snap?.exists) {
            const slotStatus = snap.data()?.status;
            if (slotStatus && slotStatus !== 'available') {
              transaction.update(ref, {
                status: 'available',
                updatedAt: Timestamp.now().toDate().toISOString(),
              });
            }
          }
        });
      });
    }
  }

  await getBookingsCollection().doc(bookingId).set(updateData, { merge: true });

  // Email functionality disabled
}

export async function updateServiceType(bookingId: string, newServiceType: ServiceType): Promise<void> {
  await adminDb.runTransaction(async (transaction) => {
    // ALL READS FIRST
    const bookingRef = getBookingsCollection().doc(bookingId);
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new Error('Booking not found.');
    const booking = docToBooking(bookingSnap.id, bookingSnap.data()!);

    if (booking.serviceType === newServiceType) {
      return; // No change needed
    }

    // Default to 'manicure' if serviceType is undefined
    const currentServiceType = booking.serviceType || 'manicure';
    const currentRequiredSlots = getRequiredSlotCount(currentServiceType);
    const newRequiredSlots = getRequiredSlotCount(newServiceType);

    // Get current slots
    const currentSlotRef = slotsCollection.doc(booking.slotId);
    const currentSlotSnap = await transaction.get(currentSlotRef);
    if (!currentSlotSnap.exists) throw new Error('Current slot not found.');
    const currentSlot = docToSlot(currentSlotSnap.id, currentSlotSnap.data()!);

    const currentLinkedSlotIds = booking.linkedSlotIds?.length
      ? booking.linkedSlotIds
      : booking.pairedSlotId
        ? [booking.pairedSlotId]
        : [];

    // Get all current linked slots
    const currentLinkedRefs: FirebaseFirestore.DocumentReference[] = [];
    const currentLinkedSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
    for (const linkedId of currentLinkedSlotIds) {
      const ref = slotsCollection.doc(linkedId);
      currentLinkedRefs.push(ref);
      currentLinkedSnaps.push(await transaction.get(ref));
    }

    const blocks = await listBlockedDates();
    const { SLOT_TIMES } = await import('../constants/slots');
    const getNextSlotTime = (await import('../constants/slots')).getNextSlotTime;

    // NOW ALL WRITES
    if (newRequiredSlots > currentRequiredSlots) {
      // Need more slots - find consecutive available slots
      const slotsNeeded = newRequiredSlots - currentRequiredSlots;
      const lastSlot = currentLinkedSlotIds.length > 0
        ? docToSlot(currentLinkedSnaps[currentLinkedSnaps.length - 1].id, currentLinkedSnaps[currentLinkedSnaps.length - 1].data()!)
        : currentSlot;

      const newLinkedSlotIds: string[] = [];
      const newLinkedRefs: FirebaseFirestore.DocumentReference[] = [];
      let previousSlot = lastSlot;

      for (let i = 0; i < slotsNeeded; i++) {
        // Find next available consecutive slot
        let foundSlot = false;
        let currentCheckTime = previousSlot.time.trim();
        const currentCheckDate = previousSlot.date;

        let attempts = 0;
        const maxAttempts = 50; // Increased to allow skipping over more slots
        
        while (!foundSlot && attempts < maxAttempts) {
          attempts++;
          const nextTime = getNextSlotTime(currentCheckTime);
          if (!nextTime) {
            throw new Error(`Cannot find ${slotsNeeded} consecutive available slot(s) after the current booking. The service requires more slots than are available in the schedule.`);
          }

          // Query for slot at this time and date
          const slotQuery = slotsCollection
            .where('date', '==', currentCheckDate)
            .where('time', '==', nextTime.trim())
            .where('nailTechId', '==', currentSlot.nailTechId)
            .limit(1);

          const slotDocs = await transaction.get(slotQuery);
          
          if (!slotDocs.empty) {
            const slotDoc = slotDocs.docs[0];
            const slot = docToSlot(slotDoc.id, slotDoc.data());
            
            if (slot.status === 'available' && !slotIsBlocked(slot, blocks)) {
              // Found available slot
              const slotRef = slotsCollection.doc(slot.id);
              transaction.update(slotRef, {
                status: booking.status === 'confirmed' ? 'confirmed' : 'pending',
                updatedAt: Timestamp.now().toDate().toISOString(),
              });
              
              newLinkedSlotIds.push(slot.id);
              newLinkedRefs.push(slotRef);
              previousSlot = slot;
              foundSlot = true;
            } else {
              // Slot exists but is not available (booked/blocked) - this breaks consecutiveness
              const formattedDate = format(parseISO(currentCheckDate), 'MMM d, yyyy');
              throw new Error(`Cannot change service type: Slot at ${nextTime} on ${formattedDate} is already booked or blocked. Slots must be consecutive with no bookings in between.`);
            }
          } else {
            // Slot doesn't exist at this time - continue to next time
            currentCheckTime = nextTime.trim();
            continue;
          }
        }
        
        if (!foundSlot) {
          throw new Error(`Cannot find ${slotsNeeded} consecutive available slot(s) after the current booking. Please ensure there are enough available slots in the schedule.`);
        }
      }

      // Update booking with new linked slots
      const allLinkedSlotIds = [...currentLinkedSlotIds, ...newLinkedSlotIds];
      transaction.update(bookingRef, {
        serviceType: newServiceType,
        linkedSlotIds: allLinkedSlotIds,
        pairedSlotId: allLinkedSlotIds.length > 0 ? allLinkedSlotIds[0] : null,
        updatedAt: Timestamp.now().toDate().toISOString(),
      });
    } else if (newRequiredSlots < currentRequiredSlots) {
      // Need fewer slots - release extra slots
      const slotsToRelease = currentRequiredSlots - newRequiredSlots;
      const slotsToKeep = currentLinkedSlotIds.slice(0, currentLinkedSlotIds.length - slotsToRelease);
      const slotsToReleaseIds = currentLinkedSlotIds.slice(-slotsToRelease);

      // Release the extra slots
      for (const slotId of slotsToReleaseIds) {
        const slotRef = slotsCollection.doc(slotId);
        const slotSnap = await transaction.get(slotRef);
        if (slotSnap.exists) {
          const slotData = slotSnap.data()!;
          if (slotData.status === 'pending' || slotData.status === 'confirmed') {
            transaction.update(slotRef, {
              status: 'available',
              updatedAt: Timestamp.now().toDate().toISOString(),
            });
          }
        }
      }

      // Update booking
      const updateData: any = {
        serviceType: newServiceType,
        updatedAt: Timestamp.now().toDate().toISOString(),
      };

      if (slotsToKeep.length > 0) {
        updateData.linkedSlotIds = slotsToKeep;
        updateData.pairedSlotId = slotsToKeep[0];
      } else {
        updateData.linkedSlotIds = [];
        updateData.pairedSlotId = null;
      }

      transaction.update(bookingRef, updateData);
    } else {
      // Same number of slots required - just update service type
      transaction.update(bookingRef, {
        serviceType: newServiceType,
        updatedAt: Timestamp.now().toDate().toISOString(),
      });
    }
  });
}

export async function saveInvoice(bookingId: string, invoice: Invoice) {
  // Optimize: Use update() instead of set() with merge for better performance
  // Also, we'll read the booking in parallel with preparing the update data
  const bookingRef = getBookingsCollection().doc(bookingId);
  
  // Prepare base update data first (doesn't depend on current booking)
  const baseUpdateData: any = {
    invoice: {
      ...invoice,
      createdAt: invoice.createdAt || Timestamp.now().toDate().toISOString(),
      updatedAt: Timestamp.now().toDate().toISOString(),
    },
    updatedAt: Timestamp.now().toDate().toISOString(),
  };
  
  // Get current booking to preserve status if already confirmed
  // This read is necessary for payment status logic, but we optimize by using update() instead of set()
  const bookingSnap = await bookingRef.get();
  const currentBooking = bookingSnap.exists ? docToBooking(bookingSnap.id, bookingSnap.data()!) : null;
  
  const updateData = { ...baseUpdateData };
  
  // Separate booking status and payment status
  // Booking status: pending_form, pending_payment, confirmed, cancelled
  // Payment status: unpaid (no deposit), partial (has deposit), paid (fully paid)
  
  // Only update booking status if booking is not already confirmed
  // If booking is confirmed (with or without deposit), keep it as confirmed
  if (currentBooking?.status !== 'confirmed') {
    updateData.status = 'pending_payment';
  }
  
  // Always set payment status based on deposit amount OR paid amount (separate from booking status)
  // unpaid: no deposit/paid amount, partial: has deposit or paid amount, paid: fully paid (set via updatePaymentStatus)
  const hasDeposit = currentBooking?.depositAmount && currentBooking.depositAmount > 0;
  const hasPaidAmount = currentBooking?.paidAmount && currentBooking.paidAmount > 0;
  const hasPayment = hasDeposit || hasPaidAmount;
  const isFullyPaid = currentBooking?.paymentStatus === 'paid';
  
  if (isFullyPaid) {
    // Preserve paid status if already fully paid
    updateData.paymentStatus = 'paid';
  } else if (hasPayment) {
    // Has deposit or paid amount but not fully paid = partial
    updateData.paymentStatus = 'partial';
  } else {
    // No deposit or paid amount = unpaid
    updateData.paymentStatus = 'unpaid';
  }
  
  // IMPORTANT: Do NOT set or preserve paidAmount when saving invoice
  // paidAmount should only be set via updatePaymentStatus when actual payment is received
  // If there's an incorrect paidAmount, we need to clear it unless it was explicitly set via payment status update
  // Only preserve paidAmount if it was set through proper payment tracking (has paidDate)
  if (!currentBooking?.paidDate) {
    // If there's no paidDate, it means paidAmount was incorrectly set, so clear it
    updateData.paidAmount = null;
  }
  // Otherwise, preserve existing paidAmount (it was set through proper payment tracking)
  
  // Use update() instead of set() with merge - this is faster and more efficient
  await bookingRef.update(updateData);

  // Email functionality disabled
}

export async function updatePaymentStatus(bookingId: string, paymentStatus: PaymentStatus, paidAmount?: number, tipAmount?: number, paidPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') {
  const now = Timestamp.now().toDate().toISOString();
  const updateData: any = {
    paymentStatus,
    updatedAt: now,
  };
  
  // Separate booking status and payment status
  // Payment status: unpaid, partial, paid, refunded
  // Booking status: pending_form, pending_payment, confirmed, cancelled
  // When payment is fully paid, we can optionally update booking status to confirmed
  // But payment status and booking status are independent
  if (paymentStatus === 'paid') {
    // Optionally set booking status to confirmed when fully paid
    // But keep them separate - booking status can be confirmed even if payment is partial
    updateData.status = 'confirmed';
  }
  
  if (paidAmount !== undefined) {
    updateData.paidAmount = paidAmount;
    // Track when payment was made (if it's a new payment or increased payment)
    // Always update paidDate when paidAmount is provided
    updateData.paidDate = now;
  }
  if (paidPaymentMethod !== undefined) {
    updateData.paidPaymentMethod = paidPaymentMethod;
  }
  if (tipAmount !== undefined && tipAmount > 0) {
    updateData.tipAmount = tipAmount;
    // Track when tip was received
    updateData.tipDate = now;
  }
  
  // Use update() instead of set() with merge - this is faster and more efficient
  await getBookingsCollection().doc(bookingId).update(updateData);
}

export async function updateDepositAmount(bookingId: string, depositAmount: number, depositPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') {
  const bookingRef = getBookingsCollection().doc(bookingId);
  const bookingSnap = await bookingRef.get();
  const currentBooking = bookingSnap.exists ? docToBooking(bookingSnap.id, bookingSnap.data()!) : null;
  
  const now = Timestamp.now().toDate().toISOString();
  const updateData: any = {
    depositAmount,
    updatedAt: now,
  };
  
  // Separate booking status and payment status
  // Payment status: unpaid (no deposit), partial (has deposit), paid (fully paid)
  if (depositAmount > 0) {
    updateData.depositDate = now; // Track when deposit was paid
    updateData.paymentStatus = 'partial'; // Has deposit = partial payment
    if (depositPaymentMethod !== undefined) {
      updateData.depositPaymentMethod = depositPaymentMethod;
    }
  } else {
    // Deposit removed or set to 0 = unpaid (unless already fully paid)
    if (currentBooking?.paymentStatus !== 'paid') {
      updateData.paymentStatus = 'unpaid';
    }
    // Clear deposit-related fields if deposit is removed
    updateData.depositDate = null;
    updateData.depositPaymentMethod = null;
  }
  
  // If booking is pending_payment and has no invoice yet, update status to confirmed when deposit is added
  // This handles cases where deposit is added separately from the confirmation flow
  // Note: Booking status is separate from payment status
  if (currentBooking?.status === 'pending_payment' && !currentBooking.invoice && depositAmount > 0) {
    updateData.status = 'confirmed';
  }
  
  await bookingRef.set(updateData, { merge: true });
}

export async function rescheduleBooking(bookingId: string, newSlotId: string, linkedSlotIds?: string[]) {
  await adminDb.runTransaction(async (transaction) => {
    // ALL READS FIRST
    const bookingRef = getBookingsCollection().doc(bookingId);
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new Error('Booking not found.');
    const booking = docToBooking(bookingSnap.id, bookingSnap.data()!);

    // Get old slots
    const oldSlotRef = slotsCollection.doc(booking.slotId);
    const oldSlotSnap = await transaction.get(oldSlotRef);
    if (!oldSlotSnap.exists) throw new Error('Old slot not found.');

    const oldLinkedSlotIds = booking.linkedSlotIds?.length
      ? booking.linkedSlotIds
      : booking.pairedSlotId
        ? [booking.pairedSlotId]
        : [];

    const oldLinkedRefs: FirebaseFirestore.DocumentReference[] = [];
    const oldLinkedSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
    for (const linkedId of oldLinkedSlotIds) {
      const ref = slotsCollection.doc(linkedId);
      oldLinkedRefs.push(ref);
      oldLinkedSnaps.push(await transaction.get(ref));
    }

    // Get new slots
    const newSlotRef = slotsCollection.doc(newSlotId);
    const newSlotSnap = await transaction.get(newSlotRef);
    if (!newSlotSnap.exists) throw new Error('New slot not found.');
    const newSlot = docToSlot(newSlotSnap.id, newSlotSnap.data()!);

    if (newSlot.status !== 'available') {
      throw new Error('New slot is not available.');
    }

    const newLinkedRefs: FirebaseFirestore.DocumentReference[] = [];
    const newLinkedSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
    if (linkedSlotIds && linkedSlotIds.length > 0) {
      for (const linkedId of linkedSlotIds) {
        const ref = slotsCollection.doc(linkedId);
        newLinkedRefs.push(ref);
        const snap = await transaction.get(ref);
        if (!snap.exists) throw new Error(`Linked slot ${linkedId} not found.`);
        if (snap.data()?.status !== 'available') {
          throw new Error(`Linked slot ${linkedId} is not available.`);
        }
        newLinkedSnaps.push(snap);
      }
    }

    // NOW ALL WRITES
    // Release old slots
    transaction.update(oldSlotRef, {
      status: 'available',
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    oldLinkedRefs.forEach((ref) => {
      transaction.update(ref, {
        status: 'available',
        updatedAt: Timestamp.now().toDate().toISOString(),
      });
    });

    // Reserve new slots
    transaction.update(newSlotRef, {
      status: booking.status === 'confirmed' ? 'confirmed' : 'pending',
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    newLinkedRefs.forEach((ref) => {
      transaction.update(ref, {
        status: booking.status === 'confirmed' ? 'confirmed' : 'pending',
        updatedAt: Timestamp.now().toDate().toISOString(),
      });
    });

    // Update booking
    // Update nailTechId from the new slot
    const updateData: any = {
      slotId: newSlotId,
      nailTechId: newSlot.nailTechId, // Update nail tech from the new slot
      updatedAt: Timestamp.now().toDate().toISOString(),
    };

    if (linkedSlotIds && linkedSlotIds.length > 0) {
      updateData.pairedSlotId = linkedSlotIds[0];
      updateData.linkedSlotIds = linkedSlotIds;
    } else {
      updateData.pairedSlotId = null;
      updateData.linkedSlotIds = [];
    }

    // Preserve payment-related fields - don't overwrite them during reschedule
    // Payment status, amounts, dates, and methods should remain unchanged
    // unless explicitly updated elsewhere

    transaction.update(bookingRef, updateData);
  });
}

/**
 * Split reschedule a mani_pedi booking into 2 separate bookings
 * Creates 2 new bookings (one for Mani, one for Pedi) with separate slots and invoices
 * Cancels the original booking
 */
export async function splitRescheduleBooking(
  bookingId: string,
  slot1Id: string,
  slot2Id: string,
  nailTech1Id: string,
  nailTech2Id: string
) {
  // Get original booking first (outside transaction for validation)
  const booking = await getBookingById(bookingId);
  if (!booking) throw new Error('Booking not found.');

  // Only allow split for mani_pedi bookings
  if (booking.serviceType !== 'mani_pedi' && (!booking.linkedSlotIds || booking.linkedSlotIds.length === 0)) {
    throw new Error('This booking cannot be split. Only Mani + Pedi bookings can be split.');
  }

  // Generate new booking IDs before transaction
  const nextNumber1 = await getNextBookingNumber();
  const bookingId1 = `GN-${nextNumber1.toString().padStart(5, '0')}`;
  const nextNumber2 = nextNumber1 + 1;
  const bookingId2 = `GN-${nextNumber2.toString().padStart(5, '0')}`;

  await adminDb.runTransaction(async (transaction) => {
    // Get original booking
    const bookingRef = getBookingsCollection().doc(bookingId);
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new Error('Booking not found.');

    // Get new slots
    const slot1Ref = slotsCollection.doc(slot1Id);
    const slot2Ref = slotsCollection.doc(slot2Id);
    const slot1Snap = await transaction.get(slot1Ref);
    const slot2Snap = await transaction.get(slot2Ref);

    if (!slot1Snap.exists) throw new Error('Slot 1 not found.');
    if (!slot2Snap.exists) throw new Error('Slot 2 not found.');

    const slot1 = docToSlot(slot1Snap.id, slot1Snap.data()!);
    const slot2 = docToSlot(slot2Snap.id, slot2Snap.data()!);

    if (slot1.status !== 'available') throw new Error('Slot 1 is not available.');
    if (slot2.status !== 'available') throw new Error('Slot 2 is not available.');

    // Verify nail techs match slots
    if (slot1.nailTechId !== nailTech1Id) throw new Error('Slot 1 nail tech mismatch.');
    if (slot2.nailTechId !== nailTech2Id) throw new Error('Slot 2 nail tech mismatch.');

    // Get old slots to release
    const oldSlotRef = slotsCollection.doc(booking.slotId);
    const oldSlotSnap = await transaction.get(oldSlotRef);
    if (!oldSlotSnap.exists) throw new Error('Old slot not found.');

    const oldLinkedSlotIds = booking.linkedSlotIds?.length
      ? booking.linkedSlotIds
      : booking.pairedSlotId
        ? [booking.pairedSlotId]
        : [];

    const oldLinkedRefs: FirebaseFirestore.DocumentReference[] = [];
    for (const linkedId of oldLinkedSlotIds) {
      oldLinkedRefs.push(slotsCollection.doc(linkedId));
    }

    // Split invoice if exists
    let invoice1: Invoice | undefined;
    let invoice2: Invoice | undefined;
    if (booking.invoice) {
      // Split invoice items proportionally
      // For simplicity, split total in half, but you could split by item
      const total = booking.invoice.total;
      const halfTotal = Math.round(total / 2);
      
      // Create separate invoices for each service
      invoice1 = {
        items: [
          {
            id: '1',
            description: 'Manicure',
            unitPrice: halfTotal,
            quantity: 1,
          },
        ],
        total: halfTotal,
        notes: booking.invoice.notes ? `Split from ${booking.bookingId} - ${booking.invoice.notes}` : `Split from ${booking.bookingId}`,
        createdAt: Timestamp.now().toDate().toISOString(),
        updatedAt: Timestamp.now().toDate().toISOString(),
      };

      invoice2 = {
        items: [
          {
            id: '1',
            description: 'Pedicure',
            unitPrice: total - halfTotal,
            quantity: 1,
          },
        ],
        total: total - halfTotal,
        notes: booking.invoice.notes ? `Split from ${booking.bookingId} - ${booking.invoice.notes}` : `Split from ${booking.bookingId}`,
        createdAt: Timestamp.now().toDate().toISOString(),
        updatedAt: Timestamp.now().toDate().toISOString(),
      };
    }

    // Split deposit and payment if exists
    const depositAmount = booking.depositAmount || 0;
    const paidAmount = booking.paidAmount || 0;
    const halfDeposit = Math.round(depositAmount / 2);
    const halfPaid = Math.round(paidAmount / 2);

    const now = Timestamp.now().toDate().toISOString();

    // Create booking 1 (Manicure)
    const booking1Data: any = {
      slotId: slot1Id,
      bookingId: bookingId1,
      customerId: booking.customerId,
      nailTechId: nailTech1Id,
      status: booking.status,
      serviceType: 'manicure',
      clientType: booking.clientType,
      serviceLocation: booking.serviceLocation,
      customerData: booking.customerData,
      customerDataOrder: booking.customerDataOrder,
      paymentStatus: booking.paymentStatus,
      paidAmount: halfPaid,
      depositAmount: halfDeposit,
      createdAt: now,
      updatedAt: now,
    };

    // Only include optional fields if they exist
    if (invoice1) booking1Data.invoice = invoice1;
    if (booking.assistantName) booking1Data.assistantName = booking.assistantName;
    if (booking.assistantCommissionRate !== undefined) booking1Data.assistantCommissionRate = booking.assistantCommissionRate;
    if (booking.formResponseId) booking1Data.formResponseId = booking.formResponseId;
    if (booking.tipAmount) booking1Data.tipAmount = Math.round((booking.tipAmount || 0) / 2);
    if (booking.depositDate) booking1Data.depositDate = booking.depositDate;
    if (booking.paidDate) booking1Data.paidDate = booking.paidDate;
    if (booking.tipDate) booking1Data.tipDate = booking.tipDate;
    if (booking.depositPaymentMethod) booking1Data.depositPaymentMethod = booking.depositPaymentMethod;
    if (booking.paidPaymentMethod) booking1Data.paidPaymentMethod = booking.paidPaymentMethod;

    const booking1Ref = getBookingsCollection().doc();
    transaction.set(booking1Ref, booking1Data);

    // Create booking 2 (Pedicure)
    const booking2Data: any = {
      slotId: slot2Id,
      bookingId: bookingId2,
      customerId: booking.customerId,
      nailTechId: nailTech2Id,
      status: booking.status,
      serviceType: 'pedicure',
      clientType: booking.clientType,
      serviceLocation: booking.serviceLocation,
      customerData: booking.customerData,
      customerDataOrder: booking.customerDataOrder,
      paymentStatus: booking.paymentStatus,
      paidAmount: paidAmount - halfPaid,
      depositAmount: depositAmount - halfDeposit,
      createdAt: now,
      updatedAt: now,
    };

    // Only include optional fields if they exist
    if (invoice2) booking2Data.invoice = invoice2;
    if (booking.assistantName) booking2Data.assistantName = booking.assistantName;
    if (booking.assistantCommissionRate !== undefined) booking2Data.assistantCommissionRate = booking.assistantCommissionRate;
    if (booking.formResponseId) booking2Data.formResponseId = booking.formResponseId;
    if (booking.tipAmount) booking2Data.tipAmount = (booking.tipAmount || 0) - Math.round((booking.tipAmount || 0) / 2);
    if (booking.depositDate) booking2Data.depositDate = booking.depositDate;
    if (booking.paidDate) booking2Data.paidDate = booking.paidDate;
    if (booking.tipDate) booking2Data.tipDate = booking.tipDate;
    if (booking.depositPaymentMethod) booking2Data.depositPaymentMethod = booking.depositPaymentMethod;
    if (booking.paidPaymentMethod) booking2Data.paidPaymentMethod = booking.paidPaymentMethod;

    const booking2Ref = getBookingsCollection().doc();
    transaction.set(booking2Ref, booking2Data);

    // Release old slots
    transaction.update(oldSlotRef, {
      status: 'available',
      updatedAt: now,
    });

    oldLinkedRefs.forEach((ref) => {
      transaction.update(ref, {
        status: 'available',
        updatedAt: now,
      });
    });

    // Reserve new slots
    transaction.update(slot1Ref, {
      status: booking.status === 'confirmed' ? 'confirmed' : 'pending',
      updatedAt: now,
    });

    transaction.update(slot2Ref, {
      status: booking.status === 'confirmed' ? 'confirmed' : 'pending',
      updatedAt: now,
    });

    // Cancel original booking
    transaction.update(bookingRef, {
      status: 'cancelled',
      updatedAt: now,
    });
  });
}

/**
 * Get bookings eligible for manual release
 * Returns bookings that are:
 * - Still in 'pending_form' or 'pending_payment' status
 * - If pending_form: no form has been synced (no formResponseId)
 */
export async function getEligibleBookingsForRelease() {
  const snapshot = await getBookingsCollection()
    .where('status', 'in', ['pending_form', 'pending_payment'])
    .get();

  const eligibleBookings: Booking[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    
    // Only include pending_form bookings that haven't been synced with a form yet
    // If formResponseId exists, it means a form was received and synced
    if (data.status === 'pending_form' && data.formResponseId) continue;

    eligibleBookings.push(docToBooking(docSnap.id, data));
  }

  return eligibleBookings;
}

/**
 * Manually release selected pending bookings
 * This releases slots back to available status and deletes the booking records
 */
export async function manuallyReleaseBookings(bookingIds: string[]) {
  if (!bookingIds || bookingIds.length === 0) {
    return { released: 0 };
  }

  let releasedCount = 0;

  await Promise.all(
    bookingIds.map(async (bookingId) => {
      try {
        const bookingRef = getBookingsCollection().doc(bookingId);
        const bookingSnap = await bookingRef.get();
        
        if (!bookingSnap.exists) {
          console.warn(`Booking ${bookingId} not found, skipping release`);
          return;
        }
        const data = bookingSnap.data()!;
        
        // Only release bookings that are still pending (form or payment)
        if (data.status !== 'pending_form' && data.status !== 'pending_payment') {
          console.warn(`Booking ${bookingId} is not pending (${data.status}), skipping release`);
          return;
        }

        await adminDb.runTransaction(async (transaction) => {
          const slotRef = slotsCollection.doc(data.slotId);
          const linkedSlotIds: string[] = Array.isArray(data.linkedSlotIds)
            ? data.linkedSlotIds
            : data.pairedSlotId
              ? [data.pairedSlotId]
              : [];
          const linkedRefs: FirebaseFirestore.DocumentReference[] = linkedSlotIds.map((id) =>
            slotsCollection.doc(id),
          );

          // PERF: fetch all slot docs in one call inside the transaction
          const allSlotSnaps = await transaction.getAll(slotRef, ...linkedRefs);
          const slotSnap = allSlotSnaps[0];
          const linkedSnaps = allSlotSnaps.slice(1);

          transaction.delete(bookingRef);

          // Release the main slot - update to available if it exists and is not already available
          // This works for all nail techs regardless of which one the slot belongs to
          if (slotSnap.exists) {
            const slotStatus = slotSnap.data()?.status;
            // Release slot if it's not already available (could be pending, confirmed, blocked, etc.)
            if (slotStatus && slotStatus !== 'available') {
              transaction.update(slotRef, {
                status: 'available',
                updatedAt: Timestamp.now().toDate().toISOString(),
              });
            }
          }

          // Release linked slots - update to available if they exist and are not already available
          linkedRefs.forEach((ref, index) => {
            const snap = linkedSnaps[index];
            if (snap?.exists) {
              const slotStatus = snap.data()?.status;
              // Release slot if it's not already available
              if (slotStatus && slotStatus !== 'available') {
                transaction.update(ref, {
                  status: 'available',
                  updatedAt: Timestamp.now().toDate().toISOString(),
                });
              }
            }
          });
        });

        releasedCount += 1;
      } catch (error) {
        console.error(`Failed to release booking ${bookingId}:`, error);
      }
    }),
  );

  return { released: releasedCount };
}

// Keep the old function for backward compatibility but mark as deprecated
export async function releaseExpiredPendingBookings(maxAgeMinutes = 30) {
  // This function is deprecated - use manuallyReleaseBookings instead
  // Keeping it for backward compatibility but it won't be called automatically
  const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
  const snapshot = await getBookingsCollection().where('status', '==', 'pending_form').get();

  await Promise.all(
    snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      if (!data.createdAt) return;
      const createdAt = new Date(data.createdAt).getTime();
      if (Number.isNaN(createdAt) || createdAt >= cutoff) return;

      await adminDb.runTransaction(async (transaction) => {
        const bookingRef = getBookingsCollection().doc(docSnap.id);
        const slotRef = getSlotsCollection().doc(data.slotId);
        const slotSnap = await transaction.get(slotRef);

        const linkedSlotIds: string[] = Array.isArray(data.linkedSlotIds)
          ? data.linkedSlotIds
          : data.pairedSlotId
            ? [data.pairedSlotId]
            : [];
        const linkedRefs: FirebaseFirestore.DocumentReference[] = [];
        const linkedSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
        for (const linkedId of linkedSlotIds) {
          const ref = slotsCollection.doc(linkedId);
          linkedRefs.push(ref);
          linkedSnaps.push(await transaction.get(ref));
        }

        transaction.delete(bookingRef);

        if (slotSnap.exists && slotSnap.data()?.status === 'pending') {
          transaction.update(slotRef, {
            status: 'available',
            updatedAt: Timestamp.now().toDate().toISOString(),
          });
        }
        linkedRefs.forEach((ref, index) => {
          const snap = linkedSnaps[index];
          if (snap?.exists && snap.data()?.status === 'pending') {
            transaction.update(ref, {
              status: 'available',
              updatedAt: Timestamp.now().toDate().toISOString(),
            });
          }
        });
      });
    }),
  );
}

function docToBooking(id: string, data: FirebaseFirestore.DocumentData): Booking {
  // Backward compatibility: if customerId doesn't exist, use placeholder
  // Migration script will handle creating customers for old bookings
  let customerId = data.customerId;
  if (!customerId) {
    customerId = 'MIGRATION_NEEDED';
  }
  
  return {
    id,
    slotId: data.slotId,
    pairedSlotId: data.pairedSlotId ?? null,
    linkedSlotIds: data.linkedSlotIds ?? undefined,
    bookingId: data.bookingId,
    customerId: customerId, // Required field
    nailTechId: data.nailTechId || '', // Required field - should be set before calling this function
    status: data.status,
    serviceType: data.serviceType,
    clientType: data.clientType,
    serviceLocation: data.serviceLocation,
    assistantName: data.assistantName ?? undefined,
    assistantCommissionRate: data.assistantCommissionRate ?? undefined,
    customerData: data.customerData ?? undefined,
    customerDataOrder: data.customerDataOrder ?? undefined,
    formResponseId: data.formResponseId,
    dateChanged: data.dateChanged,
    timeChanged: data.timeChanged,
    validationWarnings: data.validationWarnings,
    invoice: data.invoice ?? undefined,
    paymentStatus: data.paymentStatus ?? undefined,
    paidAmount: data.paidAmount ?? undefined,
    depositAmount: data.depositAmount ?? undefined,
    tipAmount: data.tipAmount ?? undefined,
    depositDate: data.depositDate ?? undefined,
    paidDate: data.paidDate ?? undefined,
    tipDate: data.tipDate ?? undefined,
    depositPaymentMethod: data.depositPaymentMethod ?? undefined,
    paidPaymentMethod: data.paidPaymentMethod ?? undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function docToSlot(id: string, data: FirebaseFirestore.DocumentData): Slot {
  return {
    id,
    date: data.date,
    time: data.time,
    status: data.status,
    slotType: data.slotType ?? null,
    notes: data.notes ?? null,
    nailTechId: data.nailTechId || '', // Will be set by migration or default
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

