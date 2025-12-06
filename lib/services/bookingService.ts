import { Timestamp } from 'firebase-admin/firestore';
import { format, parseISO } from 'date-fns';
import { adminDb } from '../firebaseAdmin';
import { Booking, BookingStatus, ServiceType, Slot, Invoice, PaymentStatus } from '../types';
import { listBlockedDates } from './blockService';
import { slotIsBlocked } from '../scheduling';
import { buildPrefilledGoogleFormUrl } from '../googleForms';
import { getNextSlotTime } from '../constants/slots';
import { findOrCreateCustomer, getCustomerById, getCustomerByEmail, getCustomerByPhone } from './customerService';
// Email functionality disabled - imports removed

const bookingsCollection = adminDb.collection('bookings');
const slotsCollection = adminDb.collection('slots');
const customersCollection = adminDb.collection('customers');

export async function listBookings(): Promise<Booking[]> {
  const snapshot = await bookingsCollection.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => docToBooking(doc.id, doc.data()));
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const snapshot = await bookingsCollection.doc(id).get();
  if (!snapshot.exists) return null;
  return docToBooking(snapshot.id, snapshot.data()!);
}

type CreateBookingOptions = {
  serviceType?: ServiceType;
  pairedSlotId?: string | null;
  linkedSlotIds?: string[] | null;
  clientType?: 'new' | 'repeat';
  repeatClientEmail?: string; // Email for repeat clients to lookup and prefill
  serviceLocation?: 'homebased_studio' | 'home_service';
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
 */
async function getNextBookingNumber(): Promise<number> {
  const snapshot = await bookingsCollection.get();
  let maxNumber = 0;

  snapshot.docs.forEach((doc) => {
    const bookingId = doc.data().bookingId;
    if (bookingId && bookingId.startsWith('GN-')) {
      // Extract number from booking ID
      const numberPart = bookingId.substring(3); // Remove "GN-"
      
      // Only consider sequential IDs (1-6 digits max)
      // This excludes old timestamp-based IDs (13+ digits) like GN-1234567890123
      // Sequential IDs will be like GN-00001, GN-00002, etc. (5 digits padded)
      if (/^\d{1,6}$/.test(numberPart)) {
        const number = parseInt(numberPart, 10);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    }
  });

  return maxNumber + 1;
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

  await adminDb.runTransaction(async (transaction) => {
    const slotRef = slotsCollection.doc(slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists) throw new Error('Slot not found.');
    const slot = docToSlot(slotSnap.id, slotSnap.data()!);
    slotDate = slot.date; // Store date for use after transaction
    slotTime = slot.time; // Store time for use after transaction

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

  await adminDb.runTransaction(async (transaction) => {
    const slotRef = slotsCollection.doc(slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists) throw new Error('Slot not found.');
    const slot = docToSlot(slotSnap.id, slotSnap.data()!);

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
        await customersCollection.doc(customer.id).set({
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
  return docToBooking(doc.id, doc.data());
}

export async function syncBookingWithForm(
  bookingId: string,
  formData: Record<string, string>,
  fieldOrder?: string[],
  formResponseId?: string,
) {
  const bookingSnapshot = await bookingsCollection.where('bookingId', '==', bookingId).limit(1).get();
  if (bookingSnapshot.empty) return null;

  const doc = bookingSnapshot.docs[0];
  if (formResponseId && doc.data().formResponseId === formResponseId) {
    return null;
  }

  // Validate date and time if they were submitted
  const formDateEntryKey = process.env.GOOGLE_FORM_DATE_ENTRY;
  const formTimeEntryKey = process.env.GOOGLE_FORM_TIME_ENTRY;
  let dateChanged = false;
  let timeChanged = false;
  const validationWarnings: string[] = [];

  // Get the booking object early to check for existing customerId
  const booking = docToBooking(doc.id, doc.data());

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
      await customersCollection.doc(customer.id).set({
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

export async function confirmBooking(bookingId: string, depositAmount?: number, withAssistantCommission?: boolean, depositPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') {
  let booking: Booking | null = null;
  let slot: Slot | null = null;
  let customerId: string | null = null;

  await adminDb.runTransaction(async (transaction) => {
    // ALL READS MUST HAPPEN FIRST
    const bookingRef = bookingsCollection.doc(bookingId);
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
    
    // When confirming with a deposit, record it separately.
    // We intentionally do NOT set paidAmount here.
    // paidAmount is used for payments made AFTER the deposit (e.g. remaining balance).
    if (depositAmount !== undefined && depositAmount !== null && depositAmount > 0) {
      updateData.depositAmount = depositAmount;
      updateData.depositDate = Timestamp.now().toDate().toISOString(); // Track when deposit was paid
      updateData.paymentStatus = 'partial';
      if (depositPaymentMethod !== undefined) {
        updateData.depositPaymentMethod = depositPaymentMethod;
      }
    }

    // If this booking should include assistant commission (e.g. sister helped),
    // store the assistant name and a fixed 10% commission rate.
    if (withAssistantCommission) {
      updateData.assistantName = 'Sister';
      updateData.assistantCommissionRate = 0.1; // 10%
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

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  // Get booking and related data before updating (for email notifications)
  const bookingSnap = await bookingsCollection.doc(bookingId).get();
  const booking = bookingSnap.exists ? docToBooking(bookingSnap.id, bookingSnap.data()!) : null;
  const slot = booking ? await getSlotById(booking.slotId) : null;
  const customer = booking ? await getCustomerById(booking.customerId) : null;

  await bookingsCollection.doc(bookingId).set(
    {
      status,
      updatedAt: Timestamp.now().toDate().toISOString(),
    },
    { merge: true },
  );

  // Email functionality disabled
}

export async function saveInvoice(bookingId: string, invoice: Invoice) {
  // Get current booking to preserve status if already confirmed
  const bookingRef = bookingsCollection.doc(bookingId);
  const bookingSnap = await bookingRef.get();
  const currentBooking = bookingSnap.exists ? docToBooking(bookingSnap.id, bookingSnap.data()!) : null;
  
  const updateData: any = {
    invoice: {
      ...invoice,
      createdAt: invoice.createdAt || Timestamp.now().toDate().toISOString(),
      updatedAt: Timestamp.now().toDate().toISOString(),
    },
    updatedAt: Timestamp.now().toDate().toISOString(),
  };
  
  const wasPendingPayment = currentBooking?.status === 'pending_payment';
  const isNowPendingPayment = currentBooking?.status !== 'confirmed';
  
  // Only update status if booking is not already confirmed
  // If booking is confirmed (with or without deposit), keep it as confirmed
  if (currentBooking?.status !== 'confirmed') {
    updateData.status = 'pending_payment';
    updateData.paymentStatus = 'unpaid';
  } else {
    // If already confirmed, only set paymentStatus if not already set
    if (!currentBooking.paymentStatus) {
      updateData.paymentStatus = currentBooking.depositAmount ? 'partial' : 'unpaid';
    }
  }
  
  await bookingRef.set(updateData, { merge: true });

  // Email functionality disabled
}

export async function updatePaymentStatus(bookingId: string, paymentStatus: PaymentStatus, paidAmount?: number, tipAmount?: number, paidPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') {
  const now = Timestamp.now().toDate().toISOString();
  const updateData: any = {
    paymentStatus,
    updatedAt: now,
  };
  
  // When payment is fully paid, set booking status to confirmed (done)
  if (paymentStatus === 'paid') {
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
  
  await bookingsCollection.doc(bookingId).set(updateData, { merge: true });
}

export async function updateDepositAmount(bookingId: string, depositAmount: number, depositPaymentMethod?: 'PNB' | 'CASH' | 'GCASH') {
  const bookingRef = bookingsCollection.doc(bookingId);
  const bookingSnap = await bookingRef.get();
  const currentBooking = bookingSnap.exists ? docToBooking(bookingSnap.id, bookingSnap.data()!) : null;
  
  const now = Timestamp.now().toDate().toISOString();
  const updateData: any = {
    depositAmount,
    depositDate: now, // Track when deposit was paid
    updatedAt: now,
    paymentStatus: 'partial', // Set payment status to partial when deposit is added
  };
  if (depositPaymentMethod !== undefined) {
    updateData.depositPaymentMethod = depositPaymentMethod;
  }
  
  // If booking is pending_payment and has no invoice yet, update status to confirmed when deposit is added
  // This handles cases where deposit is added separately from the confirmation flow
  if (currentBooking?.status === 'pending_payment' && !currentBooking.invoice) {
    updateData.status = 'confirmed';
  }
  
  await bookingRef.set(updateData, { merge: true });
}

export async function rescheduleBooking(bookingId: string, newSlotId: string, linkedSlotIds?: string[]) {
  await adminDb.runTransaction(async (transaction) => {
    // ALL READS FIRST
    const bookingRef = bookingsCollection.doc(bookingId);
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
    const updateData: any = {
      slotId: newSlotId,
      updatedAt: Timestamp.now().toDate().toISOString(),
    };

    if (linkedSlotIds && linkedSlotIds.length > 0) {
      updateData.pairedSlotId = linkedSlotIds[0];
      updateData.linkedSlotIds = linkedSlotIds;
    } else {
      updateData.pairedSlotId = null;
      updateData.linkedSlotIds = [];
    }

    transaction.update(bookingRef, updateData);
  });
}

/**
 * Get bookings eligible for manual release
 * Returns bookings that are:
 * - 2+ hours old from creation time
 * - Still in 'pending_form' status
 * - No form has been synced (no formResponseId)
 */
export async function getEligibleBookingsForRelease() {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  const snapshot = await bookingsCollection.where('status', '==', 'pending_form').get();

  const eligibleBookings: Booking[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (!data.createdAt) continue;
    
    const createdAt = new Date(data.createdAt).getTime();
    if (Number.isNaN(createdAt) || createdAt >= twoHoursAgo) continue;
    
    // Only include bookings that haven't been synced with a form yet
    // If formResponseId exists, it means a form was received and synced
    if (data.formResponseId) continue;

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
        const bookingRef = bookingsCollection.doc(bookingId);
        const bookingSnap = await bookingRef.get();
        
        if (!bookingSnap.exists) return;
        const data = bookingSnap.data()!;
        
        // Only release bookings that are still in pending_form status
        if (data.status !== 'pending_form') return;

        await adminDb.runTransaction(async (transaction) => {
          const slotRef = slotsCollection.doc(data.slotId);
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
  const snapshot = await bookingsCollection.where('status', '==', 'pending_form').get();

  await Promise.all(
    snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      if (!data.createdAt) return;
      const createdAt = new Date(data.createdAt).getTime();
      if (Number.isNaN(createdAt) || createdAt >= cutoff) return;

      await adminDb.runTransaction(async (transaction) => {
        const bookingRef = bookingsCollection.doc(docSnap.id);
        const slotRef = slotsCollection.doc(data.slotId);
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
    notes: data.notes ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

