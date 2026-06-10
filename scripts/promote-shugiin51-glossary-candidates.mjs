import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readCsv, readCsvHeaders, writeCsv } from './csv-utils.mjs';
import { assertInside, publicDataRoot, readJson, root, toDisplayPath } from './data-utils.mjs';
import { glossaryCsvHeaders } from './glossary-schema.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dryRun = args.includes('--dry-run') || !apply;

if (apply && args.includes('--dry-run')) {
  throw new Error('--apply と --dry-run は同時に指定できません');
}

const reviewRoot = join(root, 'data', 'work', 'shugiin-51st-glossary-review');
const manualFixDir = join(reviewRoot, 'manual-fix');
const workCandidatesPath = join(reviewRoot, 'candidates.csv');
const sourceDir = join(root, 'data', 'source', 'glossary', 'csv');
const sourceCandidatesPath = join(sourceDir, 'candidates.csv');
const dryRunReportPath = join(manualFixDir, 'glossary-promotion-dry-run.csv');

assertInside(reviewRoot, dryRunReportPath);
assertInside(sourceDir, sourceCandidatesPath);

const workHeaders = readCsvHeaders(workCandidatesPath);
const sourceHeaders = readCsvHeaders(sourceCandidatesPath);
const workRows = readCsv(workCandidatesPath);
const sourceRows = readCsv(sourceCandidatesPath);
const electionsIndex = readJson(join(publicDataRoot, 'elections-index.json'));
const validElectionIds = new Set((electionsIndex.elections ?? []).map((election) => election.id).filter(Boolean));
const qaSummary = loadQaSummary();
const manualRealNeededPath = join(manualFixDir, 'manual-review-real-needed.csv');
const manualRealNeededExists = existsSync(manualRealNeededPath);
const manualRealNeededRows = manualRealNeededExists ? readCsv(manualRealNeededPath) : [];
const promotionRows = normalizePromotionRows(workRows);
const dangerousPhotoRows = promotionRows.filter((row) => isDangerousWorkPhotoUrl(row.photoUrl));
const reviewStatusCounts = countBy(promotionRows, (row) => row.reviewStatus || '(blank)');
const unknownElectionIds = findUnknownElectionIds(promotionRows, validElectionIds);
const issues = collectIssues({
  workHeaders,
  sourceHeaders,
  workRows,
  promotionRows,
  dangerousPhotoRows,
  manualRealNeededExists,
  manualRealNeededRows,
  qaSummary,
  unknownElectionIds,
});
const reportRows = buildReportRows({
  mode: dryRun ? 'dry-run' : 'apply',
  workRows,
  sourceRows,
  promotionRows,
  dangerousPhotoRows,
  manualRealNeededExists,
  manualRealNeededRows,
  qaSummary,
  reviewStatusCounts,
  unknownElectionIds,
  issues,
});

writeCsv(dryRunReportPath, reportRows, [
  'check',
  'status',
  'count',
  'details',
]);

