import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { csvTemplates } from './csv-schema.mjs';
import { writeCsv } from './csv-utils.mjs';
import { assertInside, ensureSourceShape, readJson, sourceFileFor, sourceRoot, toDisplayPath, writeJson } from './data-utils.mjs';

const args = process.argv.slice(2);
const write = args.includes('--write');
const clean = args.includes('--clean');
const options = Object.fromEntries(
  args
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => {
      const [key, value] = arg.slice(2).split('=');
      return [key, value];
    }),
);

const preset = options.preset;
if (preset !== undefined && preset !== 'smoke') {
  throw new Error(`Unknown fixture preset: ${preset}`);
}

const sourceElectionId = options.from ?? 'shugiin-50th';
const targetElectionId = options.target ?? (preset === 'smoke' ? 'shugiin-large-fixture-smoke' : 'shugiin-large-fixture');
const districtCount = toPositiveInt(options.districts, preset === 'smoke' ? 8 : 289);
const candidateCount = toPositiveInt(options.candidates, preset === 'smoke' ? 24 : 1100);
const memberCount = toPositiveInt(options.members, preset === 'smoke' ? 12 : 465);
const proportionalRowCount = toPositiveInt(options.proportional, preset === 'smoke' ? 6 : 176);

const sourcePath = sourceFileFor(sourceElectionId);
const targetPath = sourceFileFor(targetElectionId);
const targetRoot = join(sourceRoot, targetElectionId);
const csvDir = join(sourceRoot, targetElectionId, 'csv');

if (clean) {
  assertInside(sourceRoot, targetRoot);
  if (!existsSync(targetRoot)) {
    console.log(`Nothing to clean: ${toDisplayPath(targetRoot)} does not exist.`);
    process.exit(0);
  }

  if (!write) {
    console.log(`Dry run: ${toDisplayPath(targetRoot)} would be removed. Add --write to delete it.`);
    process.exit(0);
  }

  rmSync(targetRoot, { recursive: true, force: true });
  console.log(`Removed fixture source under ${toDisplayPath(targetRoot)}`);
  process.exit(0);
}

if (!existsSync(sourcePath)) {
  console.error(`${toDisplayPath(sourcePath)} がありません。--from で既存sourceの electionId を指定してください。`);
  process.exit(1);
}

const source = readJson(sourcePath);
ensureSourceShape(source, sourceElectionId);

const fixture = buildFixture(source);
ensureSourceShape(fixture, targetElectionId);

const csvSheets = toCsvSheets(fixture);
const writes = [[targetPath, fixture], ...Object.entries(csvSheets).map(([fileName, rows]) => [join(csvDir, fileName), rows])];

console.log(`${write ? 'Write' : 'Dry run'}: large fixture source from ${toDisplayPath(sourcePath)}`);
console.log(`target: ${targetElectionId}`);
console.log(
  [
    `districts=${fixture.files['districts.json'].districts.length}`,
    `candidates=${fixture.files['candidates.json'].candidates.length}`,
    `members=${fixture.files['members.json'].members.length}`,
    `singleMemberDistricts=${fixture.files['single-member-districts.json'].singleMemberDistricts.length}`,
    `proportionalSeats=${fixture.files['results.json'].proportionalSeats.length}`,
  ].join(', '),
);

for (const [path] of writes) {
  assertInside(targetRoot, path);
  console.log(`- ${toDisplayPath(path)}`);
}

if (!write) {
  console.log('No files written. Add --write to create the fixture source and CSV sheets.');
  process.exit(0);
}

writeJson(targetPath, fixture);
for (const [fileName, rows] of Object.entries(csvSheets)) {
  writeCsv(join(csvDir, fileName), rows, csvTemplates[fileName]);
}

console.log(`Created fixture source and CSV sheets under ${toDisplayPath(targetRoot)}`);

