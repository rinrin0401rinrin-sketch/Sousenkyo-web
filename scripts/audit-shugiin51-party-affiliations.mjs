import { join } from 'node:path';
import { readCsv, writeCsv } from './csv-utils.mjs';
import { root, toDisplayPath } from './data-utils.mjs';

const csvDir = join(root, 'data', 'source', 'glossary', 'csv');
const candidatesPath = join(csvDir, 'candidates.csv');
const partyOverridesPath = join(csvDir, 'shugiin-51st-party-affiliation-overrides.csv');
const reviewRoot = join(root, 'data', 'work', 'shugiin-51st-glossary-review');
const nameReportPath = join(reviewRoot, 'name-reading-report.csv');
const outputPath = join(reviewRoot, 'manual-fix', 'party-affiliation-audit.csv');

const partyNames = new Map([
  ['自民', '自由民主党'],
  ['立民', '立憲民主党'],
  ['維新', '日本維新の会'],
  ['国民', '国民民主党'],
  ['公明', '公明党'],
  ['共産', '日本共産党'],
  ['れいわ', 'れいわ新選組'],
  ['参政', '参政党'],
  ['保守', '日本保守党'],
  ['社民', '社会民主党'],
  ['無所属', '無所属'],
  ['みらい', 'みらい'],
  ['ゆうこく', 'ゆうこく'],
]);

const reportHeaders = [
  'id',
  'label',
  'sourcePartyLabel',
  'sourcePartyNormalized',
  'currentPartyLabel',
  'currentPartyNormalized',
  'overridePartyLabel',
  'expectedDescription',
  'currentDescription',
  'auditStatus',
  'details',
];

const candidates = readCsv(candidatesPath);
const nameReports = readCsv(nameReportPath);
const reportRows = [];
const partyOverrides = loadPartyOverrides();
const candidateById = indexById(candidates, 'current candidates.csv');
const reportById = indexById(nameReports, 'name-reading-report.csv');

for (const sourceRow of nameReports) {
  const currentRow = candidateById.get(sourceRow.id);
  const audit = auditParty(sourceRow, currentRow);
  reportRows.push({
    id: sourceRow.id,
    label: sourceRow.label,
    sourcePartyLabel: sourceRow.partyLabel,
    sourcePartyNormalized: audit.sourcePartyNormalized,
    currentPartyLabel: currentRow?.partyLabel ?? '',
    currentPartyNormalized: audit.currentPartyNormalized,
    overridePartyLabel: audit.overridePartyLabel,
    expectedDescription: audit.expectedDescription,
    currentDescription: audit.currentDescription,
    auditStatus: audit.status,
    details: audit.details,
  });
}

for (const currentRow of candidates) {
  if (reportById.has(currentRow.id)) continue;
  reportRows.push({
    id: currentRow.id,
    label: currentRow.label,
    sourcePartyLabel: '',
    sourcePartyNormalized: '',
    currentPartyLabel: currentRow.partyLabel,
    currentPartyNormalized: normalizeParty(currentRow.partyLabel),
    overridePartyLabel: partyOverrides.get(currentRow.id)?.expectedPartyLabel ?? '',
    expectedDescription: buildDescription(currentRow),
    currentDescription: currentRow.description ?? '',
    auditStatus: 'missing-source-row',
    details: 'Current candidate is missing from name-reading-report.csv',
  });
}

for (const override of partyOverrides.values()) {
  const sourceRow = reportById.get(override.id);
  const currentRow = candidateById.get(override.id);

  if (!sourceRow || !currentRow) {
    reportRows.push({
      id: override.id,
      label: sourceRow?.label ?? currentRow?.label ?? '',
      sourcePartyLabel: sourceRow?.partyLabel ?? '',
      sourcePartyNormalized: sourceRow?.partyLabel === '中道' ? '中道' : normalizeParty(sourceRow?.partyLabel),
      currentPartyLabel: currentRow?.partyLabel ?? '',
      currentPartyNormalized: normalizeParty(currentRow?.partyLabel),
      overridePartyLabel: override.expectedPartyLabel,
      expectedDescription: currentRow ? buildDescription(currentRow) : '',
      currentDescription: currentRow?.description ?? '',
      auditStatus: 'stale-override',
      details: 'Override CSV row does not match both current candidates.csv and name-reading-report.csv',
    });
    continue;
  }

  if (sourceRow.partyLabel !== override.sourcePartyLabel) {
    reportRows.push({
      id: override.id,
      label: sourceRow.label,
      sourcePartyLabel: sourceRow.partyLabel,
      sourcePartyNormalized: sourceRow.partyLabel === '中道' ? '中道' : normalizeParty(sourceRow.partyLabel),
      currentPartyLabel: currentRow.partyLabel,
      currentPartyNormalized: normalizeParty(currentRow.partyLabel),
      overridePartyLabel: override.expectedPartyLabel,
      expectedDescription: buildDescription(currentRow),
      currentDescription: currentRow.description ?? '',
      auditStatus: 'override-source-mismatch',
      details: 'Override CSV sourcePartyLabel differs from name-reading-report.csv partyLabel',
    });
  }
}

writeCsv(outputPath, reportRows, reportHeaders);