if (issues.length > 0) {
  console.error(`Promotion check failed. See ${toDisplayPath(dryRunReportPath)}`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

if (dryRun) {
  console.log(`Dry run: ${promotionRows.length} candidate row(s) checked for promotion.`);
  console.log(`- report: ${toDisplayPath(dryRunReportPath)}`);
  console.log(`- dangerous data/work photoUrl: ${dangerousPhotoRows.length} row(s); --apply will blank these photoUrl values.`);
  console.log(`- manual-review-real-needed: ${manualRealNeededRows.length} row(s)`);
  console.log(`- reviewStatus: ${formatCounts(reviewStatusCounts)}`);
  process.exit(0);
}

const backupPath = backupCsvPath(sourceCandidatesPath);
assertInside(sourceDir, backupPath);
copyFileSync(sourceCandidatesPath, backupPath);
writeCsv(sourceCandidatesPath, promotionRows.map(blankDangerousPhotoUrl), glossaryCsvHeaders);

console.log(`Promoted ${promotionRows.length} candidate row(s) to ${toDisplayPath(sourceCandidatesPath)}`);
console.log(`- backup: ${toDisplayPath(backupPath)}`);
console.log(`- report: ${toDisplayPath(dryRunReportPath)}`);
console.log(`- blanked data/work photoUrl: ${dangerousPhotoRows.length} row(s)`);

function normalizePromotionRows(rows) {
  return rows.map((row) => {
    return Object.fromEntries(glossaryCsvHeaders.map((header) => [header, row[header] ?? '']));
  });
}

function blankDangerousPhotoUrl(row) {
  if (!isDangerousWorkPhotoUrl(row.photoUrl)) return row;
  return { ...row, photoUrl: '' };
}

function collectIssues(context) {
  const nextIssues = [];
  const {
    workHeaders,
    sourceHeaders,
    workRows,
    promotionRows,
    dangerousPhotoRows,
    manualRealNeededExists,
    manualRealNeededRows,
    qaSummary,
  } = context;

  compareHeaders('work candidates.csv', workHeaders, nextIssues);
  compareHeaders('source candidates.csv', sourceHeaders, nextIssues);

  if (workRows.length === 0) nextIssues.push('work candidates.csv に候補者行がありません');
  if (promotionRows.length !== 465) nextIssues.push(`候補者件数が465件ではありません: ${promotionRows.length}`);
  if (!qaSummary.exists) nextIssues.push('manual-fix/qa-summary.md がありません');
  if (!manualRealNeededExists) nextIssues.push('manual-review-real-needed.csv がありません');
  if (manualRealNeededRows.length !== 0) nextIssues.push(`manual-review-real-needed.csv が0件ではありません: ${manualRealNeededRows.length}`);

  const seen = new Set();
  for (const row of promotionRows) {
    if (!row.id) nextIssues.push('id が空欄の行があります');
    if (row.id && seen.has(row.id)) nextIssues.push(`id が重複しています: ${row.id}`);
    seen.add(row.id);
    if (row.category !== 'candidate') nextIssues.push(`${row.id || '(blank id)'}: category が candidate ではありません`);
    if (!row.label) nextIssues.push(`${row.id || '(blank id)'}: label が空欄です`);
    if (!row.reading) nextIssues.push(`${row.id || '(blank id)'}: reading が空欄です`);
    if (!row.electionIds.split('|').includes('shugiin-51st')) nextIssues.push(`${row.id || '(blank id)'}: electionIds に shugiin-51st がありません`);
    if (!row.reviewStatus) nextIssues.push(`${row.id || '(blank id)'}: reviewStatus が空欄です`);
  }

  if (context.unknownElectionIds.length > 0) {
    nextIssues.push(`electionIds が elections-index.json に存在しません: ${context.unknownElectionIds.join(', ')}`);
  }

  return [...new Set(nextIssues)];
}

function compareHeaders(label, actualHeaders, issues) {
  const missing = glossaryCsvHeaders.filter((header) => !actualHeaders.includes(header));
  const extra = actualHeaders.filter((header) => !glossaryCsvHeaders.includes(header));
  const orderMismatch =
    missing.length === 0 &&
    extra.length === 0 &&
    actualHeaders.some((header, index) => header !== glossaryCsvHeaders[index]);

  if (missing.length > 0) issues.push(`${label}: 必須列がありません (${missing.join(', ')})`);
  if (extra.length > 0) issues.push(`${label}: 想定外の列があります (${extra.join(', ')})`);
  if (orderMismatch) issues.push(`${label}: 列順が schema と一致しません`);
}

function buildReportRows(context) {
  const {
    mode,
    workRows,
    sourceRows,
    promotionRows,
    dangerousPhotoRows,
    manualRealNeededExists,
    manualRealNeededRows,
    qaSummary,
    reviewStatusCounts,
    unknownElectionIds,
    issues,
  } = context;
  const status = issues.length === 0 ? 'ok' : 'ng';

  return [
    { check: 'mode', status: 'info', count: '', details: mode },
    { check: 'work candidates rows', status: workRows.length === 465 ? 'ok' : 'ng', count: workRows.length, details: toDisplayPath(workCandidatesPath) },
    { check: 'source candidates rows before promotion', status: 'info', count: sourceRows.length, details: toDisplayPath(sourceCandidatesPath) },
    { check: 'promotion rows', status: promotionRows.length === 465 ? 'ok' : 'ng', count: promotionRows.length, details: 'rows normalized to glossary schema columns' },
    { check: 'schema columns', status: statusForHeaders(), count: glossaryCsvHeaders.length, details: glossaryCsvHeaders.join('|') },
    { check: 'electionIds registered', status: unknownElectionIds.length === 0 ? 'ok' : 'ng', count: unknownElectionIds.length, details: unknownElectionIds.length === 0 ? 'all electionIds exist in elections-index.json' : unknownElectionIds.join('|') },
    { check: 'dangerous data/work photoUrl', status: 'warn', count: dangerousPhotoRows.length, details: '--apply blanks these photoUrl values for placeholder operation' },
    { check: 'manual-review-real-needed', status: manualRealNeededExists && manualRealNeededRows.length === 0 ? 'ok' : 'ng', count: manualRealNeededRows.length, details: manualRealNeededExists ? 'must be 0 before promotion' : 'missing manual-review-real-needed.csv' },
    { check: 'reviewStatus', status: 'warn', count: Object.keys(reviewStatusCounts).length, details: `${formatCounts(reviewStatusCounts)}; needs-review is allowed only when QA real-needed is 0 and rows are treated as qa-reason-only` },
    { check: 'QA summary', status: qaSummary.exists ? 'ok' : 'ng', count: '', details: qaSummary.summaryLine || 'missing manual-fix/qa-summary.md' },
    { check: 'overall', status, count: issues.length, details: issues.length === 0 ? 'ready for human confirmation before --apply' : issues.join(' / ') },
  ];
}

function findUnknownElectionIds(rows, validIds) {
  const unknown = new Set();
  for (const row of rows) {
    for (const electionId of row.electionIds.split('|').map((item) => item.trim()).filter(Boolean)) {
      if (!validIds.has(electionId)) unknown.add(electionId);
    }
  }
  return [...unknown].sort();
}

function statusForHeaders() {
  const actualWork = workHeaders.join('\0');
  const actualSource = sourceHeaders.join('\0');
  const expected = glossaryCsvHeaders.join('\0');
  return actualWork === expected && actualSource === expected ? 'ok' : 'ng';
}

function isDangerousWorkPhotoUrl(value) {
  const normalized = String(value || '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
  return normalized.startsWith('data/work/') || normalized.startsWith('/data/work/') || normalized.includes('/data/work/');
}

function loadQaSummary() {
  const qaSummaryPath = join(manualFixDir, 'qa-summary.md');
  if (!existsSync(qaSummaryPath)) return { exists: false, summaryLine: '' };
  const rows = readTextLines(qaSummaryPath);
  const summary = rows.filter((line) => /^- (Total candidates|Manual review rows|Manual real-needed rows|Safe auto rows|Photo problems|Missing readings|Pending districts):/.test(line));
  return {
    exists: true,
    summaryLine: summary.join(' | '),
  };
}

function readOptionalCsv(path) {
  return existsSync(path) ? readCsv(path) : [];
}

function readTextLines(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/);
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function formatCounts(counts) {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}:${count}`)
    .join('|');
}

function backupCsvPath(csvPath) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return join(sourceDir, `${basename(csvPath, '.csv')}.backup-${stamp}.csv`);
}
