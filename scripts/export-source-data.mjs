import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  electionFiles,
  publicElectionDir,
  publicDataRoot,
  readJson,
  readOptionalJson,
  sourceFileFor,
  topLevelFiles,
  toDisplayPath,
  writeJson,
} from './data-utils.mjs';

const electionId = process.argv[2];

if (!electionId) {
  console.error('Usage: node scripts/export-source-data.mjs <electionId>');
  process.exit(1);
}

const electionDir = publicElectionDir(electionId);
if (!existsSync(electionDir)) {
  console.error(`${toDisplayPath(electionDir)} がありません`);
  process.exit(1);
}

const files = {};
for (const fileName of electionFiles) {
  const path = join(electionDir, fileName);
  files[fileName] = readJson(path);
}

const topLevel = {};
for (const fileName of topLevelFiles) {
  topLevel[fileName] = readOptionalJson(join(publicDataRoot, fileName));
}

const source = {
  schemaVersion: 1,
  generatedFrom: 'public/data',
  election: {
    id: electionId,
  },
  topLevel,
  files,
};

const outputPath = sourceFileFor(electionId);
writeJson(outputPath, source);
console.log(`Exported ${electionId} source to ${toDisplayPath(outputPath)}`);
