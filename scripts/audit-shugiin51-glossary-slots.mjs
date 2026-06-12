import { join } from 'node:path';
import { readCsv, writeCsv } from './csv-utils.mjs';
import { root, toDisplayPath } from './data-utils.mjs';

const candidatesPath = join(root, 'data', 'source', 'glossary', 'csv', 'candidates.csv');
const slotTextPath = join(root, 'data', 'work', 'shugiin-51st-glossary-review', 'manual-fix', 'pdf-slot-text.csv');
const outputPath = join(root, 'data', 'work', 'shugiin-51st-glossary-review', 'manual-fix', 'pdf-slot-audit.csv');

const candidates = readCsv(candidatesPath).filter((row) => row.category === 'candidate');
const slots = readCsv(slotTextPath);

if (candidates.length !== 465) throw new Error(`Expected 465 candidates, got ${candidates.length}`);
if (slots.length !== 465) throw new Error(`Expected 465 PDF slot rows, got ${slots.length}`);

const partyCodes = new Map([
  ['自由民主党', '自'],
  ['中道改革連合', '中'],
  ['日本維新の会', '維'],
  ['国民民主党', '国'],
  ['参政党', '参'],
  ['チームみらい', 'み'],
  ['日本共産党', '共'],
  ['れいわ新選組', 'れ'],
  ['減税日本', '減'],
  ['ゆうこく連合', 'ゆ'],
  ['無所属', '無'],
]);

const statusCodes = new Map([
  ['新人', '新'],
  ['前職', '前'],
  ['元職', '元'],
]);

const rows = candidates.map((candidate, index) => {
  const slot = slots[index];
  const rawText = slot?.rawText ?? '';
  const normalizedRaw = normalize(rawText);
  const issues = [];

  if (slot?.id !== candidate.id) {
    issues.push(`id-order-mismatch:${slot?.id || '(blank)'}`);
  }

  if (!containsLoose(normalizedRaw, candidate.label)) {
    issues.push('label-not-found');
  }

  if (!containsLoose(normalizedRaw, candidate.reading)) {
    issues.push('reading-not-found');
  }

  const districtCore = candidate.districtLabel.replace(/^比/, '').replace(/区$/, '');
  if (!containsLoose(normalizedRaw, districtCore)) {
    issues.push('district-not-found');
  }

  const partyCode = partyCodes.get(candidate.partyLabel);
  if (!partyCode) {
    issues.push('unknown-party-label');
  } else if (!normalizedRaw.includes(partyCode)) {
    issues.push('party-code-not-found');
  }

  const statusCode = statusCodes.get(candidate.statusLabel);
  if (!statusCode) {
    issues.push('unknown-status-label');
  } else if (!normalizedRaw.includes(statusCode)) {
    issues.push('status-code-not-found');
  }

  if (candidate.age && !normalizedRaw.includes(candidate.age)) {
    issues.push('age-not-found');
  }

  const winsCircled = circledNumber(candidate.wins);
  if (winsCircled && !normalizedRaw.includes(winsCircled) && !normalizedRaw.includes(candidate.wins)) {
    issues.push('wins-not-found');
  }

  return {
    rowNumber: String(index + 1),
    id: candidate.id,
    label: candidate.label,
    reading: candidate.reading,
    districtLabel: candidate.districtLabel,
    partyLabel: candidate.partyLabel,
    statusLabel: candidate.statusLabel,
    wins: candidate.wins,
    age: candidate.age,
    pdfPageNumber: slot?.pageNumber ?? '',
    pdfSlot: slot?.slot ?? '',
    auditStatus: issues.length === 0 ? 'ok' : 'needs-pdf-visual-check',
    issueTypes: issues.join('|'),
    rawText: rawText.replaceAll(/\s+/g, ' ').trim(),
  };
});

writeCsv(outputPath, rows, [
  'rowNumber',
  'id',
  'label',
  'reading',
  'districtLabel',
  'partyLabel',
  'statusLabel',
  'wins',
  'age',
  'pdfPageNumber',
  'pdfSlot',
  'auditStatus',
  'issueTypes',
  'rawText',
]);

const counts = rows.reduce((acc, row) => {
  acc[row.auditStatus] = (acc[row.auditStatus] ?? 0) + 1;
  return acc;
}, {});
const issueCounts = {};
for (const row of rows) {
  for (const issue of row.issueTypes.split('|').filter(Boolean)) {
    issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
  }
}

console.log('Shugiin 51st PDF slot audit summary');
console.log(`- candidates: ${candidates.length}`);
console.log(`- slots: ${slots.length}`);
for (const [status, count] of Object.entries(counts).sort()) console.log(`- ${status}: ${count}`);
for (const [issue, count] of Object.entries(issueCounts).sort()) console.log(`- issue ${issue}: ${count}`);
console.log(`- output: ${toDisplayPath(outputPath)}`);

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll(/\s+/g, '')
    .replaceAll(/[・,、。()（）]/g, '');
}

function containsLoose(raw, value) {
  const target = normalize(value);
  if (!target) return true;
  if (raw.includes(target)) return true;

  const chars = [...target];
  let cursor = 0;
  for (const char of chars) {
    const found = raw.indexOf(char, cursor);
    if (found === -1) return false;
    cursor = found + 1;
  }
  return true;
}

function circledNumber(value) {
  const map = {
    1: '①',
    2: '②',
    3: '③',
    4: '④',
    5: '⑤',
    6: '⑥',
    7: '⑦',
    8: '⑧',
    9: '⑨',
    10: '⑩',
    11: '⑪',
    12: '⑫',
    13: '⑬',
    14: '⑭',
    15: '⑮',
    16: '⑯',
    17: '⑰',
    18: '⑱',
    19: '⑲',
    20: '⑳',
  };
  return map[String(value)];
}
