'use client';

import type { Booking } from '@/lib/types';

type FormResponseModalProps = {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
};

export function FormResponseModal({ open, booking, onClose }: FormResponseModalProps) {
  if (!open || !booking) return null;

  const customerData = booking.customerData ?? {};
  const fieldOrder = booking.customerDataOrder;

  let entries: [string, string][];
  if (fieldOrder && fieldOrder.length > 0) {
    entries = fieldOrder
      .filter((key) => key in customerData)
      .map((key) => [key, customerData[key] as string]);
  } else {
    entries = Object.entries(customerData) as [string, string][];
  }

  const isUrl = (value: string): boolean => {
    if (!value || typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return /^(https?:\/\/|www\.)/i.test(value.trim());
    }
  };

  const isImageUrl = (url: string): boolean => {
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i;
    return imageExtensions.test(url) || /drive\.google\.com|dropbox\.com|imgur\.com/i.test(url);
  };

  // Extract all URLs from a string (handles comma-separated, newline-separated, or space-separated URLs)
  const extractUrls = (value: string): string[] => {
    if (!value) return [];
    
    // Try splitting by common separators (comma, newline, or multiple spaces)
    const separators = [',', '\n', '\r\n', '  ', ';'];
    let parts: string[] = [value];
    
    for (const sep of separators) {
      const newParts: string[] = [];
      for (const part of parts) {
        newParts.push(...part.split(sep));
      }
      parts = newParts;
    }
    
    // Extract URLs from each part
    const urls: string[] = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Check if the entire part is a URL
      if (isUrl(trimmed)) {
        urls.push(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        continue;
      }
      
      // Try to extract URLs from within the part using regex
      const urlRegex = /(https?:\/\/[^\s,;\n\r]+|www\.[^\s,;\n\r]+)/gi;
      const matches = trimmed.match(urlRegex);
      if (matches) {
        urls.push(...matches.map(url => url.startsWith('http') ? url : `https://${url}`));
      }
    }
    
    return urls;
  };

  const renderValue = (value: string) => {
    if (!value) return value;

    // Extract all URLs from the value
    const urls = extractUrls(value);
    
    // If we found multiple URLs, render them all
    if (urls.length > 1) {
      return (
        <div className="flex flex-col gap-2">
          {urls.map((url, index) => {
            const isImage = isImageUrl(url);
            return (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline break-all"
              >
                {isImage ? (
                  <span className="flex items-center gap-1">
                    <span>🖼️</span>
                    <span>View Image {index + 1}</span>
                  </span>
                ) : (
                  `Link ${index + 1}: ${url}`
                )}
              </a>
            );
          })}
        </div>
      );
    }
    
    // Single URL or no URLs found - use original logic
    if (urls.length === 1) {
      const url = urls[0];
      const isImage = isImageUrl(url);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
        >
          {isImage ? (
            <span className="flex items-center gap-1">
              <span>🖼️</span>
              <span>View Image</span>
            </span>
          ) : (
            value
          )}
        </a>
      );
    }

    // No URLs found, try to find URLs in the text
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const parts = value.split(urlRegex);

    if (parts.length > 1) {
      return (
        <>
          {parts.map((part, index) => {
            if (isUrl(part)) {
              const url = part.startsWith('http') ? part : `https://${part}`;
              const isImage = isImageUrl(url);
              return (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                >
                  {isImage ? (
                    <span className="flex items-center gap-1">
                      <span>🖼️</span>
                      <span>View Image</span>
                    </span>
                  ) : (
                    part
                  )}
                </a>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </>
      );
    }

    return value;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-xl my-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">Form response</p>
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold break-words">{booking.bookingId}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {entries.length === 0 ? (
            <p className="text-xs sm:text-sm text-slate-500">
              No responses yet. Waiting for Google Form submission.
            </p>
          ) : (
            <dl className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              {entries.map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-3">
                  <dt className="text-slate-500 break-words">{key}</dt>
                  <dd className="font-medium break-words sm:text-right">{renderValue(String(value))}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
