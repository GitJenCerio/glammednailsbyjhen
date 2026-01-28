import fs from 'fs';
import path from 'path';
import { fetchSheetRows } from '../lib/googleSheets';

function loadEnvFile(filename: string) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) return;
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function findColumnIndex(headers: string[], predicate: (h: string) => boolean) {
  for (let i = 0; i < headers.length; i += 1) {
    if (predicate(headers[i])) return i;
  }
  return -1;
}

function isFebruaryDate(value: string) {
  const raw = value.trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  if (lower.includes('feb')) return true;

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).getMonth() === 1;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const month = Number(raw.split('-')[1]);
    return month === 2;
  }

  return false;
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const range = process.env.GOOGLE_SHEETS_RANGE ?? "'Form Responses 1'!A:Z";
  const rows = await fetchSheetRows(range);

  if (!rows.length) {
    console.log(JSON.stringify({ success: true, matches: [], message: 'No rows found in sheet.' }, null, 2));
    return;
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => (h || '').trim());
  const normalizedHeaders = headers.map(normalizeHeader);

  const nailTechIndex = findColumnIndex(normalizedHeaders, (h) => {
    if (h.includes('technique')) return false;
    return h.includes('nail tech') || h.includes('nail technician');
  });

  const dateIndex = findColumnIndex(normalizedHeaders, (h) =>
    h.includes('date') && !h.includes('timestamp')
  );

  const timeIndex = findColumnIndex(normalizedHeaders, (h) =>
    h.includes('time') && !h.includes('timestamp')
  );
  const bookingIdIndex = findColumnIndex(normalizedHeaders, (h) =>
    h === 'booking id' || h.includes('booking id')
  );

  const nameIndex = findColumnIndex(normalizedHeaders, (h) =>
    h.includes('full name') || h === 'name' || (h.includes('first name') && h.includes('last name'))
  );

  const serviceIndex = findColumnIndex(normalizedHeaders, (h) =>
    h.includes('service') || h.includes('appointment type')
  );

  const matches = dataRows
    .map((row, rowIndex) => {
      const getValue = (index: number) => (index >= 0 ? String(row[index] || '').trim() : '');
      return {
        rowNumber: rowIndex + 2,
        bookingId: getValue(bookingIdIndex),
        date: getValue(dateIndex),
        time: getValue(timeIndex),
        nailTech: getValue(nailTechIndex),
        name: getValue(nameIndex),
        service: getValue(serviceIndex),
        raw: headers.reduce<Record<string, string>>((acc, header, index) => {
          if (!header) return acc;
          acc[header] = String(row[index] || '').trim();
          return acc;
        }, {}),
      };
    })
    .filter((row) => {
      const dateMatch = dateIndex >= 0 ? isFebruaryDate(row.date) : false;
      if (!dateMatch) return false;
      if (nailTechIndex < 0) return true;
      return row.nailTech.toLowerCase().includes('ms. jhen');
    });

  console.log(
    JSON.stringify(
      {
        success: true,
        range,
        headers,
        detectedColumns: {
          nailTech: nailTechIndex >= 0 ? headers[nailTechIndex] : null,
          date: dateIndex >= 0 ? headers[dateIndex] : null,
          time: timeIndex >= 0 ? headers[timeIndex] : null,
          bookingId: bookingIdIndex >= 0 ? headers[bookingIdIndex] : null,
          name: nameIndex >= 0 ? headers[nameIndex] : null,
          service: serviceIndex >= 0 ? headers[serviceIndex] : null,
        },
        note:
          nailTechIndex < 0
            ? 'No nail technician column detected in this sheet. Results include all February bookings.'
            : 'Filtered to nail tech value containing "Ms. Jhen".',
        matches,
        matchCount: matches.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Failed to check Google Sheets bookings:', error);
  process.exit(1);
});
