import { NextResponse } from 'next/server';
import { getCustomerById, updateCustomer, getBookingsByCustomer, calculateCustomerLifetimeValue } from '@/lib/services/customerService';
import type { CustomerInput } from '@/lib/types';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const customer = await getCustomerById(params.id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }

    // Get related data
    const bookings = await getBookingsByCustomer(params.id);
    const lifetimeValue = await calculateCustomerLifetimeValue(params.id);

    return NextResponse.json({ 
      customer, 
      bookings,
      lifetimeValue,
      bookingCount: bookings.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to get customer.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { name, firstName, lastName, email, phone, socialMediaName, referralSource, notes } = body ?? {};

    const updates: Partial<CustomerInput> = {};
    if (name !== undefined) updates.name = name;
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (socialMediaName !== undefined) updates.socialMediaName = socialMediaName;
    if (referralSource !== undefined) updates.referralSource = referralSource;
    if (notes !== undefined) updates.notes = notes;

    const customer = await updateCustomer(params.id, updates);
    return NextResponse.json({ customer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to update customer.' }, { status: 400 });
  }
}

