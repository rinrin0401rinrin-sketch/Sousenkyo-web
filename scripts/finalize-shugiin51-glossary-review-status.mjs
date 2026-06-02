import { join } from 'node:path';
import { readCsv, writeCsv } from './csv-utils.mjs';
import { root } from './data-utils.mjs';
import { glossaryCsvHeaders } from './glossary-schema.mjs';

const apply = process.argv.includes('--apply');
const sourcePath = join(root, 'data', 'source', 'glossary', 'csv', 'candidates.csv');
const reviewRoot = join(root, 'data', 'work', 'shugiin-51st-glossary-review');
const reviewCandidatesPath = join(reviewRoot, 'candidates.csv');
const nameReportPath = join(reviewRoot, 'name-reading-report.csv');

const sourceRows = readCsv(sourcePath);
const candidateRows = readCsv(reviewCandidatesPath);
const nameRows = readCsv(nameReportPath);
const sourceById = new Map(sourceRows.map((row) => [row.id, row]));
const missingRequired = [];

for (const row of sourceRows) {
  for (const key of ['id', 'label', 'reading', 'partyLabel', 'districtLabel', 'seatType', 'statusLabel', 'age', 'wins', 'photoUrl']) {
    if (!String(row[key] ?? '').trim()) missingRequired.push(`${row.id}:${key}`);
  }
}

const duplicateReadings = findDuplicateReadings(sourceRows);
const shortReadings = sourceRows
  .filter((row) => row.category === 'candidate')
  .filter((row) => normalizeReading(row.reading).length < 5)
  .filter((row) => !(row.id === 'candidate-391' && normalizeReading(row.reading) === 'みきけえ'));

if (missingRequired.length > 0 || duplicateReadings.length > 0 || shortReadings.length > 0) {
  console.error('Cannot finalize review status while QA risk remains.');
  console.error(`missingRequired: ${missingRequired.join(', ') || '-'}`);
  console.error(`duplicateReadings: ${duplicateReadings.map((group) => `${group.reading}:${group.ids.join('|')}`).join(', ') || '-'}`);
  console.error(`shortReadings: ${shortReadings.map((row) => `${row.id}:${row.reading}`).join(', ') || '-'}`);
  process.exit(1);
}

for (const row of sourceRows) {
  if (row.category === 'candidate') row.reviewStatus = 'ok';
}

for (const row of candidateRows) {
  const source = sourceById.get(row.id);
  if (!source) continue;
  for (const header of glossaryCsvHeaders) row[header] = source[header] ?? '';
}

for (const row of nameRows) {
  const source = sourceById.get(row.id);
  if (!source) continue;
  row.label = source.label;
  row.reading = source.reading;
  row.age = source.age;
  row.partyLabel = source.partyLabel;
  row.statusLabel = source.statusLabel;
  row.wins = source.wins;
  row.districtLabel = source.districtLabel;
  row.reviewStatus = 'ok';
  row.reason = 'manual-verified-final';
}

if (apply) {
  writeCsv(sourcePath, sourceRows, glossaryCsvHeaders);
  writeCsv(reviewCandidatesPath, candidateRows, glossaryCsvHeaders);
  writeCsv(nameReportPath, nameRows);
}

console.log(`${apply ? 'Finalized' : 'Dry-run checked'} review status for ${sourceRows.filter((row) => row.category === 'candidate').length} candidate row(s)`);
console.log(`- duplicate reading groups: ${duplicateReadings.length}`);
console.log(`- short readings requiring action: ${shortReadings.length}`);
console.log('- allowed short reading: candidate-391 三木圭恵 / みきけえ');

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
