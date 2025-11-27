type PrefillRecord = Record<string, string | number | boolean | undefined>;

export function buildPrefilledGoogleFormUrl(baseUrl: string, fields: PrefillRecord) {
  const url = new URL(baseUrl);
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    // URLSearchParams.append automatically encodes values, but we ensure proper encoding
    const stringValue = String(value);
    // Google Forms expects URL-encoded values, especially for spaces and special characters
    url.searchParams.append(key, stringValue);
  });
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Generated prefill URL:', url.toString());
    console.log('Prefill parameters:', Object.fromEntries(url.searchParams));
  }
  
  return url.toString();
}

