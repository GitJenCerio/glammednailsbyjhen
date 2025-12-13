import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book Appointment - Online Booking',
  description: 'Book your nail appointment online. Choose from Russian manicure, nail art, pedicure, and nail extension services. Available slots updated in real-time.',
  openGraph: {
    title: 'Book Your Nail Appointment Online | glammednailsbyjhen',
    description: 'Schedule your appointment online. Real-time availability for manicure, pedicure, nail art, and extension services.',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

