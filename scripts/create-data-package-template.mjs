import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { csvTemplates } from './csv-schema.mjs';
import { escapeCsvCell } from './csv-utils.mjs';
import { assertInside, assertSafeElectionId, root, toDisplayPath } from './data-utils.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const electionId = args.find((arg) => !arg.startsWith('--') && !arg.includes('='));
const outArg = args.find((arg) => arg.startsWith('--out='));

if (!electionId) {
  console.error('Usage: node scripts/create-data-package-template.mjs [--dry-run] [--force] [--out=data/work/{electionId}-package] <electionId>');
  process.exit(1);
}

assertSafeElectionId(electionId);

const outputDir = join(root, outArg?.slice('--out='.length) || `data/work/${electionId}-package`);
assertInside(join(root, 'data'), outputDir);

const plannedFiles = [
  ['README.md', readmeContent()],
  ['sources/official-sources.csv', csvLine(['id', 'electionId', 'publisher', 'sourceType', 'format', 'title', 'url', 'retrievedAt', 'publishedAt', 'licenseStatus', 'notes'])],
  ['photo-rights.csv', csvLine(['candidateId', 'electionId', 'photoFile', 'sourceUrl', 'rightHolder', 'rightsStatus', 'retrievedAt', 'notes'])],
  ['photos/README.md', '候補者写真は {candidateId}.webp を推奨します。photo-rights.csv に出典と許諾を記録してください。\n'],
  ['pdf/README.md', 'PDFは直接公開JSONへ入れず、抽出後に data/source/glossary/csv/*.csv へ反映してください。\n'],
];

const masterFiles = {
  'masters/parties.csv': csvTemplates['parties.csv'],
  'masters/districts.csv': csvTemplates['districts.csv'],
  'masters/proportional-blocks.csv': csvTemplates['proportional_blocks.csv'],
  'masters/candidates.csv': csvTemplates['candidates.csv'],
};

for (const [fileName, headers] of Object.entries(csvTemplates)) {
  plannedFiles.push([`election-results/csv/${fileName}`, csvLine(headers)]);
}

for (const [fileName, headers] of Object.entries(masterFiles)) {
  plannedFiles.push([fileName, csvLine(headers)]);
}

for (const [relativePath, contents] of plannedFiles) {
  const path = join(outputDir, relativePath);
  if (existsSync(path) && !force) {
    console.error(`${toDisplayPath(path)} already exists. Use --force to overwrite data package template files.`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`DRY ${toDisplayPath(path)}`);
    continue;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

if (dryRun) {
  console.log(`Dry run: ${plannedFiles.length} file(s) would be created in ${toDisplayPath(outputDir)}`);
} else {
  console.log(`Created data package template in ${toDisplayPath(outputDir)}`);
}

function csvLine(headers) {
  return `${headers.map(escapeCsvCell).join(',')}\n`;
}

function readmeContent() {
  return `# ${electionId} Data Package

このフォルダは実データ受け入れ用の作業パッケージです。公開JSONへ直接入れず、CSV正規化、素材台帳、検証を通してから source に反映します。

## Order

1. sources/official-sources.csv に公式URL、取得日、形式、利用条件を記録
2. election-results/csv/ または masters/ にCSVを配置
3. photos/ に写真を入れる場合は photo-rights.csv に出典と許諾を記録
4. pdf/ は単語帳CSVへ抽出する前の保管場所として使う
5. data/source/elections/${electionId}/csv/ へ正規化して検証

## Checks

\`\`\`bash
npm run import:csv:dry -- ${electionId}
npm run gen:data:dry -- ${electionId}
npm run validate:materials:strict
npm run validate:data:strict
npm run release:check -- ${electionId}
\`\`\`
`;
}
