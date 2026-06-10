import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { glossaryCsvHeaders, glossaryFiles } from './glossary-schema.mjs';
import { readCsv, validateCsvHeaders } from './csv-utils.mjs';

const root = process.cwd();
const dataRoot = join(root, 'public', 'data');
const statuses = new Set(['elected', 'proportionalRevival', 'runnerUp', 'counting', 'pending']);
const confirmedStatuses = new Set(['elected', 'proportionalRevival']);
const strict = process.argv.includes('--strict');
const errors = [];
const warnings = [];
const infos = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(`${relative(path)} をJSONとして読めません: ${error.message}`);
    return undefined;
  }
}

function relative(path) {
  return path.replace(`${root}/`, '');
}

function ensureArray(value, label) {
  if (Array.isArray(value)) return value;
  errors.push(`${label} は配列である必要があります`);
  return [];
}

function requireString(value, label) {
  if (typeof value === 'string' && value.trim()) return true;
  errors.push(`${label} は必須文字列です`);
  return false;
}

function requireNumber(value, label) {
  if (typeof value === 'number' && Number.isFinite(value)) return true;
  errors.push(`${label} は数値である必要があります`);
  return false;
}

function requireUnique(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) errors.push(`${label}: id "${item.id}" が重複しています`);
    seen.add(item.id);
  }
}

function requireRef(set, value, label) {
  if (typeof value !== 'string' || !set.has(value)) {
    errors.push(`${label}: "${value ?? '未設定'}" が参照先に存在しません`);
  }
}

function warnRef(set, value, label) {
  if (value && !set.has(value)) warnings.push(`${label}: "${value}" が参照先に存在しません`);
}

function validateMapPoint(point, label) {
  if (!point || typeof point !== 'object') {
    errors.push(`${label}.mapPoint は必須です`);
    return;
  }
  requireNumber(point.x, `${label}.mapPoint.x`);
  requireNumber(point.y, `${label}.mapPoint.y`);
  if (point.z !== undefined) requireNumber(point.z, `${label}.mapPoint.z`);
}

