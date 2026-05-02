import { join } from 'node:path';
import { ensureSourceShape, sourceFileFor, sourceRoot, toDisplayPath, writeJson } from './data-utils.mjs';
import { omitEmpty, readCsv, toBoolean, toNumber, validateCsvHeaders } from './csv-utils.mjs';
import { csvTemplates } from './csv-schema.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const electionId = args.find((arg) => !arg.startsWith('--'));

if (!electionId) {
  console.error('Usage: node scripts/import-source-csv.mjs [--dry-run] <electionId>');
  process.exit(1);
}

const csvDir = join(sourceRoot, electionId, 'csv');
const sourcePath = sourceFileFor(electionId);

const active = firstRow('top_level_active.csv', { currentId: electionId });
const elections = rows('top_level_elections.csv').map((row) => normalizeNumbers(row, ['year'], ['isDataReady']));
const meta = {
  ...normalizeNumbers(firstRow('election_meta.csv', { id: electionId }), ['year']),
  visuals: rows('election_visuals.csv'),
};
const summary = {
  ...normalizeNumbers(firstRow('summary.csv', {}), ['totalSeats', 'districtSeats', 'proportionalSeats', 'reportingRate']),
  partySeats: rows('summary_party_seats.csv').map((row) => normalizeNumbers(row, ['seats'])),
};

const source = {
  schemaVersion: 1,
  generatedFrom: 'csv',
  election: { id: electionId },
  topLevel: {
    'active-election.json': active,
    'elections-index.json': {
      elections,
    },
  },
  files: {
    'election-meta.json': meta,
    'parties.json': {
      parties: rows('parties.csv'),
    },
    'members.json': {
      members: rows('members.csv').map((row) => normalizeNumbers(row, ['wins'])),
    },
    'prefectures.json': {
      prefectures: rows('prefectures.csv').map((row) => normalizeNumbers(row, ['districtCount'])),
    },
    'districts.json': {
      districts: rows('districts.csv'),
    },
    'proportional-blocks.json': {
      proportionalBlocks: rows('proportional_blocks.csv').map((row) => normalizeNumbers(row, ['seats'])),
    },
    'summary.json': summary,
    'candidates.json': {
      candidates: rows('candidates.csv').map((row) => normalizeNumbers(row, ['wins'])),
    },
    'single-member-districts.json': {
      singleMemberDistricts: rows('single_member_district_results.csv').map((row) =>
        normalizeResult(row, ['districtNumber', 'votes', 'voteRate', 'turnout']),
      ),
    },
    'results.json': {
      proportionalSeats: rows('proportional_results.csv').map((row) =>
        normalizeResult(row, ['seats', 'voteRate', 'turnout']),
      ),
    },
  },
};

ensureSourceShape(source, electionId);

if (dryRun) {
  console.log(`Dry run: ${toDisplayPath(sourcePath)} would be written from ${toDisplayPath(csvDir)}`);
  process.exit(0);
}

writeJson(sourcePath, source);
console.log(`Imported CSV sheets from ${toDisplayPath(csvDir)} to ${toDisplayPath(sourcePath)}`);

function rows(fileName) {
  const path = join(csvDir, fileName);
  validateCsvHeaders(path, csvTemplates[fileName]);
  return readCsv(path).map(omitEmpty);
}

function firstRow(fileName, fallback) {
  return rows(fileName)[0] ?? fallback;
}

function normalizeNumbers(row, numberKeys, booleanKeys = []) {
  const next = { ...row };
  for (const key of numberKeys) {
    if (key in next) next[key] = toNumber(next[key]);
  }
  for (const key of booleanKeys) {
    if (key in next) next[key] = toBoolean(next[key]);
  }
  return omitEmpty(next);
}

function normalizeResult(row, numberKeys) {
  const normalized = normalizeNumbers(row, [...numberKeys, 'mapX', 'mapY', 'mapZ']);
  const { mapX, mapY, mapZ, ...result } = normalized;
  return omitEmpty({
    ...result,
    mapPoint: omitEmpty({
      x: mapX,
      y: mapY,
      z: mapZ,
    }),
  });
}
