import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { electionFiles, publicDataRoot, publicElectionDir, readJson, root, sourceFileFor, stableStringify, topLevelFiles, toDisplayPath } from './data-utils.mjs';

const args = process.argv.slice(2);
const writeReport = args.includes('--write');
const failOnDiff = args.includes('--fail-on-diff');
const electionId = args.find((arg) => !arg.startsWith('--'));
const timestamp = new Date().toISOString();

if (!electionId) {
  console.error('Usage: node scripts/report-data-diff.mjs [--write] [--fail-on-diff] <electionId>');
  process.exit(1);
}

const source = readJson(sourceFileFor(electionId));
const publicFiles = {};
for (const fileName of topLevelFiles) {
  publicFiles[fileName] = readJson(join(publicDataRoot, fileName));
}
for (const fileName of electionFiles) {
  publicFiles[fileName] = readJson(join(publicElectionDir(electionId), fileName));
}

const sourceFiles = {
  ...(source.topLevel ?? {}),
  ...(source.files ?? {}),
};

const collections = [
  ['topLevel.elections', sourceFiles['elections-index.json']?.elections, publicFiles['elections-index.json']?.elections],
  ['electionMeta.visuals', sourceFiles['election-meta.json']?.visuals, publicFiles['election-meta.json']?.visuals],
  ['parties', sourceFiles['parties.json']?.parties, publicFiles['parties.json']?.parties],
  ['prefectures', sourceFiles['prefectures.json']?.prefectures, publicFiles['prefectures.json']?.prefectures],
  ['proportionalBlocks', sourceFiles['proportional-blocks.json']?.proportionalBlocks, publicFiles['proportional-blocks.json']?.proportionalBlocks],
  ['districts', sourceFiles['districts.json']?.districts, publicFiles['districts.json']?.districts],
  ['candidates', sourceFiles['candidates.json']?.candidates, publicFiles['candidates.json']?.candidates],
  ['members', sourceFiles['members.json']?.members, publicFiles['members.json']?.members],
  [
    'singleMemberDistricts',
    sourceFiles['single-member-districts.json']?.singleMemberDistricts,
    publicFiles['single-member-districts.json']?.singleMemberDistricts,
  ],
  ['proportionalSeats', sourceFiles['results.json']?.proportionalSeats, publicFiles['results.json']?.proportionalSeats],
  ['summary.partySeats', sourceFiles['summary.json']?.partySeats, publicFiles['summary.json']?.partySeats],
];

let changed = false;
const lines = [];

log(`Data diff report`);
log(`timestamp: ${timestamp}`);
log(`electionId: ${electionId}`);
log(`command: ${commandForReport()}`);
log('');
for (const [label, beforeRows = [], afterRows = []] of collections) {
  const diff = diffCollection(beforeRows, afterRows);
  if (diff.added.length || diff.removed.length || diff.updated.length) changed = true;

  log(`${label}: ${beforeRows.length} -> ${afterRows.length} (+${diff.added.length} / -${diff.removed.length} / ~${diff.updated.length})`);
  printIds('added', diff.added);
  printIds('removed', diff.removed);
  for (const item of diff.updated) {
    log(`  updated: ${item.id}: ${item.fields.join(', ')}`);
  }
}

for (const fileName of topLevelFiles) compareObject(fileName, sourceFiles[fileName], publicFiles[fileName]);
for (const fileName of electionFiles) compareObject(fileName, sourceFiles[fileName], publicFiles[fileName]);

if (!changed) log('No collection row changes detected.');

if (writeReport) {
  const reportDir = join(root, 'data', 'reports');
  const stamp = timestamp.replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
  const reportPath = join(reportDir, `${stamp}-${electionId}-diff.txt`);
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, `${lines.join('\n')}\n`);
  log(`Report written: ${toDisplayPath(reportPath)}`);
}

if (changed && failOnDiff) {
  console.error('Data diff detected.');
  process.exit(1);
}

function diffCollection(beforeRows, afterRows) {
  const before = toIdMap(beforeRows);
  const after = toIdMap(afterRows);
  const added = [];
  const removed = [];
  const updated = [];

  for (const [id, row] of after) {
    if (!before.has(id)) {
      added.push(id);
      continue;
    }

    const fields = changedFields(before.get(id), row);
    if (fields.length > 0) updated.push({ id, fields });
  }

  for (const id of before.keys()) {
    if (!after.has(id)) removed.push(id);
  }

  return { added, removed, updated };
}

function toIdMap(rows) {
  const map = new Map();
  rows.forEach((row, index) => {
    const id = row.id ?? row.partyId ?? row.currentId ?? `row-${index}`;
    if (map.has(id)) {
      changed = true;
      log(`  duplicate id: ${id}`);
    }
    map.set(id, row);
  });
  return map;
}

function changedFields(before, after) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((key) => stableStringify(before?.[key]) !== stableStringify(after?.[key]));
}

function printIds(label, ids) {
  if (ids.length > 0) log(`  ${label}: ${ids.join(', ')}`);
}

function compareObject(label, before, after) {
  if (stableStringify(before) !== stableStringify(after)) {
    changed = true;
    log(`${label}: object differs`);
  }
}

function log(message) {
  lines.push(message);
  console.log(message);
}

function commandForReport() {
  const npmScript = process.env.npm_lifecycle_event;
  if (npmScript) {
    return `npm run ${npmScript} -- ${electionId}`;
  }
  return `node ${process.argv.slice(1).join(' ')}`;
}