function validateLocalAsset(path, label, options = {}) {
  if (!path) return;
  if (typeof path !== 'string') {
    errors.push(`${label} は文字列パスである必要があります`);
    return;
  }
  if (/^(https?:|data:|javascript:)/i.test(path)) {
    errors.push(`${label}: 外部URLやdata/javascript URLは使わず、/data/... の公開資産を指定してください`);
    return;
  }
  if (path.startsWith('/data/')) {
    const assetPath = join(root, 'public', path.replace(/^\//, ''));
    if (!existsSync(assetPath)) {
      warnings.push(`${label}: ${path} の実ファイルが見つかりません`);
      return;
    }
    validateImageAsset(assetPath, label, options);
  }
}

function validateImageAsset(assetPath, label, options) {
  const bytes = readFileSync(assetPath);
  const format = detectImageFormat(bytes);
  const extension = assetPath.split('.').pop()?.toLowerCase();
  const allowedFormats = options.allowedFormats ?? ['png', 'jpg', 'jpeg', 'svg', 'webp'];
  const sizeLimitBytes = options.sizeLimitBytes;

  if (!format) {
    warnings.push(`${label}: 画像形式を判定できません`);
    return;
  }

  if (!allowedFormats.includes(format)) {
    warnings.push(`${label}: ${format} は許可形式ではありません (${allowedFormats.join(', ')})`);
  }

  if (extension === 'jpg' && format !== 'jpeg') warnings.push(`${label}: 拡張子と画像形式が一致しません`);
  if (extension && extension !== 'jpg' && extension !== format) warnings.push(`${label}: 拡張子と画像形式が一致しません`);

  if (sizeLimitBytes && statSync(assetPath).size > sizeLimitBytes) {
    warnings.push(`${label}: ファイルサイズが ${Math.round(sizeLimitBytes / 1024 / 1024)}MB を超えています`);
  }

  const dimensions = readImageDimensions(bytes, format);
  if (!dimensions) return;
  if (options.minWidth && dimensions.width < options.minWidth) warnings.push(`${label}: 幅が ${options.minWidth}px 未満です`);
  if (options.minHeight && dimensions.height < options.minHeight) warnings.push(`${label}: 高さが ${options.minHeight}px 未満です`);
}

function detectImageFormat(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (bytes.subarray(0, 256).toString('utf8').includes('<svg')) return 'svg';
  return undefined;
}

function readImageDimensions(bytes, format) {
  if (format === 'png' && bytes.length >= 24) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }

  if (format === 'jpeg') return readJpegDimensions(bytes);
  return undefined;
}

function readJpegDimensions(bytes) {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return undefined;
}

const active = readJson(join(dataRoot, 'active-election.json'));
const index = readJson(join(dataRoot, 'elections-index.json'));

if (active) requireString(active.currentId, 'active-election.json currentId');
const elections = ensureArray(index?.elections, 'elections-index.json elections');
requireUnique(elections, 'elections-index.json elections');

const electionIds = new Set(elections.map((election) => election.id).filter(Boolean));
if (active?.currentId && !electionIds.has(active.currentId)) {
  errors.push(`active-election.json currentId "${active.currentId}" が elections-index.json に存在しません`);
}
const activeElection = elections.find((election) => election.id === active?.currentId);
if (activeElection?.isDataReady === false) {
  warnings.push(
    `active-election.json currentId "${active.currentId}" は elections-index.json で isDataReady:false のため公開対象にできません`,
  );
}

for (const election of elections) {
  requireString(election.id, 'elections-index.json election.id');
  requireString(election.name, `elections-index.json ${election.id}.name`);

  const isDataReady = election.isDataReady ?? election.id === active?.currentId;
  if (!isDataReady) continue;

  validateElection(election.id);
}

validateGlossary(electionIds);

function validateElection(electionId) {
  const dir = join(dataRoot, electionId);
  const requiredFiles = [
    'election-meta.json',
    'parties.json',
    'members.json',
    'prefectures.json',
    'districts.json',
    'proportional-blocks.json',
    'summary.json',
  ];

  for (const file of requiredFiles) {
    const path = join(dir, file);
    if (!existsSync(path)) errors.push(`${relative(path)} がありません`);
  }

  const meta = readJson(join(dir, 'election-meta.json'));
  const parties = ensureArray(readJson(join(dir, 'parties.json'))?.parties, `${electionId}/parties.json parties`);
  const members = ensureArray(readJson(join(dir, 'members.json'))?.members, `${electionId}/members.json members`);
  const candidates = ensureArray(readJson(join(dir, 'candidates.json'))?.candidates, `${electionId}/candidates.json candidates`);
  const prefectures = ensureArray(readJson(join(dir, 'prefectures.json'))?.prefectures, `${electionId}/prefectures.json prefectures`);
  const districts = ensureArray(readJson(join(dir, 'districts.json'))?.districts, `${electionId}/districts.json districts`);
  const blocks = ensureArray(
    readJson(join(dir, 'proportional-blocks.json'))?.proportionalBlocks,
    `${electionId}/proportional-blocks.json proportionalBlocks`,
  );
  const singleResults = ensureArray(
    readJson(join(dir, 'single-member-districts.json'))?.singleMemberDistricts,
    `${electionId}/single-member-districts.json singleMemberDistricts`,
  );
  const proportionalResults = ensureArray(
    readJson(join(dir, 'results.json'))?.proportionalSeats,
    `${electionId}/results.json proportionalSeats`,
  );
  const summary = readJson(join(dir, 'summary.json'));

  if (meta) {
    requireString(meta.id, `${electionId}/election-meta.json id`);
    requireString(meta.name, `${electionId}/election-meta.json name`);
    if (meta.id !== electionId) errors.push(`${electionId}/election-meta.json id がフォルダ名と一致しません`);
    for (const visual of ensureArray(meta.visuals ?? [], `${electionId}/election-meta.json visuals`)) {
      requireString(visual.id, `${electionId}/visuals.id`);
      requireString(visual.title, `${electionId}/visuals.${visual.id}.title`);
      validateLocalAsset(visual.imageUrl, `${electionId}/visuals.${visual.id}.imageUrl`, {
        allowedFormats: ['png', 'jpeg', 'jpg', 'webp'],
        minWidth: 900,
        minHeight: 600,
        sizeLimitBytes: 5 * 1024 * 1024,
      });
    }
  }

  requireUnique(parties, `${electionId}/parties`);
  requireUnique(members, `${electionId}/members`);
  requireUnique(candidates, `${electionId}/candidates`);
  requireUnique(prefectures, `${electionId}/prefectures`);
  requireUnique(districts, `${electionId}/districts`);
  requireUnique(blocks, `${electionId}/proportionalBlocks`);
  requireUnique(singleResults, `${electionId}/singleMemberDistricts`);
  requireUnique(proportionalResults, `${electionId}/proportionalSeats`);

  const partyIds = new Set(parties.map((party) => party.id));
  const memberIds = new Set(members.map((member) => member.id));
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const prefectureIds = new Set(prefectures.map((prefecture) => prefecture.id));
  const districtIds = new Set(districts.map((district) => district.id));
  const blockIds = new Set(blocks.map((block) => block.id));

  for (const party of parties) {
    requireString(party.id, `${electionId}/parties id`);
    requireString(party.name, `${electionId}/parties.${party.id}.name`);
    requireString(party.color, `${electionId}/parties.${party.id}.color`);
  }

  for (const member of members) {
    requireString(member.id, `${electionId}/members id`);
    requireString(member.name, `${electionId}/members.${member.id}.name`);
    requireRef(partyIds, member.partyId, `${electionId}/members.${member.id}.partyId`);
    requireRef(prefectureIds, member.prefectureId, `${electionId}/members.${member.id}.prefectureId`);
    warnRef(districtIds, member.districtId, `${electionId}/members.${member.id}.districtId`);
    warnRef(blockIds, member.proportionalBlockId, `${electionId}/members.${member.id}.proportionalBlockId`);
    validateLocalAsset(member.photoUrl, `${electionId}/members.${member.id}.photoUrl`, {
      allowedFormats: ['png', 'jpeg', 'jpg', 'webp', 'svg'],
      sizeLimitBytes: 1024 * 1024,
    });
  }

  for (const candidate of candidates) {
    requireString(candidate.id, `${electionId}/candidates id`);
    requireString(candidate.name, `${electionId}/candidates.${candidate.id}.name`);
    requireRef(partyIds, candidate.partyId, `${electionId}/candidates.${candidate.id}.partyId`);
    requireRef(prefectureIds, candidate.prefectureId, `${electionId}/candidates.${candidate.id}.prefectureId`);
    warnRef(districtIds, candidate.districtId, `${electionId}/candidates.${candidate.id}.districtId`);
    warnRef(blockIds, candidate.proportionalBlockId, `${electionId}/candidates.${candidate.id}.proportionalBlockId`);
    validateLocalAsset(candidate.photoUrl, `${electionId}/candidates.${candidate.id}.photoUrl`, {
      allowedFormats: ['png', 'jpeg', 'jpg', 'webp', 'svg'],
      sizeLimitBytes: 1024 * 1024,
    });
  }

  for (const district of districts) {
    requireString(district.id, `${electionId}/districts id`);
    requireString(district.name, `${electionId}/districts.${district.id}.name`);
    requireRef(prefectureIds, district.prefectureId, `${electionId}/districts.${district.id}.prefectureId`);
    warnRef(memberIds, district.winnerMemberId, `${electionId}/districts.${district.id}.winnerMemberId`);
  }

  for (const result of singleResults) {
    requireString(result.id, `${electionId}/singleMemberDistricts id`);
    requireRef(prefectureIds, result.prefectureId, `${electionId}/singleMemberDistricts.${result.id}.prefectureId`);
    requireRef(partyIds, result.partyId, `${electionId}/singleMemberDistricts.${result.id}.partyId`);
    warnRef(candidateIds, result.candidateId, `${electionId}/singleMemberDistricts.${result.id}.candidateId`);
    if (!statuses.has(result.status)) errors.push(`${electionId}/singleMemberDistricts.${result.id}.status が不正です`);
    validateMapPoint(result.mapPoint, `${electionId}/singleMemberDistricts.${result.id}`);
    validateLocalAsset(result.photoUrl, `${electionId}/singleMemberDistricts.${result.id}.photoUrl`, {
      allowedFormats: ['png', 'jpeg', 'jpg', 'webp', 'svg'],
      sizeLimitBytes: 1024 * 1024,
    });
  }

  for (const result of proportionalResults) {
    requireString(result.id, `${electionId}/proportionalSeats id`);
    requireRef(blockIds, result.blockId, `${electionId}/proportionalSeats.${result.id}.blockId`);
    requireRef(partyIds, result.partyId, `${electionId}/proportionalSeats.${result.id}.partyId`);
    if (!statuses.has(result.status)) errors.push(`${electionId}/proportionalSeats.${result.id}.status が不正です`);
    validateMapPoint(result.mapPoint, `${electionId}/proportionalSeats.${result.id}`);
  }

  if (summary) {
    requireNumber(summary.totalSeats, `${electionId}/summary.json totalSeats`);
    if (summary.districtSeats !== undefined) requireNumber(summary.districtSeats, `${electionId}/summary.json districtSeats`);
    if (summary.proportionalSeats !== undefined) {
      requireNumber(summary.proportionalSeats, `${electionId}/summary.json proportionalSeats`);
    }
    if (summary.reportingRate !== undefined) requireNumber(summary.reportingRate, `${electionId}/summary.json reportingRate`);

    validateSummaryConsistency(electionId, summary, blocks, singleResults, proportionalResults);

    for (const seat of ensureArray(summary.partySeats, `${electionId}/summary.json partySeats`)) {
      requireRef(partyIds, seat.partyId, `${electionId}/summary.partySeats.partyId`);
      requireNumber(seat.seats, `${electionId}/summary.partySeats.${seat.partyId}.seats`);
    }
  }
}

function validateGlossary(electionIds) {
  const glossaryDir = join(dataRoot, 'glossary');
  const sourceGlossaryDir = join(root, 'data', 'source', 'glossary', 'csv');

  const files = [
    ['candidates.json', 'candidate'],
    ['parties.json', 'party'],
    ['districts.json', 'district'],
    ['proportional-blocks.json', 'proportional'],
    ['terms.json', 'term'],
  ];
  const entriesByFile = [];
  const allEntries = [];

  for (const [fileName, expectedCategory] of files) {
    const filePath = join(glossaryDir, fileName);
    if (!existsSync(filePath)) {
      errors.push(`${relative(filePath)} がありません`);
      continue;
    }

    const entries = ensureArray(readJson(filePath)?.entries, `glossary/${fileName} entries`);
    entriesByFile.push([fileName, expectedCategory, entries]);
    allEntries.push(...entries);
  }

  validateGlossarySourceSync(sourceGlossaryDir, glossaryDir);

  requireUnique(allEntries, 'glossary entries');
  const glossaryIds = new Set(allEntries.map((entry) => entry.id).filter(Boolean));

  for (const [fileName, expectedCategory, entries] of entriesByFile) {
    for (const entry of entries) {
      requireString(entry.id, `glossary/${fileName} id`);
      requireString(entry.label, `glossary/${fileName}.${entry.id}.label`);
      if (entry.category !== expectedCategory) {
        errors.push(`glossary/${fileName}.${entry.id}.category は "${expectedCategory}" である必要があります`);
      }

      for (const electionId of ensureArray(entry.electionIds ?? [], `glossary/${fileName}.${entry.id}.electionIds`)) {
        if (!electionIds.has(electionId)) {
          errors.push(`glossary/${fileName}.${entry.id}.electionIds: "${electionId}" が elections-index.json に存在しません`);
        }
      }

      for (const relatedId of ensureArray(entry.relatedIds ?? [], `glossary/${fileName}.${entry.id}.relatedIds`)) {
        if (!glossaryIds.has(relatedId)) {
          errors.push(`glossary/${fileName}.${entry.id}.relatedIds: "${relatedId}" が単語帳内に存在しません`);
        }
      }
    }
  }
}

function validateGlossarySourceSync(sourceDir, glossaryDir) {
  const localErrors = [];
  const pushError = (message) => localErrors.push(message);

  if (!existsSync(sourceDir)) {
    errors.push(`${relative(sourceDir)} がありません`);
    return;
  }

  for (const [csvName, config] of Object.entries(glossaryFiles)) {
    const csvPath = join(sourceDir, csvName);
    const jsonPath = join(glossaryDir, config.output);
    try {
      validateCsvHeaders(csvPath, glossaryCsvHeaders);
    } catch (error) {
      pushError(error.message);
      continue;
    }

    if (!existsSync(jsonPath)) continue;

    const expected = readCsv(csvPath).map((row) => normalizeGlossaryCsvRow(row, config.category, pushError));
    const actual = ensureArray(readJson(jsonPath)?.entries, `glossary/${config.output} entries`);
    if (stableStringify(expected) !== stableStringify(actual)) {
      pushError(`${relative(jsonPath)} が ${relative(csvPath)} と同期していません。npm run gen:glossary を実行してください`);
    }
  }

  errors.push(...localErrors);
}

function normalizeGlossaryCsvRow(row, expectedCategory, pushError) {
  if (row.category && row.category !== expectedCategory) {
    pushError(`${row.id || 'unknown'}: category は "${expectedCategory}" である必要があります`);
  }

  return omitEmpty({
    id: row.id,
    label: row.label,
    category: row.category || expectedCategory,
    reading: row.reading,
    description: row.description,
    electionIds: splitGlossaryList(row.electionIds),
    relatedIds: splitGlossaryList(row.relatedIds),
    photoUrl: row.photoUrl,
    districtLabel: row.districtLabel,
    partyLabel: row.partyLabel,
    statusLabel: row.statusLabel,
    age: row.age,
    wins: row.wins,
    seatType: row.seatType,
    reviewStatus: row.reviewStatus,
  });
}

function splitGlossaryList(value) {
  if (!value) return [];
  return String(value)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function omitEmpty(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== ''));
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((next, key) => {
        next[key] = sortValue(value[key]);
        return next;
      }, {});
  }
  return value;
}

