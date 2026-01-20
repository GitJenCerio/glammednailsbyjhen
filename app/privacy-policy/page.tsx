import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for glammednailsbyjhen. Learn how we collect, use, and protect your personal information.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicy() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4">We value your privacy and are committed to protecting your personal information. Here’s how we handle your data:</p>
      <h2 className="text-xl font-semibold mt-8 mb-2">What Information We Collect</h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Name and contact details (if you book an appointment)</li>
        <li>Messages or questions you send us</li>
        <li>Log data and cookie data when you browse our site</li>
      </ul>
      <h2 className="text-xl font-semibold mt-8 mb-2">How We Use Your Information</h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>To communicate with you about appointments or responses</li>
        <li>To provide and improve our services</li>
        <li>To comply with legal obligations</li>
        <li>To ensure our site functions correctly (using cookies/analytics)</li>
      </ul>
      <h2 className="text-xl font-semibold mt-8 mb-2">Contact</h2>
      <p>If you have any questions about this policy, please email us at <a href="mailto:glammednailsbyjhen@gmail.com" className="underline">glammednailsbyjhen@gmail.com</a>.</p>
    </main>
  );
}

