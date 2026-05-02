import { join } from 'node:path';
import { readJson, sourceFileFor, sourceRoot, toDisplayPath } from './data-utils.mjs';
import { writeCsv } from './csv-utils.mjs';
import { csvTemplates } from './csv-schema.mjs';

const electionId = process.argv[2];

if (!electionId) {
  console.error('Usage: node scripts/export-source-csv.mjs <electionId>');
  process.exit(1);
}

const source = readJson(sourceFileFor(electionId));
const csvDir = join(sourceRoot, electionId, 'csv');
const files = source.files;
const topLevel = source.topLevel ?? {};

writeSheet('top_level_active.csv', [topLevel['active-election.json'] ?? { currentId: electionId }]);
writeSheet('top_level_elections.csv', topLevel['elections-index.json']?.elections ?? []);
writeSheet('election_meta.csv', [without(files['election-meta.json'], ['visuals'])]);
writeSheet('election_visuals.csv', files['election-meta.json']?.visuals ?? []);
writeSheet('parties.csv', files['parties.json']?.parties ?? []);
writeSheet('prefectures.csv', files['prefectures.json']?.prefectures ?? []);
writeSheet('proportional_blocks.csv', files['proportional-blocks.json']?.proportionalBlocks ?? []);
writeSheet('districts.csv', files['districts.json']?.districts ?? []);
writeSheet('candidates.csv', files['candidates.json']?.candidates ?? []);
writeSheet('members.csv', files['members.json']?.members ?? []);
writeSheet('single_member_district_results.csv', flattenMapPoints(files['single-member-districts.json']?.singleMemberDistricts ?? []));
writeSheet('proportional_results.csv', flattenMapPoints(files['results.json']?.proportionalSeats ?? []));
writeSheet('summary.csv', [without(files['summary.json'], ['partySeats'])]);
writeSheet('summary_party_seats.csv', files['summary.json']?.partySeats ?? []);

console.log(`Exported CSV sheets to ${toDisplayPath(csvDir)}`);

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

function writeSheet(fileName, rows) {
  writeCsv(join(csvDir, fileName), rows, csvTemplates[fileName]);
}
