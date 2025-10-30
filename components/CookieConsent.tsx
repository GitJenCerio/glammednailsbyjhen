import { useEffect, useState } from 'react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const consent = localStorage.getItem('cookie-consent');
      setVisible(!consent);
    }
  }, []);

  const accept = () => {
    localStorage.setItem('cookie-consent', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-black text-white px-6 py-4 rounded-lg shadow-lg flex flex-col items-center gap-2 max-w-xs w-full">
      <span className="text-sm text-center">This website uses cookies to enhance your experience. See our <a href="/cookies-policy" className="underline hover:text-gray-200">Cookies Policy</a>.</span>
      <button onClick={accept} className="mt-2 px-4 py-1 rounded bg-white text-black font-semibold hover:bg-gray-200 transition">Accept</button>
    </div>
  );
}