function validateSummaryConsistency(electionId, summary, blocks, singleResults, proportionalResults) {
  if (typeof summary.totalSeats === 'number') {
    const declaredSeatTotal = (summary.districtSeats ?? 0) + (summary.proportionalSeats ?? 0);
    if (summary.districtSeats !== undefined && summary.proportionalSeats !== undefined && declaredSeatTotal !== summary.totalSeats) {
      warnings.push(
        `${electionId}/summary.json: totalSeats(${summary.totalSeats}) と districtSeats + proportionalSeats(${declaredSeatTotal}) が一致しません`,
      );
    }

    const summaryPartySeatTotal = ensureArray(summary.partySeats, `${electionId}/summary.json partySeats`).reduce(
      (total, seat) => total + (typeof seat.seats === 'number' ? seat.seats : 0),
      0,
    );
    if (summaryPartySeatTotal > summary.totalSeats) {
      warnings.push(
        `${electionId}/summary.json: partySeats合計(${summaryPartySeatTotal}) が totalSeats(${summary.totalSeats}) を超えています`,
      );
    }
  }

  if (summary.proportionalSeats !== undefined) {
    const blockSeatTotal = blocks.reduce((total, block) => total + (typeof block.seats === 'number' ? block.seats : 0), 0);
    if (blockSeatTotal !== summary.proportionalSeats) {
      warnings.push(
        `${electionId}/summary.json: proportionalSeats(${summary.proportionalSeats}) と proportional-blocks seats合計(${blockSeatTotal}) が一致しません`,
      );
    }
  }

  const hasUnsettledResults = [...singleResults, ...proportionalResults].some(
    (result) => result.status === 'counting' || result.status === 'pending',
  );
  const isFinalLike = summary.reportingRate === 100 && !hasUnsettledResults;
  const confirmedResultSeatTotal = countConfirmedSingleSeats(singleResults) + countConfirmedProportionalSeats(proportionalResults);
  if (typeof summary.totalSeats === 'number' && confirmedResultSeatTotal > summary.totalSeats) {
    warnings.push(
      `${electionId}: 結果データ確定議席(${confirmedResultSeatTotal}) が summary.totalSeats(${summary.totalSeats}) を超えています`,
    );
  }

  const estimatedPartySeats = estimatePartySeats(singleResults, proportionalResults);
  const summaryPartySeats = new Map(
    ensureArray(summary.partySeats, `${electionId}/summary.json partySeats`).map((seat) => [seat.partyId, seat.seats]),
  );

  for (const [partyId, estimatedSeats] of estimatedPartySeats) {
    const summarySeats = summaryPartySeats.get(partyId) ?? 0;
    if (summarySeats === estimatedSeats) continue;

    const message = `${electionId}/summary.partySeats.${partyId}: summary(${summarySeats}) と結果データ推定(${estimatedSeats}) が一致しません`;
    if (isFinalLike) {
      warnings.push(message);
    } else {
      infos.push(`${message}。開票中または未確定データを含むため参考情報です`);
    }
  }
}

