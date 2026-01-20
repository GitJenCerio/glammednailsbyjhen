import { google } from 'googleapis';

const sheets = google.sheets('v4');

function getAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google service account credentials. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in your .env.local file.');
  }

  // Handle private key formatting - remove surrounding quotes if present
  privateKey = privateKey.trim();
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
  }
  
  // Replace escaped newlines with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  
  // Ensure the key starts and ends with the correct markers
  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    throw new Error('Invalid Google service account private key format. The key must include "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----" markers.');
  }

  try {
    return new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } catch (error: any) {
    if (error.code === 'ERR_OSSL_UNSUPPORTED') {
      throw new Error(
        'Private key format error. Please ensure:\n' +
        '1. The private key is in PKCS#8 format (starts with "-----BEGIN PRIVATE KEY-----")\n' +
        '2. The key includes all \\n characters between lines\n' +
        '3. The key is properly quoted in your .env.local file\n' +
        'Original error: ' + error.message
      );
    }
    throw error;
  }
}

/**
 * Extract Google Sheets ID from URL or return as-is if already an ID
 */
export function extractSheetId(input: string): string {
  if (!input) return '';
  
  // If it's already just an ID (no slashes), return as-is
  if (!input.includes('/')) {
    return input.trim();
  }
  
  // Try to extract from URL
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  // If no match, try to extract any long alphanumeric string
  const idMatch = input.match(/([a-zA-Z0-9-_]{20,})/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  
  // Return as-is if we can't extract
  return input.trim();
}

export async function fetchSheetRows(range: string, sheetId?: string) {
  // Use provided sheetId or fall back to environment variable
  const spreadsheetId = sheetId ? extractSheetId(sheetId) : process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error('Missing Google Sheets ID. Please provide a sheetId parameter or set GOOGLE_SHEETS_ID in environment variables.');

  const auth = getAuthClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    auth,
    range,
  });

  return response.data.values ?? [];
}

