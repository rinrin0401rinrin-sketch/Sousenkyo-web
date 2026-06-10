import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readCsv } from './csv-utils.mjs';
import { readJson, root, sourceFileFor, writeJson } from './data-utils.mjs';

const electionId = 'shugiin-51st';
const glossaryCsvDir = join(root, 'data', 'source', 'glossary', 'csv');
const candidatesPath = join(glossaryCsvDir, 'candidates.csv');
const partiesPath = join(glossaryCsvDir, 'parties.csv');
const publicDataRoot = join(root, 'public', 'data');
const activePath = join(publicDataRoot, 'active-election.json');
const indexPath = join(publicDataRoot, 'elections-index.json');
const dryRun = process.argv.includes('--dry-run');

const partyColors = new Map([
  ['自由民主党', '#2563eb'],
  ['立憲民主党', '#ef4444'],
  ['公明党', '#f59e0b'],
  ['日本維新の会', '#22c55e'],
  ['国民民主党', '#f97316'],
  ['日本共産党', '#dc2626'],
  ['れいわ新選組', '#e11d48'],
  ['参政党', '#f59e0b'],
  ['日本保守党', '#0f766e'],
  ['社会民主党', '#ec4899'],
  ['無所属', '#64748b'],
  ['みらい', '#7c3aed'],
  ['ゆうこく', '#334155'],
]);

const prefectures = [
  ['hokkaido', '北海道', '北海道', 72, 12],
  ['aomori', '青森', '東北', 66, 22],
  ['iwate', '岩手', '東北', 70, 26],
  ['miyagi', '宮城', '東北', 74, 31],
  ['akita', '秋田', '東北', 68, 33],
  ['yamagata', '山形', '東北', 72, 37],
  ['fukushima', '福島', '東北', 76, 42],
  ['ibaraki', '茨城', '関東', 75, 52],
  ['tochigi', '栃木', '関東', 70, 54],
  ['gunma', '群馬', '関東', 66, 56],
  ['saitama', '埼玉', '関東', 64, 62],
  ['chiba', '千葉', '関東', 72, 64],
  ['tokyo', '東京', '関東', 66, 69],
  ['kanagawa', '神奈川', '関東', 61, 73],
  ['niigata', '新潟', '北陸信越', 58, 45],
  ['toyama', '富山', '北陸信越', 51, 52],
  ['ishikawa', '石川', '北陸信越', 48, 55],
  ['fukui', '福井', '北陸信越', 50, 59],
  ['yamanashi', '山梨', '中部', 58, 66],
  ['nagano', '長野', '北陸信越', 55, 62],
  ['gifu', '岐阜', '東海', 51, 66],
  ['shizuoka', '静岡', '東海', 56, 72],
  ['aichi', '愛知', '東海', 49, 72],
  ['mie', '三重', '東海', 47, 76],
  ['shiga', '滋賀', '近畿', 43, 68],
  ['kyoto', '京都', '近畿', 40, 70],
  ['osaka', '大阪', '近畿', 38, 75],
  ['hyogo', '兵庫', '近畿', 35, 72],
  ['nara', '奈良', '近畿', 40, 78],
  ['wakayama', '和歌山', '近畿', 37, 82],
  ['tottori', '鳥取', '中国', 31, 64],
  ['shimane', '島根', '中国', 27, 66],
  ['okayama', '岡山', '中国', 31, 70],
  ['hiroshima', '広島', '中国', 27, 72],
  ['yamaguchi', '山口', '中国', 23, 76],
  ['tokushima', '徳島', '四国', 34, 84],
  ['kagawa', '香川', '四国', 31, 82],
  ['ehime', '愛媛', '四国', 27, 84],
  ['kochi', '高知', '四国', 30, 88],
  ['fukuoka', '福岡', '九州', 21, 84],
  ['saga', '佐賀', '九州', 17, 82],
  ['nagasaki', '長崎', '九州', 13, 85],
  ['kumamoto', '熊本', '九州', 17, 88],
  ['oita', '大分', '九州', 22, 89],
  ['miyazaki', '宮崎', '九州', 20, 93],
  ['kagoshima', '鹿児島', '九州', 15, 94],
  ['okinawa', '沖縄', '九州', 29, 98],
].map(([id, name, region, x, y]) => ({ id, name, region, x, y }));

