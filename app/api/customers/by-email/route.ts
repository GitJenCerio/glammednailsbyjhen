import { NextResponse } from 'next/server';
import { getCustomerByEmail } from '@/lib/services/customerService';

// Mark this route as dynamic to prevent static analysis during build
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required.' }, { status: 400 });
    }

    const customer = await getCustomerByEmail(email);
    
    if (!customer) {
      return NextResponse.json({ customer: null });
    }

    return NextResponse.json({ customer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to get customer by email.' }, { status: 500 });
  }
}

