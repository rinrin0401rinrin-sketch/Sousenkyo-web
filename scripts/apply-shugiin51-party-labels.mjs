import { join } from 'node:path';
import { readCsv, writeCsv } from './csv-utils.mjs';
import { root } from './data-utils.mjs';
import { glossaryCsvHeaders } from './glossary-schema.mjs';

const dryRun = process.argv.includes('--dry-run');
const csvDir = join(root, 'data', 'source', 'glossary', 'csv');
const candidatesPath = join(csvDir, 'candidates.csv');
const partiesPath = join(csvDir, 'parties.csv');

const partyNames = new Map([
  ['自民', '自由民主党'],
  ['立民', '立憲民主党'],
  ['維新', '日本維新の会'],
  ['国民', '国民民主党'],
  ['公明', '公明党'],
  ['共産', '日本共産党'],
  ['れいわ', 'れいわ新選組'],
  ['参政', '参政党'],
  ['保守', '日本保守党'],
  ['社民', '社会民主党'],
  ['無所属', '無所属'],
  ['みらい', 'みらい'],
  ['ゆうこく', 'ゆうこく'],
]);

const partyNameById = new Map([
  ['akaba-kazuyoshi', '公明党'],
  ['candidate-029', '公明党'],
  ['candidate-030', '公明党'],
  ['candidate-054', '公明党'],
  ['candidate-067', '公明党'],
  ['candidate-096', '公明党'],
  ['candidate-105', '公明党'],
  ['candidate-136', '公明党'],
  ['candidate-146', '公明党'],
  ['candidate-151', '公明党'],
  ['candidate-165', '公明党'],
  ['candidate-182', '公明党'],
  ['candidate-197', '公明党'],
  ['candidate-209', '公明党'],
  ['candidate-267', '公明党'],
  ['candidate-278', '公明党'],
  ['candidate-279', '公明党'],
  ['candidate-295', '公明党'],
  ['candidate-311', '公明党'],
  ['candidate-341', '公明党'],
  ['candidate-350', '公明党'],
  ['candidate-352', '公明党'],
  ['candidate-435', '公明党'],
  ['candidate-450', '公明党'],
]);

const partyRows = [
  ['party-ldp', '自由民主党', 'じゆうみんしゅとう'],
  ['party-cdp', '立憲民主党', 'りっけんみんしゅとう'],
  ['party-komeito', '公明党', 'こうめいとう'],
  ['party-ishin', '日本維新の会', 'にっぽんいしんのかい'],
  ['party-dpfp', '国民民主党', 'こくみんみんしゅとう'],
  ['party-jcp', '日本共産党', 'にほんきょうさんとう'],
  ['party-reiwa', 'れいわ新選組', 'れいわしんせんぐみ'],
  ['party-sanseito', '参政党', 'さんせいとう'],
  ['party-conservative', '日本保守党', 'にほんほしゅとう'],
  ['party-sdp', '社会民主党', 'しゃかいみんしゅとう'],
  ['party-independent', '無所属', 'むしょぞく'],
  ['party-mirai', 'みらい', 'みらい'],
  ['party-yuukoku', 'ゆうこく', 'ゆうこく'],
].map(([id, label, reading]) => ({
  id,
  label,
  category: 'party',
  reading,
  description: '第51回単語帳で使用する政党名です。',
  electionIds: 'shugiin-51st',
  relatedIds: '',
  photoUrl: '',
  districtLabel: '',
  partyLabel: '',
  statusLabel: '',
  age: '',
  wins: '',
  seatType: '',
  reviewStatus: 'ok',
}));

const candidates = readCsv(candidatesPath);
let changed = 0;
const unknown = new Set();
const knownPartyNames = new Set([...partyNames.values(), '立憲民主党', '公明党']);

for (const row of candidates) {
  const before = row.partyLabel;
  row.partyLabel = partyNameById.get(row.id) ?? partyNames.get(row.partyLabel) ?? row.partyLabel;
  if (row.partyLabel === '中道') row.partyLabel = '立憲民主党';
  if (!knownPartyNames.has(row.partyLabel)) unknown.add(row.partyLabel);
  row.description = buildDescription(row);
  if (before !== row.partyLabel) changed += 1;
}

const existingPartyRows = readCsv(partiesPath).filter((row) => !String(row.electionIds ?? '').split('|').includes('shugiin-51st'));
const nextParties = [...existingPartyRows, ...partyRows];

if (dryRun) {
  console.log(`Dry run: ${changed} candidate party label(s) would be updated.`);
  console.log(`Dry run: ${partyRows.length} shugiin-51st party master row(s) would be written.`);
  if (unknown.size > 0) console.log(`Unknown party label(s): ${[...unknown].join(', ')}`);
  process.exit(unknown.size > 0 ? 1 : 0);
}

if (unknown.size > 0) {
  console.error(`Unknown party label(s): ${[...unknown].join(', ')}`);
  process.exit(1);
}

writeCsv(candidatesPath, candidates, glossaryCsvHeaders);
writeCsv(partiesPath, nextParties, glossaryCsvHeaders);
console.log(`Updated ${changed} candidate party label(s).`);
console.log(`Wrote ${partyRows.length} shugiin-51st party master row(s).`);

function buildDescription(row) {
  return [
    row.districtLabel,
    row.partyLabel,
    row.statusLabel,
    row.wins ? `当選${row.wins}回` : '',
    row.age ? `${row.age}歳` : '',
  ].filter(Boolean).join(' / ');
}
