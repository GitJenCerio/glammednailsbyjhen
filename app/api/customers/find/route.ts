import { NextResponse } from 'next/server';
import { getCustomerByEmail, getCustomerByPhone } from '@/lib/services/customerService';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');

    if (!email && !phone) {
      return NextResponse.json({ error: 'Either email or phone parameter is required.' }, { status: 400 });
    }

    let customer = null;
    
    // Try email first if provided
    if (email && email.trim()) {
      customer = await getCustomerByEmail(email.trim());
    }
    
    // If no customer found by email and phone is provided, try phone
    if (!customer && phone && phone.trim()) {
      customer = await getCustomerByPhone(phone.trim());
    }
    
    if (!customer) {
      return NextResponse.json({ customer: null, found: false });
    }

    return NextResponse.json({ customer, found: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to find customer.' }, { status: 500 });
  }
}

