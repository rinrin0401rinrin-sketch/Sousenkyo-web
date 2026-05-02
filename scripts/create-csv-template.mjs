import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { sourceRoot, toDisplayPath, assertSafeElectionId } from './data-utils.mjs';
import { writeCsvHeaders } from './csv-utils.mjs';
import { csvTemplates } from './csv-schema.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const electionId = args.find((arg) => !arg.startsWith('--'));

if (!electionId) {
  console.error('Usage: node scripts/create-csv-template.mjs [--force] <electionId>');
  process.exit(1);
}

assertSafeElectionId(electionId);

const csvDir = join(sourceRoot, electionId, 'csv');
for (const [fileName, headers] of Object.entries(csvTemplates)) {
  const path = join(csvDir, fileName);
  if (existsSync(path) && !force) {
    console.error(`${toDisplayPath(path)} already exists. Use --force to overwrite CSV templates.`);
    process.exit(1);
  }
  writeCsvHeaders(path, headers);
}

console.log(`Created CSV template in ${toDisplayPath(csvDir)}`);
