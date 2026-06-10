import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readCsv, readCsvHeaders, writeCsv } from './csv-utils.mjs';
import { assertInside, root, toDisplayPath } from './data-utils.mjs';
import { glossaryCsvHeaders } from './glossary-schema.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dryRun = args.includes('--dry-run') || !apply;

if (apply && args.includes('--dry-run')) {
  throw new Error('--apply と --dry-run は同時に指定できません');
}

const electionId = 'shugiin-51st';
const expectedCount = 465;
const reviewRoot = join(root, 'data', 'work', 'shugiin-51st-glossary-review');
const reviewCandidatesPath = join(reviewRoot, 'candidates.csv');
const sourceCandidatesPath = join(root, 'data', 'source', 'glossary', 'csv', 'candidates.csv');
const photoRightsPath = join(root, 'data', 'source', 'materials', 'photo-rights.csv');
const publicPhotoDir = join(root, 'public', 'data', 'glossary', 'photos', electionId);
const publicPhotoUrlPrefix = `/data/glossary/photos/${electionId}`;
const sourceUrl = 'data/work/shugiin-51st-glossary-review/photos';
const rightHolder = 'user-confirmed local PDF source';
const notes = 'ユーザーが権利確認済みと明示したローカルPDF由来の第51回単語帳候補者写真。秘密情報なし。';

assertInside(root, reviewCandidatesPath);
assertInside(root, sourceCandidatesPath);
assertInside(root, photoRightsPath);
assertInside(root, publicPhotoDir);

const sourceHeaders = readCsvHeaders(sourceCandidatesPath);
const sourceRows = readCsv(sourceCandidatesPath);
const reviewRows = readCsv(reviewCandidatesPath);
const photoRightsHeaders = [
  'candidateId',
  'electionId',
  'photoFile',
  'sourceUrl',
  'rightHolder',
  'rightsStatus',
  'retrievedAt',
  'notes',
];
const existingRightsRows = readCsv(photoRightsPath);

if (sourceHeaders.join('\0') !== glossaryCsvHeaders.join('\0')) {
  throw new Error(`${toDisplayPath(sourceCandidatesPath)} のCSV列が glossary schema と一致しません`);
}

const reviewById = new Map(reviewRows.map((row) => [row.id, row]));
const plan = [];
const missing = [];

for (const row of sourceRows) {
  const reviewRow = reviewById.get(row.id);
  const workPhotoUrl = reviewRow?.photoUrl || join('data', 'work', 'shugiin-51st-glossary-review', 'photos', `${row.id}.png`);
  const sourcePhotoPath = workPhotoUrl.startsWith('/')
    ? join(root, workPhotoUrl.replace(/^\//, ''))
    : join(root, workPhotoUrl);
  const publicPhotoUrl = `${publicPhotoUrlPrefix}/${row.id}.png`;
  const publicPhotoPath = join(publicPhotoDir, `${row.id}.png`);

  if (!existsSync(sourcePhotoPath)) {
    missing.push({ id: row.id, sourcePhotoPath });
  }

  plan.push({
    row,
    sourcePhotoPath,
    publicPhotoPath,
    publicPhotoUrl,
    photoRightsRow: {
      candidateId: row.id,
      electionId,
      photoFile: publicPhotoUrl,
      sourceUrl,
      rightHolder,
      rightsStatus: 'confirmed',
      retrievedAt: '2026-06-01',
      notes,
    },
  });
}

const issues = [];
if (sourceRows.length !== expectedCount) issues.push(`候補者CSVが${expectedCount}件ではありません: ${sourceRows.length}`);
if (reviewRows.length !== expectedCount) issues.push(`レビュー候補者CSVが${expectedCount}件ではありません: ${reviewRows.length}`);
if (plan.length !== expectedCount) issues.push(`反映予定が${expectedCount}件ではありません: ${plan.length}`);
if (missing.length > 0) issues.push(`元写真が見つかりません: ${missing.length}件`);

console.log(`${dryRun ? 'Dry run' : 'Apply'}: 第51回単語帳候補者写真`);
console.log(`- candidates: ${sourceRows.length}`);
console.log(`- source photos checked: ${plan.length}`);
console.log(`- missing photos: ${missing.length}`);
console.log(`- photoUrl updates: ${plan.filter((item) => item.row.photoUrl !== item.publicPhotoUrl).length}`);
console.log(`- copy destination: ${toDisplayPath(publicPhotoDir)}`);

if (missing.length > 0) {
  for (const item of missing.slice(0, 20)) {
    console.log(`  missing: ${item.id} -> ${toDisplayPath(item.sourcePhotoPath)}`);
  }
  if (missing.length > 20) console.log(`  ...and ${missing.length - 20} more`);
}

if (issues.length > 0) {
  for (const issue of issues) console.error(`ERROR ${issue}`);
  process.exit(1);
}

if (dryRun) {
  console.log('Dry run complete: 書き込みは行っていません。');
  process.exit(0);
}

mkdirSync(publicPhotoDir, { recursive: true });
for (const item of plan) {
  copyFileSync(item.sourcePhotoPath, item.publicPhotoPath);
}

const updatedCandidateRows = plan.map((item) => ({
  ...item.row,
  photoUrl: item.publicPhotoUrl,
}));
writeCsv(sourceCandidatesPath, updatedCandidateRows, glossaryCsvHeaders);

const rightsByKey = new Map();
for (const row of existingRightsRows) {
  rightsByKey.set(rightsKey(row), row);
}
for (const item of plan) {
  rightsByKey.set(rightsKey(item.photoRightsRow), item.photoRightsRow);
}
const updatedRightsRows = [...rightsByKey.values()].sort((a, b) => {
  return `${a.electionId}:${a.candidateId}:${basename(a.photoFile)}`.localeCompare(`${b.electionId}:${b.candidateId}:${basename(b.photoFile)}`);
});
writeCsv(photoRightsPath, updatedRightsRows, photoRightsHeaders);

console.log(`Applied ${plan.length} glossary photo(s).`);
console.log(`- updated: ${toDisplayPath(sourceCandidatesPath)}`);
console.log(`- synced: ${toDisplayPath(photoRightsPath)}`);
console.log(`- copied: ${plan.length} file(s)`);

function rightsKey(row) {
  return `${row.electionId}:${row.candidateId}:${row.photoFile}`;
}
