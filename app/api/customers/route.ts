import { NextResponse } from 'next/server';
import { listCustomers, createCustomer } from '@/lib/services/customerService';
import type { CustomerInput } from '@/lib/types';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const customers = await listCustomers();
    // OPTIMIZED: Customers list changes infrequently, cache for 2 minutes
    // Reduces reads when admin dashboard loads customer list
    return NextResponse.json({ customers }, {
      headers: {
        'Cache-Control': 'private, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to list customers.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, firstName, lastName, email, phone, socialMediaName, referralSource, notes } = body ?? {};

    if (!name) {
      return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 });
    }

    const customerInput: CustomerInput = {
      name,
      firstName,
      lastName,
      email,
      phone,
      socialMediaName,
      referralSource,
      notes,
    };

    const customer = await createCustomer(customerInput);
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to create customer.' }, { status: 400 });
  }
}