const blockConfigs = [
  ['hokkaido-block', '北海道', '北海道', 'hokkaido', 72, 13],
  ['tohoku-block', '東北', '東北', 'miyagi', 70, 32],
  ['kitakanto-block', '北関東', '北関東', 'saitama', 65, 57],
  ['minamikanto-block', '南関東', '南関東', 'kanagawa', 66, 72],
  ['tokyo-block', '東京', '東京', 'tokyo', 67, 68],
  ['hokuriku-shinetsu-block', '北陸信越', '北信越', 'niigata', 55, 50],
  ['tokai-block', '東海', '東海', 'aichi', 50, 72],
  ['kinki-block', '近畿', '近畿', 'osaka', 38, 75],
  ['chugoku-block', '中国', '中国', 'hiroshima', 27, 72],
  ['shikoku-block', '四国', '四国', 'kagawa', 31, 84],
  ['kyushu-block', '九州', '九州', 'fukuoka', 21, 84],
].map(([id, name, labelKey, representativePrefectureId, x, y]) => ({
  id,
  name,
  labelKey,
  representativePrefectureId,
  x,
  y,
}));

const prefectureByName = new Map(prefectures.map((prefecture) => [prefecture.name, prefecture]));
const blockByLabel = new Map(blockConfigs.flatMap((block) => [
  [`比${block.labelKey}`, block],
  [`比例${block.labelKey}`, block],
  [block.name, block],
]));

const candidates = readCsv(candidatesPath).filter((row) => row.category === 'candidate' && hasElection(row, electionId));
const partyRows = readCsv(partiesPath).filter((row) => row.category === 'party' && hasElection(row, electionId));

if (candidates.length === 0) throw new Error(`${candidatesPath} に ${electionId} の候補者がありません`);
if (partyRows.length === 0) throw new Error(`${partiesPath} に ${electionId} の政党がありません`);

const partyByLabel = new Map(
  partyRows.map((row) => [
    row.label,
    {
      id: row.id,
      name: row.label,
      shortName: toShortPartyName(row.label),
      color: partyColors.get(row.label) ?? '#64748b',
    },
  ]),
);

const districtMap = new Map();
const blockPartySeats = new Map();
const members = [];
const electionCandidates = [];
const singleMemberDistricts = [];
const issues = [];

for (const [index, row] of candidates.entries()) {
  if (row.reviewStatus && row.reviewStatus !== 'ok') {
    issues.push(`${row.id}: reviewStatus が ok ではありません (${row.reviewStatus})`);
  }

  const party = partyByLabel.get(row.partyLabel);
  if (!party) {
    issues.push(`${row.id}: partyLabel "${row.partyLabel}" が parties.csv にありません`);
    continue;
  }

  const seatType = row.seatType || (row.districtLabel?.startsWith('比') ? '比例' : '小選挙区');
  const districtInfo = seatType === '比例' ? undefined : parseDistrictLabel(row.districtLabel);
  const block = seatType === '比例' ? parseBlockLabel(row.districtLabel) : undefined;
  const prefectureId = districtInfo?.prefecture.id ?? block?.representativePrefectureId;

  if (!prefectureId) {
    issues.push(`${row.id}: districtLabel "${row.districtLabel}" から都道府県/比例ブロックを判定できません`);
    continue;
  }

  const districtId = districtInfo ? `${districtInfo.prefecture.id}-${districtInfo.number}` : undefined;
  if (districtInfo && !districtMap.has(districtId)) {
    districtMap.set(districtId, {
      id: districtId,
      name: row.districtLabel,
      prefectureId,
    });
  }

  const wins = toNumber(row.wins) ?? 0;
  const baseRecord = {
    id: row.id,
    name: row.label,
    partyId: party.id,
    prefectureId,
    ...(districtId ? { districtId } : {}),
    ...(block ? { proportionalBlockId: block.id } : {}),
    ...(row.photoUrl ? { photoUrl: row.photoUrl } : {}),
    wins,
  };

  members.push({
    ...baseRecord,
    status: 'candidate',
  });

  electionCandidates.push({
    ...baseRecord,
    profileUrl: '#',
  });

  if (districtInfo) {
    singleMemberDistricts.push({
      id: `${districtId}-${row.id}`,
      electionId,
      prefectureId,
      prefecture: districtInfo.prefecture.name,
      districtName: row.districtLabel,
      districtNumber: districtInfo.number,
      candidateId: row.id,
      candidateName: row.label,
      partyId: party.id,
      partyName: party.name,
      status: 'pending',
      votes: 0,
      voteRate: 0,
      turnout: 0,
      ...(row.photoUrl ? { photoUrl: row.photoUrl } : {}),
      profileUrl: '#',
      mapPoint: mapPointForPrefecture(districtInfo.prefecture, index),
    });
  } else if (block) {
    const key = `${block.id}::${party.id}`;
    blockPartySeats.set(key, {
      block,
      party,
      seats: (blockPartySeats.get(key)?.seats ?? 0) + 1,
    });
  }
}

