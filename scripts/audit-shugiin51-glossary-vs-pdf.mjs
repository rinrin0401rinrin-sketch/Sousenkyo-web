import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readCsv, writeCsv } from './csv-utils.mjs';
import { root, toDisplayPath } from './data-utils.mjs';

const reviewRoot = join(root, 'data', 'work', 'shugiin-51st-glossary-review');
const candidatesPath = join(root, 'data', 'source', 'glossary', 'csv', 'candidates.csv');
const nameReportPath = join(reviewRoot, 'name-reading-report.csv');
const extractReportPath = join(reviewRoot, 'extract-report.csv');
const readingRiskReportPath = join(reviewRoot, 'manual-fix', 'reading-risk-report.csv');
const outputPath = join(reviewRoot, 'manual-fix', 'pdf-source-audit.csv');

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
  ['中道改革連合', '中道'],
  ['チームみらい', 'みらい'],
  ['ゆうこく連合', 'ゆうこく'],
]);

const reportHeaders = [
  'id',
  'label',
  'currentReading',
  'pdfReading',
  'currentDistrictLabel',
  'pdfDistrictLabel',
  'currentPartyLabel',
  'pdfPartyLabel',
  'currentStatusLabel',
  'pdfStatusLabel',
  'currentWins',
  'pdfWins',
  'currentAge',
  'pdfAge',
  'currentReviewStatus',
  'pdfReviewStatus',
  'extractLabel',
  'extractNotes',
  'readingRiskReason',
  'auditStatus',
  'issueTypes',
  'details',
];

const structuralIssues = [];
const missingOptionalReports = [];

if (!existsSync(candidatesPath)) {
  structuralIssues.push(`Missing required CSV file: ${toDisplayPath(candidatesPath)}`);
}

const hasNameReport = existsSync(nameReportPath);
const hasExtractReport = existsSync(extractReportPath);
const hasReadingRiskReport = existsSync(readingRiskReportPath);

if (!hasNameReport) missingOptionalReports.push(toDisplayPath(nameReportPath));
if (!hasExtractReport) missingOptionalReports.push(toDisplayPath(extractReportPath));
if (!hasReadingRiskReport) missingOptionalReports.push(toDisplayPath(readingRiskReportPath));

if (!hasNameReport && !hasExtractReport) {
  structuralIssues.push(`Missing PDF review reports: ${toDisplayPath(nameReportPath)} or ${toDisplayPath(extractReportPath)}`);
}

const candidates = existsSync(candidatesPath) ? readCsv(candidatesPath) : [];
const nameReports = hasNameReport ? readCsv(nameReportPath) : [];
const extractReports = hasExtractReport ? readCsv(extractReportPath) : [];
const readingRiskReports = hasReadingRiskReport ? readCsv(readingRiskReportPath) : [];

const candidateById = indexById(candidates, 'current candidates.csv');
const nameReportById = indexById(nameReports, 'name-reading-report.csv');
const extractReportById = indexById(extractReports, 'extract-report.csv');
const readingRiskById = indexById(readingRiskReports, 'reading-risk-report.csv');

const reportRows = [];
const allIds = new Set([
  ...candidateById.keys(),
  ...nameReportById.keys(),
  ...extractReportById.keys(),
  ...readingRiskById.keys(),
]);

