import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readCsv, writeCsv } from './csv-utils.mjs';
import { root } from './data-utils.mjs';
import { glossaryCsvHeaders } from './glossary-schema.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const sourcePath = join(root, 'data', 'source', 'glossary', 'csv', 'candidates.csv');
const publicPath = join(root, 'public', 'data', 'glossary', 'candidates.json');

const fixes = parseEmbeddedCsv(readFileSync(new URL('./shugiin51-card-risk-fixes.csv', import.meta.url), 'utf8'));
const fixById = new Map(fixes.map((fix) => [fix.id, fix]));
const rows = readCsv(sourcePath);
const publicRows = JSON.parse(readFileSync(publicPath, 'utf8')).entries ?? [];
const publicById = new Map(publicRows.map((entry) => [entry.id, entry]));
const reportRows = [];

for (const row of rows) {
  const fix = fixById.get(row.id);
  if (!fix) continue;
  const before = snapshot(row);
  row.label = fix.correct_label;
  row.reading = fix.correct_reading;
  row.districtLabel = fix.correct_district;
  if (fix.correct_party) row.partyLabel = fix.correct_party;
  if (fix.correct_status) row.statusLabel = fix.correct_status;
  if (fix.correct_age) row.age = fix.correct_age;
  if (fix.correct_wins) row.wins = fix.correct_wins;
  row.seatType = fix.correct_district.startsWith('比') ? '比例' : '小選挙区';
  row.description = rebuildDescription(row);
  if (fix.confidence === 'high') row.reviewStatus = 'ok';

  reportRows.push({
    id: row.id,
    beforeLabel: before.label,
    afterLabel: row.label,
    beforeReading: before.reading,
    afterReading: row.reading,
    beforeDistrict: before.districtLabel,
    afterDistrict: row.districtLabel,
    evidencePage: fix.evidence_page,
    confidence: fix.confidence,
    applied: apply ? 'yes' : 'dry-run',
  });
}

const missingFixIds = fixes.map((fix) => fix.id).filter((id) => !rows.some((row) => row.id === id));
const publicOnlyMissing = fixes.map((fix) => fix.id).filter((id) => !publicById.has(id));

if (missingFixIds.length > 0 || publicOnlyMissing.length > 0) {
  console.error(`Missing source ids: ${missingFixIds.join(', ') || '-'}`);
  console.error(`Missing public ids: ${publicOnlyMissing.join(', ') || '-'}`);
  process.exit(1);
}

if (apply) {
  writeCsv(sourcePath, rows, glossaryCsvHeaders);
}

console.log(`${apply ? 'Applied' : 'Dry-run checked'} ${reportRows.length} card risk fix(es)`);
console.log(`- ${sourcePath}`);
console.log(`- apply with: node scripts/apply-shugiin51-card-risk-fixes.mjs --apply`);

const duplicateReadings = findDuplicateReadings(rows);
const shortReadings = rows
  .filter((row) => row.category === 'candidate')
  .filter((row) => normalizeReading(row.reading).length < 5)
  .map((row) => `${row.id}:${row.label}:${row.reading}`);

console.log(`Remaining duplicate reading groups: ${duplicateReadings.length}`);
console.log(`Remaining short readings: ${shortReadings.length}`);
if (duplicateReadings.length > 0) {
  console.log(duplicateReadings.slice(0, 20).map((group) => `  ${group.reading}: ${group.ids.join(', ')}`).join('\n'));
}
if (shortReadings.length > 0) {
  console.log(shortReadings.slice(0, 20).map((row) => `  ${row}`).join('\n'));
}

function snapshot(row) {
  return {
    label: row.label,
    reading: row.reading,
    districtLabel: row.districtLabel,
  };
}

function rebuildDescription(row) {
  return [
    row.districtLabel,
    row.partyLabel,
    row.statusLabel,
    row.wins ? `当選${row.wins}回` : '',
    row.age ? `${row.age}歳` : '',
  ]
    .filter(Boolean)
    .join(' / ');
}

function normalizeReading(value) {
  return String(value ?? '').replace(/\s+/g, '');
}

function findDuplicateReadings(entries) {
  const byReading = new Map();
  for (const row of entries) {
    if (row.category !== 'candidate') continue;
    const reading = normalizeReading(row.reading);
    if (!reading) continue;
    if (!byReading.has(reading)) byReading.set(reading, []);
    byReading.get(reading).push(row.id);
  }
  return [...byReading.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([reading, ids]) => ({ reading, ids }));
}

function parseEmbeddedCsv(text) {
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
    } else if (char === ',') {
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
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((csvRow) => csvRow.some(Boolean))
    .map((csvRow) => Object.fromEntries(headers.map((header, index) => [header, csvRow[index] ?? ''])));
}
