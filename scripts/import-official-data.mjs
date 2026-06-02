import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertInside, assertSafeElectionId, root, sourceRoot, toDisplayPath } from './data-utils.mjs';
import { csvTemplates } from './csv-schema.mjs';
import { readCsv, validateCsvHeaders, writeCsv } from './csv-utils.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--apply');
const electionId = readOption('--election') ?? readOption('--election-id') ?? args.find((arg) => !arg.startsWith('--'));
const inputDir = readOption('--input') ?? readOption('--from');
const schemaPath = resolve(readOption('--schema') ?? join(root, 'data', 'import-schemas', 'internal-csv-v1.json'));
const outputRoot = resolve(readOption('--output') ?? join(root, 'data', 'imports'));

if (!electionId || !inputDir) {
  console.error(
    'Usage: node scripts/import-official-data.mjs <electionId> --input=<official-csv-dir> [--schema=<schema.json>] [--apply] [--output=<dir>]',
  );
  process.exit(1);
}

assertSafeElectionId(electionId);
if (!existsSync(schemaPath)) throw new Error(`Missing import schema: ${schemaPath}`);

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const inputRoot = resolve(inputDir);
const stamp = timestamp();
const importDir = resolve(outputRoot, electionId, stamp);
const normalizedDir = resolve(importDir, 'normalized');
assertInside(outputRoot, normalizedDir);

console.log(`Official import ${dryRun ? 'dry run' : 'apply'}: ${electionId}`);
console.log(`Input: ${toDisplayPath(inputRoot)}`);
console.log(`Schema: ${toDisplayPath(schemaPath)}`);
console.log(`Normalized CSV: ${toDisplayPath(normalizedDir)}`);

for (const [fileName, headers] of Object.entries(csvTemplates)) {
  const fileSchema = schema.files?.[fileName] ?? {};
  const sourceName = fileSchema.source ?? fileName;
  const sourcePath = resolve(inputRoot, sourceName);
  const normalizedPath = resolve(normalizedDir, fileName);
  assertInside(normalizedDir, normalizedPath);

  if (!existsSync(sourcePath) && !fileSchema.optional) {
    throw new Error(`Missing official/staged CSV for ${fileName}: ${sourcePath}`);
  }

  const sourceRows = existsSync(sourcePath) ? readCsv(sourcePath) : [];
  const rows = sourceRows.map((row, index) => normalizeRow(row, headers, fileSchema, { electionId, rowIndex: index + 1 }));
  writeCsv(normalizedPath, rows, headers);
  validateCsvHeaders(normalizedPath, headers);
  console.log(`- ${fileName}: ${sourceRows.length} row(s) from ${sourceName}`);
}

runNode(['scripts/import-source-csv.mjs', '--dry-run', `--csv-dir=${normalizedDir}`, electionId]);

if (dryRun) {
  console.log('');
  console.log('Dry run completed. Review the normalized CSV files, then run with --apply to update source CSV and election.json.');
  process.exit(0);
}

const sourceCsvDir = resolve(sourceRoot, electionId, 'csv');
mkdirSync(sourceCsvDir, { recursive: true });
for (const fileName of Object.keys(csvTemplates)) {
  const from = resolve(normalizedDir, fileName);
  const to = resolve(sourceCsvDir, fileName);
  assertInside(sourceCsvDir, to);
  copyFileSync(from, to);
}

runNode(['scripts/import-source-csv.mjs', electionId]);
runNode(['scripts/generate-data.mjs', '--dry-run', electionId]);
runNode(['scripts/report-data-diff.mjs', '--write', electionId]);
runNode(['scripts/validate-data.mjs', '--strict']);

console.log('');
console.log('Official import applied to source CSV/election.json.');
console.log('Human review checkpoint: inspect normalized CSV, election.json, and the data diff report before running npm run gen:data.');

function normalizeRow(row, headers, fileSchema, context) {
  return Object.fromEntries(headers.map((header) => [header, resolveValue(fileSchema.columns?.[header] ?? header, row, context)]));
}

function resolveValue(mapping, row, context) {
  if (typeof mapping === 'string') return row[mapping] ?? '';
  if (!mapping || typeof mapping !== 'object') return '';

  const sourceValue = mapping.source ? row[mapping.source] : undefined;
  let value = sourceValue ?? mapping.value ?? '';
  if ((value === undefined || value === '') && 'default' in mapping) value = mapping.default;
  if (typeof value === 'string') value = value.replaceAll('{electionId}', context.electionId).replaceAll('{rowIndex}', String(context.rowIndex));
  return value ?? '';
}

function runNode(commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Command failed: node ${commandArgs.join(' ')}`);
  }
}

function readOption(name) {
  const exact = args.indexOf(name);
  if (exact >= 0) return args[exact + 1];

  const prefix = `${name}=`;
  const option = args.find((arg) => arg.startsWith(prefix));
  return option ? option.slice(prefix.length) : undefined;
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
}
