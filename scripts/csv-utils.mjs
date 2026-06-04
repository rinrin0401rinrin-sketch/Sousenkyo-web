import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readCsv(path) {
  if (!existsSync(path)) return [];

  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).filter((row) => row.some((value) => value !== '')).map((row) => {
    return headers.reduce((record, header, index) => {
      record[header] = row[index] ?? '';
      return record;
    }, {});
  });
}

export function readCsvHeaders(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing CSV file: ${path}`);
  }

  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  return rows[0]?.map((header) => header.trim()) ?? [];
}

export function validateCsvHeaders(path, expectedHeaders) {
  const actualHeaders = readCsvHeaders(path);
  const missing = expectedHeaders.filter((header) => !actualHeaders.includes(header));
  const extra = actualHeaders.filter((header) => !expectedHeaders.includes(header));
  const orderMismatch = missing.length === 0 && extra.length === 0 && actualHeaders.some((header, index) => header !== expectedHeaders[index]);

  if (missing.length > 0 || extra.length > 0 || orderMismatch) {
    const details = [
      missing.length > 0 ? `missing: ${missing.join(', ')}` : undefined,
      extra.length > 0 ? `extra: ${extra.join(', ')}` : undefined,
      orderMismatch ? 'column order differs from template' : undefined,
    ].filter(Boolean).join(' / ');
    throw new Error(`${path} のCSV列がテンプレートと一致しません (${details})`);
  }
}

export function writeCsv(path, rows, expectedHeaders) {
  mkdirSync(dirname(path), { recursive: true });
  const headers = expectedHeaders ?? collectHeaders(rows);
  const lines = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))].map((row) =>
    row.map(escapeCsvCell).join(','),
  );
  writeFileSync(path, `${lines.join('\n')}\n`);
}

export function writeCsvHeaders(path, headers) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${headers.map(escapeCsvCell).join(',')}\n`);
}

export function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error('CSVのクォートが閉じられていません');
  }

  return rows;
}

export function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function collectHeaders(rows) {
  const headers = [];
  const seen = new Set();

  for (const row of rows) {
    for (const header of Object.keys(row)) {
      if (seen.has(header)) continue;
      seen.add(header);
      headers.push(header);
    }
  }

  return headers;
}

export function toNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

export function toBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export function omitEmpty(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== ''));
}