function countConfirmedSingleSeats(singleResults) {
  return singleResults.filter((result) => confirmedStatuses.has(result.status)).length;
}

function countConfirmedProportionalSeats(proportionalResults) {
  return proportionalResults.reduce((total, result) => {
    if (!confirmedStatuses.has(result.status)) return total;
    return total + (typeof result.seats === 'number' ? result.seats : 0);
  }, 0);
}

function estimatePartySeats(singleResults, proportionalResults) {
  const seatsByParty = new Map();
  const addSeats = (partyId, seats) => {
    if (!partyId) return;
    seatsByParty.set(partyId, (seatsByParty.get(partyId) ?? 0) + seats);
  };

  for (const result of singleResults) {
    if (confirmedStatuses.has(result.status)) addSeats(result.partyId, 1);
  }

  for (const result of proportionalResults) {
    if (confirmedStatuses.has(result.status)) addSeats(result.partyId, typeof result.seats === 'number' ? result.seats : 0);
  }

  return seatsByParty;
}

for (const info of infos) console.info(`INFO ${info}`);
for (const warning of warnings) console.warn(`WARN ${warning}`);

if (strict && infos.length > 0) {
  for (const info of infos) errors.push(`strict: ${info}`);
}

if (strict && warnings.length > 0) {
  for (const warning of warnings) errors.push(`strict: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`\nデータ検証に失敗しました: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(
  `データ検証OK: ${elections.length} election(s), ${warnings.length} warning(s), ${infos.length} info(s)${
    strict ? ', strict' : ''
  }`,
);