function buildFixture(baseSource) {
  const baseFiles = baseSource.files;
  const parties = clone(baseFiles['parties.json'].parties);
  const prefectures = clone(baseFiles['prefectures.json'].prefectures);
  const blocks = clone(baseFiles['proportional-blocks.json'].proportionalBlocks);

  const districts = Array.from({ length: districtCount }, (_, index) => {
    const prefecture = prefectures[index % prefectures.length];
    const districtNumber = (index % 25) + 1;
    return {
      id: `fixture-district-${pad(index + 1, 4)}`,
      name: `${prefecture.name}${districtNumber}区`,
      prefectureId: prefecture.id,
      winnerMemberId: `fixture-member-${pad((index % memberCount) + 1, 4)}`,
    };
  });

  const candidates = Array.from({ length: candidateCount }, (_, index) => {
    const district = districts[index % districts.length];
    const prefecture = prefectures.find((item) => item.id === district.prefectureId) ?? prefectures[0];
    const party = parties[index % parties.length];
    const block = blocks[index % blocks.length];
    return {
      id: `fixture-candidate-${pad(index + 1, 5)}`,
      name: `大量候補 ${pad(index + 1, 5)}`,
      partyId: party.id,
      prefectureId: prefecture.id,
      districtId: district.id,
      proportionalBlockId: block.id,
      photoUrl: '',
      profileUrl: '',
      wins: index % 9,
      status: statusFor(index),
    };
  });

  const members = Array.from({ length: memberCount }, (_, index) => {
    const candidate = candidates[index % candidates.length];
    return {
      id: `fixture-member-${pad(index + 1, 4)}`,
      name: `大量当選者 ${pad(index + 1, 4)}`,
      partyId: candidate.partyId,
      prefectureId: candidate.prefectureId,
      districtId: candidate.districtId,
      proportionalBlockId: candidate.proportionalBlockId,
      photoUrl: '',
      wins: candidate.wins,
      status: index % 5 === 0 ? 'proportionalRevival' : 'elected',
    };
  });

  const singleResults = districts.map((district, index) => {
    const candidate = candidates[index % candidates.length];
    const prefecture = prefectures.find((item) => item.id === district.prefectureId) ?? prefectures[0];
    const party = parties.find((item) => item.id === candidate.partyId) ?? parties[0];
    return {
      id: `fixture-single-${pad(index + 1, 4)}`,
      electionId: targetElectionId,
      prefectureId: prefecture.id,
      prefecture: prefecture.name,
      districtName: district.name,
      districtNumber: (index % 25) + 1,
      candidateId: candidate.id,
      candidateName: candidate.name,
      partyId: party.id,
      partyName: party.name,
      status: statusFor(index),
      votes: 45000 + index * 137,
      voteRate: round(35 + (index % 50) * 0.6),
      turnout: round(52 + (index % 30) * 0.4),
      photoUrl: '',
      profileUrl: '',
      mapPoint: mapPoint(index),
    };
  });

  const proportionalSeats = Array.from({ length: proportionalRowCount }, (_, index) => {
    const block = blocks[index % blocks.length];
    const party = parties[index % parties.length];
    return {
      id: `fixture-proportional-${pad(index + 1, 4)}`,
      electionId: targetElectionId,
      blockId: block.id,
      blockName: block.name,
      partyId: party.id,
      partyName: party.name,
      status: statusFor(index + 2),
      seats: (index % 4) + 1,
      voteRate: round(8 + (index % 25) * 0.7),
      turnout: round(51 + (index % 20) * 0.5),
      mapPoint: mapPoint(index + districtCount),
    };
  });

  const partySeats = parties.map((party) => ({
    partyId: party.id,
    seats:
      singleResults.filter((result) => result.partyId === party.id && ['elected', 'proportionalRevival'].includes(result.status)).length +
      proportionalSeats
        .filter((result) => result.partyId === party.id && ['elected', 'proportionalRevival'].includes(result.status))
        .reduce((total, result) => total + result.seats, 0),
  }));

  const proportionalSeatsTotal = proportionalSeats.reduce((total, row) => total + row.seats, 0);
  const topLevelElection = {
    id: targetElectionId,
    type: baseSource.election?.type ?? baseFiles['election-meta.json'].type,
    name: '大量データ検証用フィクスチャ',
    status: 'fixture',
    year: baseFiles['election-meta.json'].year,
    isDataReady: false,
  };

  return {
    schemaVersion: baseSource.schemaVersion ?? 1,
    generatedFrom: 'large-fixture',
    election: { id: targetElectionId },
    topLevel: {
      'active-election.json': baseSource.topLevel?.['active-election.json'] ?? { currentId: sourceElectionId },
      'elections-index.json': {
        elections: [
          ...(baseSource.topLevel?.['elections-index.json']?.elections ?? []).filter((item) => item.id !== targetElectionId),
          topLevelElection,
        ],
      },
    },
    files: {
      'election-meta.json': {
        ...baseFiles['election-meta.json'],
        id: targetElectionId,
        name: topLevelElection.name,
        shortName: '大量検証',
        description: 'CSV/Excel入力と公開データ生成を実運用件数に近い行数で確認するためのフィクスチャです。',
        visuals: [],
      },
      'parties.json': { parties },
      'members.json': { members },
      'prefectures.json': { prefectures },
      'districts.json': { districts },
      'proportional-blocks.json': { proportionalBlocks: blocks },
      'summary.json': {
        totalSeats: districtCount + proportionalSeatsTotal,
        districtSeats: districtCount,
        proportionalSeats: proportionalSeatsTotal,
        reportingRate: 100,
        updatedAt: new Date().toISOString(),
        partySeats,
      },
      'candidates.json': { candidates },
      'single-member-districts.json': { singleMemberDistricts: singleResults },
      'results.json': { proportionalSeats },
    },
  };
}

