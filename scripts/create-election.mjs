import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertSafeElectionId,
  publicDataRoot,
  readOptionalJson,
  sourceFileFor,
  sourceRoot,
  toDisplayPath,
  writeJson,
} from './data-utils.mjs';
import { csvTemplates } from './csv-schema.mjs';
import { writeCsvHeaders } from './csv-utils.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const makeCurrent = args.includes('--current');
const skipCsv = args.includes('--no-csv');
const electionId = args.find((arg) => !arg.startsWith('--'));

if (!electionId) {
  console.error('Usage: node scripts/create-election.mjs [--dry-run] [--current] [--no-csv] <electionId> [--name=...] [--type=...] [--status=...] [--year=...]');
  process.exit(1);
}

assertSafeElectionId(electionId);

const options = parseOptions(args);
const year = Number(options.year) || new Date().getFullYear();
const type = options.type ?? '衆議院';
const name = options.name ?? `${year} ${type}選挙`;
const status = options.status ?? 'upcoming';
const sourcePath = sourceFileFor(electionId);
const csvDir = join(sourceRoot, electionId, 'csv');

if (existsSync(sourcePath) && !dryRun) {
  console.error(`${toDisplayPath(sourcePath)} already exists.`);
  process.exit(1);
}

const activeElection = readOptionalJson(join(publicDataRoot, 'active-election.json')) ?? { currentId: electionId };
const electionsIndex = readOptionalJson(join(publicDataRoot, 'elections-index.json')) ?? { elections: [] };
const nextElections = upsertElection(electionsIndex.elections ?? [], {
  id: electionId,
  type,
  name,
  status,
  year,
  isDataReady: false,
});

const source = {
  election: {
    id: electionId,
  },
  topLevel: {
    'active-election.json': {
      currentId: makeCurrent ? electionId : activeElection.currentId,
    },
    'elections-index.json': {
      elections: nextElections,
    },
  },
  files: {
    'election-meta.json': {
      id: electionId,
      type,
      name,
      status,
      year,
      shortName: name,
      description: 'TODO: 選挙の説明を入力してください。',
      visuals: [],
    },
    'parties.json': {
      parties: [],
    },
    'members.json': {
      members: [],
    },
    'prefectures.json': {
      prefectures: [],
    },
    'districts.json': {
      districts: [],
    },
    'proportional-blocks.json': {
      proportionalBlocks: [],
    },
    'summary.json': {
      totalSeats: 0,
      districtSeats: 0,
      proportionalSeats: 0,
      reportingRate: 0,
      updatedAt: '',
      partySeats: [],
    },
    'candidates.json': {
      candidates: [],
    },
    'single-member-districts.json': {
      singleMemberDistricts: [],
    },
    'results.json': {
      proportionalSeats: [],
    },
  },
};

const plannedWrites = [sourcePath];
if (!skipCsv) {
  for (const fileName of Object.keys(csvTemplates)) {
    plannedWrites.push(join(csvDir, fileName));
  }
}

if (dryRun) {
  console.log(`Dry run: ${plannedWrites.length} file(s) would be created for ${electionId}`);
  for (const path of plannedWrites) console.log(`- ${toDisplayPath(path)}`);
  process.exit(0);
}

writeJson(sourcePath, source);

if (!skipCsv) {
  for (const [fileName, headers] of Object.entries(csvTemplates)) {
    writeCsvHeaders(join(csvDir, fileName), headers);
  }
}

console.log(`Created election source in ${toDisplayPath(sourcePath)}`);
if (!skipCsv) console.log(`Created CSV template in ${toDisplayPath(csvDir)}`);

function parseOptions(values) {
  return values.reduce((parsed, arg) => {
    if (!arg.startsWith('--') || !arg.includes('=')) return parsed;
    const [key, ...rest] = arg.slice(2).split('=');
    parsed[key] = rest.join('=');
    return parsed;
  }, {});
}

function upsertElection(elections, entry) {
  const next = elections.filter((election) => election.id !== entry.id);
  next.push(entry);
  return next;
}
