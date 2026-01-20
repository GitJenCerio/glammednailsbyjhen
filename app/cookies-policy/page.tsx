import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookies Policy',
  description: 'Cookies policy for glammednailsbyjhen. Learn how we use cookies to improve your browsing experience.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function CookiesPolicy() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-6">Cookies Policy</h1>
      <p className="mb-4">This website uses cookies to make your browsing experience better. Here’s what that means:</p>
      <h2 className="text-xl font-semibold mt-8 mb-2">What Are Cookies?</h2>
      <p className="mb-4">Cookies are small files saved on your device by websites to help remember your preferences and track some information about your visit.</p>
      <h2 className="text-xl font-semibold mt-8 mb-2">How We Use Cookies</h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>For essential site features, like keeping appointments or remembering your settings</li>
        <li>To collect limited analytics data to help us improve the site</li>
      </ul>
      <h2 className="text-xl font-semibold mt-8 mb-2">Your Choices</h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>You can disable or delete cookies via your browser settings</li>
        <li>Most browsers allow you to refuse cookies, but parts of the site may not work properly if you do</li>
      </ul>
      <p className="mt-6">By continuing to use this site, you consent to our use of cookies as described.</p>
    </main>
  );
}