for (const id of [...allIds].sort()) {
  const current = candidateById.get(id);
  const pdf = nameReportById.get(id);
  const extract = extractReportById.get(id);
  const risk = readingRiskById.get(id);
  const audit = auditRow(id, current, pdf, extract, risk);

  reportRows.push({
    id,
    label: current?.label ?? pdf?.label ?? extract?.label ?? risk?.label ?? '',
    currentReading: current?.reading ?? '',
    pdfReading: pdf?.reading ?? '',
    currentDistrictLabel: current?.districtLabel ?? '',
    pdfDistrictLabel: pdf?.districtLabel ?? '',
    currentPartyLabel: current?.partyLabel ?? '',
    pdfPartyLabel: pdf?.partyLabel ?? '',
    currentStatusLabel: current?.statusLabel ?? '',
    pdfStatusLabel: pdf?.statusLabel ?? '',
    currentWins: current?.wins ?? '',
    pdfWins: pdf?.wins ?? '',
    currentAge: current?.age ?? '',
    pdfAge: pdf?.age ?? '',
    currentReviewStatus: current?.reviewStatus ?? '',
    pdfReviewStatus: pdf?.reviewStatus ?? '',
    extractLabel: extract?.label ?? risk?.extractLabel ?? '',
    extractNotes: extract?.notes ?? risk?.extractReason ?? '',
    readingRiskReason: risk?.riskReason ?? '',
    auditStatus: audit.status,
    issueTypes: audit.issueTypes.join('|'),
    details: audit.details.join(' / '),
  });
}

writeCsv(outputPath, reportRows, reportHeaders);

const counts = countBy(reportRows, (row) => row.auditStatus);
const issueCounts = countIssues(reportRows);
const mismatchCount = reportRows.filter((row) => row.issueTypes.split('|').some((issue) => issue.endsWith('-mismatch'))).length;
const stalePdfCount = reportRows.filter((row) => row.issueTypes.split('|').includes('stale-pdf-report-value')).length;
const highRiskCount = reportRows.filter((row) => row.issueTypes.split('|').includes('reading-risk')).length;
const reviewNotOkCount = reportRows.filter((row) => row.issueTypes.split('|').includes('review-status-not-ok')).length;

