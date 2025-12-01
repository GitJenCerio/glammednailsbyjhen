import { NextResponse } from 'next/server';
import { listCustomers, createCustomer } from '@/lib/services/customerService';
import type { CustomerInput } from '@/lib/types';

export async function GET() {
  try {
    const customers = await listCustomers();
    return NextResponse.json({ customers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to list customers.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, notes } = body ?? {};

    if (!name) {
      return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 });
    }

    const customerInput: CustomerInput = {
      name,
      email,
      phone,
      notes,
    };

    const customer = await createCustomer(customerInput);
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to create customer.' }, { status: 400 });
  }
}