const counts = countBy(reportRows, (row) => row.auditStatus);
const hardIssueStatuses = new Set([
  'mismatch',
  'description-mismatch',
  'missing-current-row',
  'missing-source-row',
  'duplicate-id',
  'stale-override',
  'override-source-mismatch',
]);
const hardIssueCount = reportRows.filter((row) => hardIssueStatuses.has(row.auditStatus)).length;

console.log('Party affiliation audit summary');
console.log(`- source rows: ${nameReports.length}`);
console.log(`- current rows: ${candidates.length}`);
console.log(`- report rows: ${reportRows.length}`);
for (const [status, count] of [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  console.log(`- ${status}: ${count}`);
}
console.log(`- output: ${toDisplayPath(outputPath)}`);

if (hardIssueCount > 0) {
  console.error(`Hard party affiliation issue(s): ${hardIssueCount}`);
  process.exit(1);
}

function auditParty(sourceRow, currentRow) {
  const sourceParty = sourceRow.partyLabel ?? '';
  const sourcePartyNormalized = sourceParty === '中道' ? '' : normalizeParty(sourceParty);

  if (!currentRow) {
    return {
      sourcePartyNormalized,
      currentPartyNormalized: '',
      overridePartyLabel: partyOverrides.get(sourceRow.id)?.expectedPartyLabel ?? '',
      expectedDescription: '',
      currentDescription: '',
      status: 'missing-current-row',
      details: 'Source report row is missing from current candidates.csv',
    };
  }

  const currentPartyNormalized = normalizeParty(currentRow.partyLabel);
  const override = partyOverrides.get(sourceRow.id);
  const expectedDescription = buildDescription(currentRow);
  const currentDescription = currentRow.description ?? '';

  if (currentDescription !== expectedDescription) {
    return {
      sourcePartyNormalized: sourceParty === '中道' ? '中道' : sourcePartyNormalized,
      currentPartyNormalized,
      overridePartyLabel: override?.expectedPartyLabel ?? '',
      expectedDescription,
      currentDescription,
      status: 'description-mismatch',
      details: 'description differs from the canonical candidate fields',
    };
  }

  if (sourceParty === '中道') {
    if (override && sourceParty === override.sourcePartyLabel && currentPartyNormalized === override.expectedPartyLabel) {
      return {
        sourcePartyNormalized: '中道',
        currentPartyNormalized,
        overridePartyLabel: override.expectedPartyLabel,
        expectedDescription,
        currentDescription,
        status: 'override-confirmed',
        details: `Raw source partyLabel is ambiguous 中道; override CSV confirms current ${override.expectedPartyLabel}`,
      };
    }

    return {
      sourcePartyNormalized: '中道',
      currentPartyNormalized,
      overridePartyLabel: override?.expectedPartyLabel ?? '',
      expectedDescription,
      currentDescription,
      status: 'mismatch',
      details: 'Raw source partyLabel is ambiguous 中道 but current row is not covered by the override CSV',
    };
  }

  if (sourcePartyNormalized === currentPartyNormalized) {
    return {
      sourcePartyNormalized,
      currentPartyNormalized,
      overridePartyLabel: override?.expectedPartyLabel ?? '',
      expectedDescription,
      currentDescription,
      status: 'confirmed',
      details: '',
    };
  }

  return {
    sourcePartyNormalized,
    currentPartyNormalized,
    overridePartyLabel: override?.expectedPartyLabel ?? '',
    expectedDescription,
    currentDescription,
    status: 'mismatch',
    details: 'Normalized source partyLabel differs from current candidates.csv partyLabel',
  };
}

function normalizeParty(value) {
  const label = String(value ?? '').trim();
  return partyNames.get(label) ?? label;
}

function buildDescription(row) {
  return [
    row.districtLabel,
    row.partyLabel,
    row.statusLabel,
    row.wins ? `当選${row.wins}回` : '',
    row.age ? `${row.age}歳` : '',
  ].filter(Boolean).join(' / ');
}

function loadPartyOverrides() {
  const rows = readCsv(partyOverridesPath);
  const byId = new Map();

  for (const row of rows) {
    if (!row.id) throw new Error(`${toDisplayPath(partyOverridesPath)}: id は必須です`);
    if (!row.sourcePartyLabel) throw new Error(`${toDisplayPath(partyOverridesPath)}: ${row.id} sourcePartyLabel は必須です`);
    if (!row.expectedPartyLabel) throw new Error(`${toDisplayPath(partyOverridesPath)}: ${row.id} expectedPartyLabel は必須です`);
    if (byId.has(row.id)) throw new Error(`${toDisplayPath(partyOverridesPath)}: ${row.id} が重複しています`);
    byId.set(row.id, row);
  }

  return byId;
}

function indexById(rows, label) {
  const byId = new Map();
  for (const row of rows) {
    if (!row.id) continue;
    if (byId.has(row.id)) {
      reportRows.push({
        id: row.id,
        label: row.label,
        sourcePartyLabel: label,
        sourcePartyNormalized: '',
        currentPartyLabel: '',
        currentPartyNormalized: '',
        overridePartyLabel: partyOverrides.get(row.id)?.expectedPartyLabel ?? '',
        expectedDescription: '',
        currentDescription: '',
        auditStatus: 'duplicate-id',
        details: `${label} contains duplicate id ${row.id}`,
      });
      continue;
    }
    byId.set(row.id, row);
  }
  return byId;
}

function countBy(rows, selectKey) {
  const counts = new Map();
  for (const row of rows) {
    const key = selectKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