console.log('Shugiin 51st glossary PDF-source audit summary');
console.log(`- current rows: ${candidates.length}`);
console.log(`- name-reading-report rows: ${nameReports.length}${hasNameReport ? '' : ' (missing)'}`);
console.log(`- extract-report rows: ${extractReports.length}${hasExtractReport ? '' : ' (missing)'}`);
console.log(`- reading-risk-report rows: ${readingRiskReports.length}${hasReadingRiskReport ? '' : ' (missing)'}`);
console.log(`- report rows: ${reportRows.length}`);
for (const [status, count] of [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  console.log(`- ${status}: ${count}`);
}
console.log(`- comparable mismatch rows: ${mismatchCount}`);
console.log(`- stale PDF report rows: ${stalePdfCount}`);
console.log(`- high-risk reading rows: ${highRiskCount}`);
console.log(`- reviewStatus not ok rows: ${reviewNotOkCount}`);
for (const [issue, count] of [...issueCounts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  console.log(`- issue ${issue}: ${count}`);
}
if (missingOptionalReports.length > 0) {
  console.log(`- optional report(s) not present: ${missingOptionalReports.join(', ')}`);
}
console.log(`- output: ${toDisplayPath(outputPath)}`);

if (structuralIssues.length > 0) {
  for (const issue of structuralIssues) {
    console.error(`Structural issue: ${issue}`);
  }
  process.exit(1);
}

function auditRow(id, current, pdf, extract, risk) {
  const issueTypes = [];
  const details = [];

  if (!current) {
    issueTypes.push('missing-current-row');
    details.push('id is present in PDF review output but missing from current candidates.csv');
  }
  if (current && hasNameReport && !pdf) {
    issueTypes.push('missing-name-reading-report-row');
    details.push('current id is missing from name-reading-report.csv');
  }
  if (current && hasExtractReport && !extract) {
    issueTypes.push('missing-extract-report-row');
    details.push('current id is missing from extract-report.csv');
  }

  if (current && pdf) {
    compareField(issueTypes, details, 'label', current.label, pdf.label);
    compareField(issueTypes, details, 'reading', current.reading, pdf.reading);
    compareField(issueTypes, details, 'districtLabel', current.districtLabel, pdf.districtLabel);
    compareField(issueTypes, details, 'partyLabel', normalizeParty(current.partyLabel), normalizeParty(pdf.partyLabel));
    compareField(issueTypes, details, 'statusLabel', current.statusLabel, pdf.statusLabel);
    compareField(issueTypes, details, 'wins', normalizeNumberText(current.wins), normalizeNumberText(pdf.wins));
    compareField(issueTypes, details, 'age', normalizeNumberText(current.age), normalizeNumberText(pdf.age));

    if (normalizeReviewStatus(current.reviewStatus) !== normalizeReviewStatus(pdf.reviewStatus)) {
      issueTypes.push('stale-pdf-report-value');
      details.push(`reviewStatus differs: current=${current.reviewStatus || '(blank)'} pdf=${pdf.reviewStatus || '(blank)'}`);
    }
  }

  if (current && extract?.label && normalizeText(current.label) !== normalizeText(extract.label)) {
    issueTypes.push('extract-label-mismatch');
    details.push(`extract label differs: current=${current.label || '(blank)'} extract=${extract.label}`);
  }

  if (risk) {
    issueTypes.push('reading-risk');
    details.push(`reading-risk-report: ${risk.riskReason || risk.extractReason || 'listed'}`);
  }

  const notOkStatuses = [
    current?.reviewStatus ? ['current', current.reviewStatus] : undefined,
    pdf?.reviewStatus ? ['pdf', pdf.reviewStatus] : undefined,
  ].filter((entry) => entry && normalizeReviewStatus(entry[1]) !== 'ok');

  if (notOkStatuses.length > 0) {
    issueTypes.push('review-status-not-ok');
    details.push(`reviewStatus not ok: ${notOkStatuses.map(([source, value]) => `${source}=${value}`).join(', ')}`);
  }

  if (issueTypes.length === 0) {
    return { status: 'ok', issueTypes: [], details: [] };
  }

  const uniqueIssues = unique(issueTypes);
  const status = chooseStatus(uniqueIssues);
  return { status, issueTypes: uniqueIssues, details: unique(details) };
}

function compareField(issueTypes, details, field, currentValue, pdfValue) {
  if (currentValue === undefined || pdfValue === undefined) return;

  const currentText = normalizeText(currentValue);
  const pdfText = normalizeText(pdfValue);
  if (!currentText && !pdfText) return;
  if (currentText === pdfText) return;

  issueTypes.push(`${field}-mismatch`);
  issueTypes.push('stale-pdf-report-value');
  details.push(`${field} differs: current=${currentValue || '(blank)'} pdf=${pdfValue || '(blank)'}`);
}

function chooseStatus(issueTypes) {
  if (issueTypes.includes('missing-current-row')) return 'missing-current-row';
  if (issueTypes.some((issue) => issue.endsWith('-mismatch') || issue === 'stale-pdf-report-value')) return 'mismatch';
  if (issueTypes.includes('review-status-not-ok')) return 'review-status-not-ok';
  if (issueTypes.includes('reading-risk')) return 'reading-risk';
  return 'notice';
}

function indexById(rows, sourceLabel) {
  const byId = new Map();
  for (const [index, row] of rows.entries()) {
    const id = row.id?.trim();
    if (!id) {
      structuralIssues.push(`${sourceLabel}: row ${index + 2} has a blank id`);
      continue;
    }
    if (byId.has(id)) {
      structuralIssues.push(`${sourceLabel}: duplicate id ${id}`);
      continue;
    }
    byId.set(id, row);
  }
  return byId;
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeNumberText(value) {
  return normalizeText(value).replace(/歳$/, '').replace(/^当選/, '').replace(/回$/, '');
}

function normalizeReviewStatus(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeParty(value) {
  const label = normalizeText(value);
  return partyNames.get(label) ?? label;
}

function countBy(rows, selectKey) {
  const counts = new Map();
  for (const row of rows) {
    const key = selectKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function countIssues(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const issue of row.issueTypes.split('|').filter(Boolean)) {
      counts.set(issue, (counts.get(issue) ?? 0) + 1);
    }
  }
  return counts;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
