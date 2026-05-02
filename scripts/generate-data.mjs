import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertInside,
  electionFiles,
  ensureSourceShape,
  publicDataRoot,
  publicElectionDir,
  readJson,
  sourceFileFor,
  toDisplayPath,
  topLevelFiles,
  writeJson,
} from './data-utils.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const electionId = args.find((arg) => !arg.startsWith('--'));

if (!electionId) {
  console.error('Usage: node scripts/generate-data.mjs [--dry-run] <electionId>');
  process.exit(1);
}

const sourcePath = sourceFileFor(electionId);
if (!existsSync(sourcePath)) {
  console.error(`${toDisplayPath(sourcePath)} がありません。先に npm run export:source -- ${electionId} を実行してください。`);
  process.exit(1);
}

const source = readJson(sourcePath);
ensureSourceShape(source, electionId);

const writes = [];

for (const fileName of topLevelFiles) {
  const value = source.topLevel?.[fileName];
  if (!value) continue;

  const outputPath = join(publicDataRoot, fileName);
  assertInside(publicDataRoot, outputPath);
  writes.push([outputPath, value]);
}

const electionDir = publicElectionDir(electionId);
for (const fileName of electionFiles) {
  const outputPath = join(electionDir, fileName);
  assertInside(electionDir, outputPath);
  writes.push([outputPath, source.files[fileName]]);
}

if (dryRun) {
  console.log(`Dry run: ${writes.length} file(s) would be generated from ${toDisplayPath(sourcePath)}`);
  for (const [outputPath] of writes) console.log(`- ${toDisplayPath(outputPath)}`);
  process.exit(0);
}

for (const [outputPath, value] of writes) {
  writeJson(outputPath, value);
}

console.log(`Generated ${writes.length} file(s) from ${toDisplayPath(sourcePath)}`);