if (issues.length > 0) {
  console.error(issues.join('\n'));
  process.exit(1);
}

const singleSeats = singleMemberDistricts.length;
const proportionalSeats = candidates.length - singleSeats;
const source = {
  election: { id: electionId },
  files: {
    'election-meta.json': buildMeta(),
    'parties.json': { parties: [...partyByLabel.values()] },
    'members.json': { members },
    'prefectures.json': {
      prefectures: prefectures.map(({ id, name, region }) => ({
        id,
        name,
        region,
        districtCount: singleMemberDistricts.filter((result) => result.prefectureId === id).length,
      })),
    },
    'districts.json': { districts: [...districtMap.values()].sort(compareDistricts) },
    'proportional-blocks.json': {
      proportionalBlocks: blockConfigs.map((block) => ({
        id: block.id,
        name: block.name,
        seats: [...blockPartySeats.values()]
          .filter((entry) => entry.block.id === block.id)
          .reduce((sum, entry) => sum + entry.seats, 0),
      })),
    },
    'summary.json': {
      totalSeats: candidates.length,
      districtSeats: singleSeats,
      proportionalSeats,
      reportingRate: 0,
      updatedAt: '2026-06-03T00:00:00+09:00',
      partySeats: [],
    },
    'candidates.json': { candidates: electionCandidates },
    'single-member-districts.json': {
      singleMemberDistricts: singleMemberDistricts.sort(compareResultDistricts),
    },
    'results.json': {
      proportionalSeats: [...blockPartySeats.values()]
        .map((entry, index) => ({
          id: `${entry.block.id}-${entry.party.id}`,
          electionId,
          blockId: entry.block.id,
          blockName: entry.block.name,
          partyId: entry.party.id,
          partyName: entry.party.name,
          status: 'pending',
          seats: entry.seats,
          voteRate: 0,
          turnout: 0,
          mapPoint: {
            x: entry.block.x + (index % 5) * 0.5,
            y: entry.block.y + Math.floor(index / 5) * 0.5,
            z: 1,
          },
        }))
        .sort((left, right) => left.blockId.localeCompare(right.blockId) || left.partyId.localeCompare(right.partyId)),
    },
  },
  topLevel: {
    'active-election.json': { currentId: electionId },
    'elections-index.json': buildElectionsIndex(),
  },
};

const outputPath = sourceFileFor(electionId);
if (dryRun) {
  console.log(`Dry run: ${outputPath.replace(`${root}/`, '')} would be written`);
  console.log(`- candidates/members: ${candidates.length}`);
  console.log(`- single-member districts: ${singleSeats}`);
  console.log(`- proportional seats: ${proportionalSeats}`);
  console.log(`- parties: ${partyByLabel.size}`);
  process.exit(0);
}

writeJson(outputPath, source);
console.log(`Wrote ${outputPath.replace(`${root}/`, '')}`);
console.log(`- candidates/members: ${candidates.length}`);
console.log(`- single-member districts: ${singleSeats}`);
console.log(`- proportional seats: ${proportionalSeats}`);
console.log(`- parties: ${partyByLabel.size}`);

