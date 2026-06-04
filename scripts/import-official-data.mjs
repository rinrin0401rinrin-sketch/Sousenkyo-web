import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertInside, assertSafeElectionId, root, sourceRoot, toDisplayPath } from './data-utils.mjs';
import { csvTemplates } from './csv-schema.mjs';
import { parseCsv, readCsv, validateCsvHeaders, writeCsv } from './csv-utils.mjs';

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
const warnings = [];
const importStats = [];
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
  const sourceConfig = normalizeSourceConfig(fileSchema.source ?? fileName);
  const sourceName = sourceConfig.file;
  const sourcePath = resolve(inputRoot, sourceName);
  const normalizedPath = resolve(normalizedDir, fileName);
  assertInside(normalizedDir, normalizedPath);

  if (!existsSync(sourcePath) && !fileSchema.optional) {
    throw new Error(`Missing official/staged CSV for ${fileName}: ${sourcePath}`);
  }

  if (existsSync(sourcePath) && isExcelPath(sourcePath)) {
    const sheetHint = sourceConfig.sheet || fileSchema.sheet ? ` sheet="${sourceConfig.sheet ?? fileSchema.sheet}"` : '';
    throw new Error(
      `${sourcePath} はExcel形式です。${sheetHint} をCSV/TSVへ書き出してから取り込んでください。公式Excelの列ゆれは schema.columns で吸収できます。`,
    );
  }

  const sourceRows = existsSync(sourcePath) ? readDelimitedRows(sourcePath, fileSchema) : [];
  const rows = sourceRows.map((row, index) =>
    normalizeRow(row, headers, fileSchema, { electionId, rowIndex: index + 1, updatedAt: new Date().toISOString() }),
  );
  writeCsv(normalizedPath, rows, headers);
  validateCsvHeaders(normalizedPath, headers);
  validateNormalizedRows(fileName, rows, headers, fileSchema);
  importStats.push({ fileName, sourceName, sourceRows: sourceRows.length, normalizedRows: rows.length });
  console.log(`- ${fileName}: ${sourceRows.length} row(s) from ${sourceName}`);
}

if (warnings.length > 0) {
  console.log('');
  console.log('Import warnings:');
  for (const warning of warnings) console.warn(`WARN ${warning}`);
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
  if (typeof mapping === 'string') return normalizeCell(row[mapping] ?? '', {});
  if (!mapping || typeof mapping !== 'object') return '';

  const sourceValue = readMappedSourceValue(mapping, row);
  let value = sourceValue ?? mapping.value ?? '';
  if ((value === undefined || value === '') && 'default' in mapping) value = mapping.default;
  if (typeof value === 'string') {
    value = value
      .replaceAll('{electionId}', context.electionId)
      .replaceAll('{rowIndex}', String(context.rowIndex))
      .replaceAll('{updatedAt}', context.updatedAt);
  }
  return normalizeCell(value, mapping);
}

function normalizeSourceConfig(source) {
  if (typeof source === 'string') return { file: source };
  if (source && typeof source === 'object' && typeof source.file === 'string') {
    return { file: source.file, sheet: source.sheet };
  }
  throw new Error(`schema.files[].source は文字列または { "file": "...", "sheet": "..." } で指定してください`);
}

function readMappedSourceValue(mapping, row) {
  const sources = [mapping.source, ...(mapping.aliases ?? [])].filter(Boolean);
  for (const source of sources) {
    if (row[source] !== undefined && row[source] !== '') return row[source];
  }
  return undefined;
}

function normalizeCell(value, mapping) {
  let next = value ?? '';
  if (typeof next === 'string') next = next.trim();

  if (mapping.blankAs !== undefined && next === '') next = mapping.blankAs;
  if (mapping.normalize === 'number') return normalizeNumber(next, mapping);
  if (mapping.normalize === 'percent') return normalizePercent(next, mapping);
  if (mapping.normalize === 'status') return normalizeStatus(next, mapping);
  if (mapping.normalize === 'boolean') return normalizeBoolean(next);
  if (mapping.normalize === 'dateTime') return normalizeDateTime(next);
  return next;
}

function normalizeNumber(value, mapping) {
  if (value === '') return mapping.blankAs ?? '';
  const normalized = String(value).replaceAll(',', '').replace(/[票人議席%％]/g, '').trim();
  const number = Number(normalized);
  if (!Number.isFinite(number)) return value;
  return String(number);
}

function normalizePercent(value, mapping) {
  if (value === '') return mapping.blankAs ?? '';
  const normalized = String(value).replaceAll(',', '').replace(/[％%]/g, '').trim();
  const number = Number(normalized);
  if (!Number.isFinite(number)) return value;
  return String(number);
}

function normalizeStatus(value, mapping) {
  const text = String(value ?? '').trim();
  if (!text) return mapping.blankAs ?? mapping.default ?? '';
  const statusMap = {
    当選: 'elected',
    当確: 'elected',
    確定: 'elected',
    比例復活: 'proportionalRevival',
    復活: 'proportionalRevival',
    落選: 'runnerUp',
    惜敗: 'runnerUp',
    開票中: 'counting',
    集計中: 'counting',
    未確定: 'pending',
    未定: 'pending',
    pending: 'pending',
    counting: 'counting',
    elected: 'elected',
    proportionalRevival: 'proportionalRevival',
    runnerUp: 'runnerUp',
    candidate: 'candidate',
  };
  return mapping.statusMap?.[text] ?? statusMap[text] ?? text;
}

function normalizeBoolean(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y', '公開', '表示可'].includes(text)) return 'true';
  if (['false', '0', 'no', 'n', '準備中', '非公開'].includes(text)) return 'false';
  return value ?? '';
}

function normalizeDateTime(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString();
}

function readDelimitedRows(path, fileSchema) {
  const delimiter = fileSchema.delimiter ?? inferDelimiter(path);
  if (delimiter === ',') return readCsv(path);

  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text, delimiter).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) =>
    headers.reduce((record, header, index) => {
      record[header] = row[index] ?? '';
      return record;
    }, {}),
  );
}

function inferDelimiter(path) {
  if (path.endsWith('.tsv') || path.endsWith('.txt')) return '\t';
  return ',';
}

function isExcelPath(path) {
  return /\.(xlsx|xlsm|xls)$/i.test(path);
}

function validateNormalizedRows(fileName, rows, headers, fileSchema) {
  const requiredColumns = fileSchema.requiredColumns ?? [];
  for (const requiredColumn of requiredColumns) {
    if (!headers.includes(requiredColumn)) warnings.push(`${fileName}: schema.requiredColumns に未知列 ${requiredColumn} があります`);
  }

  rows.forEach((row, index) => {
    for (const column of requiredColumns) {
      if (row[column] === undefined || row[column] === '') warnings.push(`${fileName} row ${index + 1}: ${column} が空です`);
    }
  });
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