function toCsvSheets(source) {
  const files = source.files;
  const topLevel = source.topLevel ?? {};
  return {
    'top_level_active.csv': [topLevel['active-election.json'] ?? { currentId: sourceElectionId }],
    'top_level_elections.csv': topLevel['elections-index.json']?.elections ?? [],
    'election_meta.csv': [without(files['election-meta.json'], ['visuals'])],
    'election_visuals.csv': files['election-meta.json']?.visuals ?? [],
    'parties.csv': files['parties.json']?.parties ?? [],
    'prefectures.csv': files['prefectures.json']?.prefectures ?? [],
    'proportional_blocks.csv': files['proportional-blocks.json']?.proportionalBlocks ?? [],
    'districts.csv': files['districts.json']?.districts ?? [],
    'candidates.csv': files['candidates.json']?.candidates ?? [],
    'members.csv': files['members.json']?.members ?? [],
    'single_member_district_results.csv': flattenMapPoints(files['single-member-districts.json']?.singleMemberDistricts ?? []),
    'proportional_results.csv': flattenMapPoints(files['results.json']?.proportionalSeats ?? []),
    'summary.csv': [without(files['summary.json'], ['partySeats'])],
    'summary_party_seats.csv': files['summary.json']?.partySeats ?? [],
  };
}

function without(record = {}, keys) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
}

function flattenMapPoints(rows) {
  return rows.map(({ mapPoint, ...row }) => ({
    ...row,
    mapX: mapPoint?.x,
    mapY: mapPoint?.y,
    mapZ: mapPoint?.z,
  }));
}

function mapPoint(index) {
  return {
    x: round(122 + (index % 42) * 0.55),
    y: round(24 + (index % 36) * 0.62),
    z: round(4 + (index % 8) * 0.15),
  };
}

function statusFor(index) {
  return ['elected', 'proportionalRevival', 'runnerUp', 'counting', 'pending'][index % 5];
}

function toPositiveInt(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got: ${value}`);
  }
  return parsed;
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