function buildMeta() {
  return {
    id: electionId,
    type: '衆議院',
    name: '第51回 衆議院総選挙',
    shortName: '衆院選 第51回',
    status: 'current',
    year: 2028,
    isDataReady: true,
    description:
      '第51回衆議院総選挙の当選者一覧をもとに、候補者名、政党、選挙区、比例区分、写真をJSONで差し替えられる選挙特番風ダッシュボードです。',
    visuals: [
      {
        id: 'main-hero-ballot',
        role: 'hero',
        title: '未来の一票を預かる透明な投票箱',
        description: '総選挙サイトのファーストビューに使う、投票箱と投票用紙の高級感あるビジュアル。',
        imageUrl: '/data/shugiin-50th/visuals/election-main-hero-ballot.png',
        alt: '透明な投票箱と投票用紙を中心にした衆議院総選挙のヒーロービジュアル',
      },
      {
        id: 'data-dashboard',
        role: 'analytics',
        title: 'データで見る選挙',
        description: '議席、投票率、開票率などを扱う分析セクション向けのガラスUIビジュアル。',
        imageUrl: '/data/shugiin-50th/visuals/election-data-dashboard-hero.png',
        alt: '議席や投票率の分析を表すガラスUIの選挙データダッシュボード',
      },
      {
        id: 'homepage-ui',
        role: 'overview',
        title: '選挙ポータル全体像',
        description: 'トップページの構成や主要カードを示すWeb UIモックアップ。',
        imageUrl: '/data/shugiin-50th/visuals/election-homepage-ui-wide.png',
        alt: '衆議院総選挙サイトのトップページを表す白基調のWeb UI',
      },
    ],
  };
}

function buildElectionsIndex() {
  const currentIndex = existsSync(indexPath) ? readJson(indexPath) : { elections: [] };
  const seen = new Set();
  const elections = currentIndex.elections
    .map((item) => {
      if (item.id === electionId) {
        seen.add(item.id);
        return {
          ...item,
          name: '第51回 衆議院総選挙',
          type: '衆議院',
          status: 'current',
          year: item.year ?? 2028,
          isDataReady: true,
        };
      }

      if (item.id === 'shugiin-50th') {
        seen.add(item.id);
        return {
          ...item,
          status: 'past',
          isDataReady: true,
        };
      }

      seen.add(item.id);
      return item;
    });

  if (!seen.has(electionId)) {
    elections.unshift({
      id: electionId,
      type: '衆議院',
      name: '第51回 衆議院総選挙',
      status: 'current',
      year: 2028,
      isDataReady: true,
    });
  }

  if (!seen.has('shugiin-50th')) {
    elections.push({
      id: 'shugiin-50th',
      type: '衆議院',
      name: '第50回 衆議院総選挙',
      status: 'past',
      year: 2024,
      isDataReady: true,
    });
  }

  return { elections };
}

function hasElection(row, id) {
  return String(row.electionIds ?? '').split('|').includes(id);
}

function parseDistrictLabel(label) {
  const text = String(label ?? '');
  const prefecture = prefectures.find((item) => text.startsWith(item.name));
  const number = Number(text.match(/(\d+)区/)?.[1]);
  if (!prefecture || !Number.isFinite(number)) return undefined;
  return { prefecture, number };
}

function parseBlockLabel(label) {
  return blockByLabel.get(String(label ?? ''));
}

function mapPointForPrefecture(prefecture, index) {
  return {
    x: prefecture.x + (index % 4) * 0.45,
    y: prefecture.y + Math.floor(index % 12 / 4) * 0.45,
    z: 1,
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toShortPartyName(label) {
  return (
    {
      自由民主党: '自民',
      立憲民主党: '立憲',
      公明党: '公明',
      日本維新の会: '維新',
      国民民主党: '国民',
      日本共産党: '共産',
      れいわ新選組: 'れいわ',
      参政党: '参政',
      日本保守党: '保守',
      社会民主党: '社民',
      無所属: '無',
    }[label] ?? label
  );
}

function compareDistricts(left, right) {
  return comparePrefectureDistrict(left.prefectureId, left.name, right.prefectureId, right.name);
}

function compareResultDistricts(left, right) {
  return comparePrefectureDistrict(left.prefectureId, left.districtName, right.prefectureId, right.districtName);
}

function comparePrefectureDistrict(leftPrefectureId, leftName, rightPrefectureId, rightName) {
  const leftPrefIndex = prefectures.findIndex((item) => item.id === leftPrefectureId);
  const rightPrefIndex = prefectures.findIndex((item) => item.id === rightPrefectureId);
  if (leftPrefIndex !== rightPrefIndex) return leftPrefIndex - rightPrefIndex;
  return districtNumber(leftName) - districtNumber(rightName);
}

function districtNumber(name) {
  return Number(String(name).match(/(\d+)区/)?.[1] ?? 0);
}
