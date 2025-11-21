type PrefillRecord = Record<string, string | number | boolean | undefined>;

export function buildPrefilledGoogleFormUrl(baseUrl: string, fields: PrefillRecord) {
  const url = new URL(baseUrl);
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.append(key, String(value));
  });
  return url.toString();
}

