import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { assertInside, assertSafeElectionId, root, toDisplayPath } from './data-utils.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const manifestPath = readOption('--manifest');
const electionId = readOption('--election') ?? readOption('--election-id');
const outputRoot = resolve(readOption('--output') ?? join(root, 'data', 'imports'));

if (!manifestPath) {
  console.error('Usage: node scripts/fetch-official-data.mjs --manifest=<manifest.json> [--election=<electionId>] [--output=<dir>] [--dry-run]');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'));
const resolvedElectionId = electionId ?? manifest.electionId;
if (!resolvedElectionId) {
  console.error('manifest.electionId または --election が必要です');
  process.exit(1);
}
assertSafeElectionId(resolvedElectionId);

const files = manifest.files ?? [];
if (!Array.isArray(files) || files.length === 0) {
  console.error('manifest.files に取得対象を1件以上指定してください');
  process.exit(1);
}

const stamp = timestamp();
const rawDir = resolve(outputRoot, resolvedElectionId, stamp, 'raw');
assertInside(outputRoot, rawDir);

console.log(`Official fetch plan: ${files.length} file(s) -> ${toDisplayPath(rawDir)}`);
if (dryRun) {
  for (const file of files) console.log(`- ${targetName(file)} <= ${file.url ?? file.path}`);
  process.exit(0);
}

mkdirSync(rawDir, { recursive: true });

for (const file of files) {
  const name = targetName(file);
  const outputPath = resolve(rawDir, name);
  assertInside(rawDir, outputPath);

  if (file.url) {
    await downloadFile(file.url, outputPath);
    console.log(`Downloaded ${file.url} -> ${toDisplayPath(outputPath)}`);
  } else if (file.path) {
    const inputPath = resolve(dirname(resolve(manifestPath)), file.path);
    if (!existsSync(inputPath)) throw new Error(`Missing source file: ${inputPath}`);
    copyFileSync(inputPath, outputPath);
    console.log(`Copied ${toDisplayPath(inputPath)} -> ${toDisplayPath(outputPath)}`);
  } else {
    throw new Error(`files[] must include url or path: ${JSON.stringify(file)}`);
  }
}

const receipt = {
  electionId: resolvedElectionId,
  fetchedAt: new Date().toISOString(),
  manifest: toDisplayPath(resolve(manifestPath)),
  rawDir: toDisplayPath(rawDir),
  files: files.map((file) => ({ name: targetName(file), source: file.url ?? file.path })),
};
writeFileSync(join(rawDir, 'fetch-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Receipt written: ${toDisplayPath(join(rawDir, 'fetch-receipt.json'))}`);

function targetName(file) {
  const rawName = file.name ?? basename(file.path ?? new URL(file.url).pathname);
  if (!rawName || rawName === '.' || rawName.includes('/') || rawName.includes('\\')) {
    throw new Error(`Invalid output file name: ${rawName}`);
  }
  return rawName;
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, buffer);
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
